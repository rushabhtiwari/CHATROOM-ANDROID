"""
Background worker: takes approved entries one at a time (GUI automation must be serial)
and runs   attach -> new -> fill -> read back -> screenshot -> verify -> (save -> confirmation).

Batch rows come first, in file order, and only while their batch is `running`; loose entries
(added by hand, by cli.py or by the OpenClaw skill) are picked up when no batch is runnable.

A batch is approved once. After that the worker never waits for a human: AUTO_SAVE only applies
to loose entries. If the target window disappears mid-batch the batch PAUSES - the remaining rows
are left untouched so they can be resumed, rather than failed one after another.
"""
import json, os, threading, time, traceback
from pathlib import Path

from dotenv import load_dotenv

from . import db
from robot.fill import Robot, RobotError, WindowMissing, load_profile
from server.preflight import format_line_items
from verifier.verify import Verifier

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
SHOTS = ROOT / "verifier" / "screenshots"
RUNLOG = ROOT / "logs" / "runs.log"

LINE_ITEMS = "line_items"


class Settings:
    def __init__(self):
        self.reload()

    def reload(self):
        load_dotenv(ROOT / ".env", override=True)
        self.profile_name = os.getenv("PROFILE", "practice")
        self.dry_run = os.getenv("DRY_RUN", "false").lower() == "true"
        self.auto_save = os.getenv("AUTO_SAVE", "true").lower() == "true"
        self.model = os.getenv("VERIFIER_MODEL", "claude-sonnet-4-5")
        # every  - a vision call per row (safest, slowest, costs money per row)
        # first  - one vision call per batch, on the first row that fills
        # off    - no vision call at all
        # The read-back check runs in all three: it is exact, local and free.
        mode = os.getenv("VERIFY_MODE", "first").strip().lower()
        self.verify_mode = mode if mode in ("every", "first", "off") else "first"

    def as_dict(self):
        return {"profile": self.profile_name, "dry_run": self.dry_run,
                "auto_save": self.auto_save, "model": self.model,
                "verify_mode": self.verify_mode,
                "mode": "DRY RUN" if self.dry_run else "LIVE"}


settings = Settings()
_state = {"busy": False, "current": None, "current_record": None, "step": "",
          "batch_id": None, "last_error": "", "worker_alive": False}
_manual_save = set()   # entry ids a human clicked "Save now" for (loose entries, AUTO_SAVE=false)
_lock = threading.Lock()

# One attached Robot is reused across the rows of a batch. Robot.__init__ starts with an
# empty resolved-control cache and every cold UIA resolve costs 2-9s (robot/fill.py, above
# `_condition`), so building one per row re-paid full resolution for every field of every
# row - the single largest cost in a batch. It is dropped whenever the window goes away,
# the profile changes, or the operator switches document tab.
_robot = None
_robot_profile = None
_vision_done = set()   # batch ids that have already had their one VERIFY_MODE=first vision call


def state():
    s = dict(_state, settings=settings.as_dict())
    b = db.running_batch()
    s["batch"] = batch_progress(b["id"]) if b else None
    return s


def batch_progress(bid: int) -> dict | None:
    b = db.get_batch(bid)
    if not b:
        return None
    counts = db.batch_counts(bid)
    avg = db.avg_seconds(bid) or db.avg_seconds()
    running = b["status"] in ("running", "paused", "stopping")
    eta = round(avg * counts["remaining"]) if running and avg and counts["remaining"] else None
    elapsed = None
    if b.get("started_at"):
        elapsed = round((b.get("finished_at") or time.time()) - b["started_at"])
    return {**b, "counts": counts, "avg_seconds": round(avg, 1) if avg else None,
            "eta_seconds": eta, "elapsed_seconds": elapsed,
            "current_entry": _state["current"] if _state.get("batch_id") == bid else None}


def request_save(eid: int):
    with _lock:
        _manual_save.add(eid)


