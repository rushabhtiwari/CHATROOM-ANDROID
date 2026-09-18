"""Measure seconds-per-entry, cold cache versus warm, against the real window.

    python scripts/measure_speed.py --profile pact_purchase_order --rows 3
    python scripts/measure_speed.py --profile practice --rows 5 --csv practice/sample_pact_po.csv

PACT must be open, logged in, and showing the document this profile is for. Nothing is
ever saved: this fills and reads back, and never touches Save or Post.

## What it is actually comparing

`server/worker.py` used to build a fresh `Robot` for every entry in a batch. `Robot`
starts with an empty resolved-control cache, and a cold UI Automation resolve on this
screen costs 2-9 seconds per control (see the note above `Robot._condition`). So a batch
re-paid full resolution for every field of every row: ten header fields plus the tab
switch plus the grid, times the number of rows.

    cold  - a new Robot per row, cache thrown away, plus a fresh attach and bind
    warm  - one Robot for the whole run, cache surviving New

`--rows 1` measures nothing useful: row 1 is cold either way. The saving is rows 2..n, so
run at least three.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from robot.fill import Robot, load_profile  # noqa: E402


def sample_records(profile: dict, rows: int, csv_path: Path | None) -> list[dict]:
    """Rows to type. From a CSV when one is given, else the profile's own field names."""
    if csv_path:
        with csv_path.open(newline="", encoding="utf-8-sig") as handle:
            data = [dict(row) for row in csv.DictReader(handle)]
        from server.preflight import parse_line_items  # noqa: PLC0415

        out = []
        for row in data[:rows]:
            record = {k: v for k, v in row.items() if v not in (None, "")}
            if record.get("line_items"):
                record["line_items"] = parse_line_items(record["line_items"])
            out.append(record)
        return out

    # No CSV: type a distinguishable marker into every plain text field the profile has,
    # which is enough to exercise resolution without needing real master data.
    fields = profile["fields"]
    editable = [k for k, spec in fields.items() if spec.get("type", "edit") == "edit"]
    return [{k: f"SPEED {n + 1}" for k in editable} for n in range(rows)]


def time_one(robot: Robot, record: dict) -> dict[str, float]:
    marks: dict[str, float] = {}
    start = time.perf_counter()

    t = time.perf_counter()
    robot.ensure_editable()
    robot.new_record()
    marks["new"] = time.perf_counter() - t

    t = time.perf_counter()
    robot.fill(record)
    marks["fill"] = time.perf_counter() - t

    t = time.perf_counter()
    robot.read_back()
    marks["readback"] = time.perf_counter() - t

    marks["total"] = time.perf_counter() - start
    marks["cached_controls"] = float(len(robot._cache))
    return marks


def run(profile: dict, records: list[dict], warm: bool, quiet=False) -> list[dict[str, float]]:
    """One pass. `warm=False` rebuilds the Robot per row, exactly as the old worker did."""
    log = (lambda *_: None) if quiet else print
    results = []
    robot = None
    for index, record in enumerate(records, start=1):
        t = time.perf_counter()
        if warm and robot is not None and robot.is_live():
            robot.focus()
            robot.bind_document()
        else:
            robot = Robot(profile, log=log).attach()
        attach = time.perf_counter() - t

        marks = time_one(robot, record)
        marks["attach"] = attach
        marks["total"] += attach
        results.append(marks)
        print(
            f"    row {index}: attach {attach:5.1f}s  new {marks['new']:5.1f}s  "
            f"fill {marks['fill']:6.1f}s  readback {marks['readback']:5.1f}s  "
            f"= {marks['total']:6.1f}s   ({int(marks['cached_controls'])} controls cached)"
        )
    return results


def summarise(name: str, results: list[dict[str, float]]) -> float:
    totals = [r["total"] for r in results]
    mean = statistics.fmean(totals)
    print(
        f"  {name:<6} first row {totals[0]:6.1f}s   "
        f"rows 2+ mean {statistics.fmean(totals[1:]) if len(totals) > 1 else float('nan'):6.1f}s   "
        f"overall mean {mean:6.1f}s   total {sum(totals):6.1f}s"
    )
    return mean


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", default=os.getenv("PROFILE", "practice"))
    parser.add_argument("--rows", type=int, default=3)
    parser.add_argument("--csv", type=Path, default=None)
    parser.add_argument("--only", choices=("cold", "warm"), default=None)
    parser.add_argument("--json", type=Path, default=None, help="write the raw numbers here")
    args = parser.parse_args()

    profile = load_profile(args.profile)
    if not Robot.window_present(profile, timeout=3.0):
        print(
            f"The window for profile {args.profile!r} is not open.\n"
            "Open the app, log in, and show the document this profile is for, then run again."
        )
        return 1

    records = sample_records(profile, args.rows, args.csv)
    print(f"\nProfile {args.profile!r}, {len(records)} row(s). Nothing will be saved.\n")

    out: dict[str, list] = {}
    if args.only != "warm":
        print("  COLD - a new Robot per row (the old worker)")
        out["cold"] = run(profile, records, warm=False, quiet=True)
        summarise("cold", out["cold"])
        print()
    if args.only != "cold":
        print("  WARM - one Robot for the run (the new worker)")
        out["warm"] = run(profile, records, warm=True, quiet=True)
        summarise("warm", out["warm"])
        print()

    if "cold" in out and "warm" in out:
        cold = statistics.fmean(r["total"] for r in out["cold"])
        warm = statistics.fmean(r["total"] for r in out["warm"])
        saved = cold - warm
        print(
            f"  Saved {saved:.1f}s per entry "
            f"({saved / cold * 100:.0f}%), {saved * len(records):.0f}s over {len(records)} rows.\n"
        )

    if args.json:
        args.json.write_text(json.dumps(out, indent=2), encoding="utf-8")
        print(f"  raw numbers -> {args.json}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