def _acquire_robot(profile: dict, log) -> "Robot":
    """The attached Robot for this row - reused across a batch, rebuilt when it cannot be.

    Reuse keeps `Robot._cache`, so a field resolved on row 1 costs nothing on rows 2..n.
    A reused Robot still re-checks the window and the selected document tab before it is
    handed back, so a closed window or an operator switching to another PACT document is
    caught here rather than by typing into the wrong place.
    """
    global _robot, _robot_profile
    r = _robot
    # ROBOT_REUSE=off attaches fresh for every record. On this PACT the master lookups
    # resolve on the first document after an attach and stop resolving on the ones after
    # it - the Product Code is typed in full, the filter matches nothing, and PACT clears
    # the cell. Re-attaching costs one cold UIA resolve per ORDER (not per line item),
    # which is the right trade when the alternative is a draft that silently loses rows.
    # Set ROBOT_REUSE=on to get the cache back once the lookups behave.
    if (os.getenv("ROBOT_REUSE", "off") or "off").strip().lower() not in ("on", "1", "true"):
        if r is not None:
            log("ROBOT_REUSE is off - attaching fresh so the master lookups resolve")
        _robot, r = None, None
    if r is not None and _robot_profile == settings.profile_name:
        if r.is_live():
            r.log = log
            r.profile = profile          # pick up a profile edited between rows
            r.focus()                    # attach() used to do this once per record
            r.bind_document()            # keeps the cache when the same tab is still selected
            log(f"reusing the attached window ({len(r._cache)} control(s) already resolved)")
            return r
        log("the attached window is no longer usable - attaching again")
        _robot = None
    r = Robot(profile, log=log).attach()
    _robot, _robot_profile = r, settings.profile_name
    return r


def _release_robot():
    global _robot, _robot_profile
    _robot, _robot_profile = None, None


def _want_vision(bid: int | None) -> bool:
    if settings.verify_mode == "off":
        return False
    if settings.verify_mode == "first" and bid is not None:
        return bid not in _vision_done
    return True


def _filelog(line: str):
    RUNLOG.parent.mkdir(exist_ok=True)
    with RUNLOG.open("a", encoding="utf-8") as f:
        f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + line + "\n")


# --------------------------------------------------------------------------- batch control
def start_batch(bid: int, exclude: list[int] | None = None) -> dict:
    """The single human approval. Everything after this runs unattended."""
    b = db.get_batch(bid)
    if not b:
        raise KeyError(bid)
    exclude = set(exclude or [])
    n = 0
    for e in db.list_for_batch(bid):
        if e["row_no"] in exclude:
            if e["status"] in ("pending", "approved"):
                db.set_status(e["id"], "skipped", error="excluded before the batch started")
            continue
        if e["status"] in ("pending", "failed", "rejected", "skipped"):
            db.set_status(e["id"], "approved", error="")
            db.append_log(e["id"], f"approved as part of batch #{bid}")
            n += 1
    db.set_batch(bid, status="running", mode=settings.as_dict()["mode"], pause_reason="",
                 started_at=db.get_batch(bid).get("started_at") or time.time(),
                 profile=settings.profile_name)
    _vision_done.discard(bid)
    _filelog(f"[batch {bid}] started, {n} row(s), mode={settings.as_dict()['mode']}")
    return batch_progress(bid)


def pause_batch(bid: int, reason: str = "paused on the page") -> dict:
    db.set_batch(bid, status="paused", pause_reason=reason)
    _filelog(f"[batch {bid}] paused: {reason}")
    return batch_progress(bid)


def resume_batch(bid: int) -> dict:
    db.set_batch(bid, status="running", pause_reason="")
    _filelog(f"[batch {bid}] resumed")
    return batch_progress(bid)


def stop_batch(bid: int) -> dict:
    db.set_batch(bid, status="stopping", pause_reason="stop requested - finishing the current row")
    _filelog(f"[batch {bid}] stop after current row")
    return batch_progress(bid)


def _finish_batch(bid: int, skip_remaining: bool):
    if skip_remaining:
        for e in db.list_for_batch(bid):
            if e["status"] in ("pending", "approved"):
                db.set_status(e["id"], "skipped", error="batch stopped before this row ran")
    counts = db.batch_counts(bid)
    b = db.get_batch(bid)
    now = time.time()
    totals = {"saved": counts["saved"], "failed": counts["failed"], "skipped": counts["skipped"],
              "total": counts["total"],
              "elapsed_seconds": round(now - b["started_at"]) if b.get("started_at") else None,
              "avg_seconds": round(db.avg_seconds(bid), 1) if db.avg_seconds(bid) else None}
    db.set_batch(bid, status="done", finished_at=now, totals=totals, pause_reason="")
    _vision_done.discard(bid)
    _filelog(f"[batch {bid}] done: {totals}")


def _sweep_batches():
    """Close out batches whose rows have all run (or that were told to stop)."""
    for b in db.list_batches(limit=20):
        if b["status"] == "running":
            if db.batch_counts(b["id"])["remaining"] == 0 and db.batch_counts(b["id"])["total"]:
                _finish_batch(b["id"], skip_remaining=False)
        elif b["status"] == "stopping" and not _state["busy"]:
            _finish_batch(b["id"], skip_remaining=True)


# --------------------------------------------------------------------------- one record
def process(entry: dict):
    eid = entry["id"]
    record = entry["record"]
    bid = entry.get("batch_id")
    log = lambda s: (db.append_log(eid, s), _filelog(f"[#{eid}] {s}"))
    profile = load_profile(settings.profile_name)
    labels = profile.get("verify_labels", {})
    items = record.get(LINE_ITEMS) or []
    expected = {k: v for k, v in record.items()
                if k in profile["fields"] and v not in (None, "")}
    to_fill = dict(expected, **({LINE_ITEMS: items} if items else {}))
    # Code and quantity only - see `format_line_items`. The rate belongs to PACT's product
    # master and cannot be typed on this screen, so it is not something the fill can be
    # judged against; the difference is recorded as a price note instead.
    vision_extra = {"Line items (code|qty)": format_line_items(items)} if items else {}

    _state.update(busy=True, current=eid, batch_id=bid, step="starting",
                  current_record=_short(record))
    t0 = time.time()
    timings = {}
    mark = lambda name, since: timings.__setitem__(name, round(time.time() - since, 1))
    try:
        db.set_status(eid, "filling")
        _state["step"] = "filling"
        log(f"profile={settings.profile_name} dry_run={settings.dry_run} "
            f"auto_save={settings.auto_save} verify={settings.verify_mode}"
            f"{f' batch=#{bid}' if bid else ''}")
        t = time.time()
        robot = _acquire_robot(profile, log)
        robot.ensure_editable()
        robot.new_record()
        mark("attach", t)

        t = time.time()
        robot.fill(to_fill)
        mark("fill", t)

        db.set_status(eid, "verifying")
        _state["step"] = "verifying"
        t = time.time()
        readback = robot.read_back()
        log("read back: " + json.dumps(readback, ensure_ascii=False))
        grid_rows, grid_notes, grid_prices = [], [], []
        if items:
            grid_rows = robot.read_line_items()
            grid_notes, grid_prices = robot.grid_notes, robot.grid_prices
            log("grid: " + json.dumps(grid_rows, ensure_ascii=False))
            for n in grid_notes:
                log("PRICE NOTE: " + n)
        shot = SHOTS / f"entry_{eid}_{int(time.time())}.png"
        robot.screenshot(shot)
        log(f"screenshot: {shot.name}")
        mark("readback", t)

        # The read-back check is exact, local and free, so it runs on every row whatever
        # VERIFY_MODE says. Only the Claude vision call - seconds and real money per row -
        # is what the mode turns down.
        t = time.time()
        if _want_vision(bid):
            verdict = Verifier(model=settings.model).verify(shot, expected, labels, readback,
                                                            vision_extra=vision_extra)
            if bid is not None:
                _vision_done.add(bid)
        else:
            rb = Verifier.readback_check(expected, readback)
            verdict = {"ok": not rb, "readback_ok": not rb, "vision_ok": None,
                       "mismatches": rb, "model": None,
                       "note": f"read-back only (VERIFY_MODE={settings.verify_mode})"}
        mark("verify", t)
        log(f"verifier: ok={verdict['ok']} readback_ok={verdict['readback_ok']} "
            f"vision_ok={verdict['vision_ok']} - {verdict.get('note','')}")
        for m in verdict["mismatches"]:
            log(f"  mismatch ({m.get('source')}): {m.get('field')} "
                f"expected={m.get('expected')!r} seen={m.get('seen')!r}")

        result = {"verifier": verdict, "screenshot": shot.name, "readback": readback,
                  "line_items": grid_rows, "price_notes": grid_notes, "prices": grid_prices,
                  "timings": timings}
        if not verdict["ok"]:
            db.set_status(eid, "failed", error="Verification failed - nothing was saved", result=result)
            return

        if settings.dry_run:
            if bid:
                db.set_status(eid, "skipped", error="DRY RUN - verified OK, nothing was saved",
                              result=dict(result, dry_run=True))
                log("DRY_RUN=true: verified OK, Save NOT pressed")
            else:
                db.set_status(eid, "awaiting_save", error="", result=dict(result, dry_run=True))
                log("DRY_RUN=true: verified OK, Save NOT pressed")
            return

        if not settings.auto_save and not bid:
            db.set_status(eid, "awaiting_save", result=result)
            log("waiting for a human to click 'Save now' on the page")
            deadline = time.time() + 600
            while time.time() < deadline:
                with _lock:
                    if eid in _manual_save:
                        _manual_save.discard(eid); break
                if db.get(eid)["status"] != "awaiting_save":
                    log("cancelled while awaiting save"); return
                time.sleep(0.5)
            else:
                db.set_status(eid, "failed", error="Timed out waiting for human Save", result=result)
                return

        db.set_status(eid, "saving", result=result)
        _state["step"] = "saving"
        t = time.time()
        robot.save()
        conf = robot.confirmation()
        mark("save", t)
        timings["total"] = round(time.time() - t0, 1)
        log(f"confirmation: {conf}")
        log("timings (s): " + ", ".join(f"{k}={v}" for k, v in timings.items()))
        result["confirmation"] = conf
        if conf["ok"] is False:
            db.set_status(eid, "failed", error=f"App reported error: {conf['text']}", result=result)
        elif conf["ok"] is None:
            db.set_status(eid, "saved", error="Saved, but no confirmation text was detected", result=result)
        else:
            db.set_status(eid, "saved", error="", result=result)
    except WindowMissing as e:
        log(f"WINDOW MISSING: {e}")
        _release_robot()
        _window_gone(eid, bid, str(e), log)
    except RobotError as e:
        log(f"ROBOT ERROR: {e}")
        _release_robot()      # a mis-resolved control must not be reused by the next row
        # a control that vanished mid-record usually means the whole window did
        if bid and not Robot.window_present(profile):
            _window_gone(eid, bid, f"the window closed while row was being filled ({e})", log)
        else:
            db.set_status(eid, "failed", error=str(e))
    except Exception as e:
        log("ERROR: " + "".join(traceback.format_exception_only(type(e), e)).strip())
        _filelog(traceback.format_exc())
        _release_robot()
        # pywinauto raises its own errors (ElementNotFoundError, COMError) when the window dies
        # mid-record; that is the same situation as a missing window, so pause rather than fail.
        if bid and not Robot.window_present(profile):
            _window_gone(eid, bid, f"the window closed while this row was being filled ({e.__class__.__name__})", log)
        else:
            db.set_status(eid, "failed", error=f"{e.__class__.__name__}: {e}")
    finally:
        _state.update(busy=False, current=None, step="", current_record=None, batch_id=None)


def _window_gone(eid: int, bid: int | None, why: str, log):
    """Pause the batch instead of burning every remaining row against a missing window."""
    if bid:
        db.set_status(eid, "approved", error=why)      # this row re-runs on resume
        db.append_log(eid, "batch paused; this row will be retried on Resume")
        pause_batch(bid, f"{why} Open the window and log in, then Resume.")
    else:
        db.set_status(eid, "failed", error=why)


def _short(record: dict) -> dict:
    out = {}
    for k, v in list(record.items())[:6]:
        if k == LINE_ITEMS and isinstance(v, list):
            out[k] = f"{len(v)} line item(s)"
        else:
            out[k] = v
    return out


def loop():
    _state["worker_alive"] = True
    while True:
        try:
            _sweep_batches()
            entry = db.next_approved()
            if entry:
                process(entry)
            else:
                # How long an approved row waits before the robot notices it. KiranOS
                # approves a row and then polls for its outcome, so this sits directly
                # on the path between the Accounts click and the first keystroke.
                time.sleep(0.25)
        except Exception as e:
            _state["last_error"] = str(e)
            _filelog("worker loop error: " + traceback.format_exc())
            time.sleep(2)


def start():
    t = threading.Thread(target=loop, name="fill-worker", daemon=True)
    t.start()
    return t
