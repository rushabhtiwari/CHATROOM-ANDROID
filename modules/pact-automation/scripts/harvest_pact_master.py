"""Read real vendor names and product codes out of the live PACT window.

    python scripts\harvest_pact_master.py --vendors 8 --products 8

PACT must be open, logged in, and on the Purchase Order screen. Nothing is ever saved: every
probe ends with New, which discards the throwaway draft. The result is written to
demo/pact_master_snapshot.json and is what tools/make_client_pos.py builds the demo POs from.

## Why this exists

Neither master exposes its rows to UI Automation: the dropdowns are drawn as popups whose
items never appear in the tree. The one thing that does work (demo/discovered_values.md, route
3) is to commit a row and read it back - on the grid, open the Product Code cell, type a
character so the dropdown opens, press Down N times, press Enter, and PACT fills Product
Name, Units and the rate for whatever row that was. The vendor combo works the same way.

Each row found that way is then VERIFIED the strict way: cleared, typed in full with the
same protocol the robot uses on a real order, Enter, and checked to have resolved. A value
is only recorded as usable if the typed lookup reaches it, because that is the only way the
robot can reach it during a fill. The two verdicts are kept apart in the snapshot.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from robot.fill import Robot, RobotError, load_profile, _same  # noqa: E402

OUT = ROOT / "demo" / "pact_master_snapshot.json"


def log(line: str) -> None:
    print(time.strftime("%H:%M:%S "), line, flush=True)


# --------------------------------------------------------------------------- products
def read_row(r: Robot, grid, heads, cols=("Product Code", "Product Name", "Units", "UnitPrice", "HSNCODE")):
    by_col, _ = r._row_map(r._row(grid, 0, 1), heads)
    return {c: (r._cell_text(by_col[c]) if c in by_col else "") for c in cols}


def product_cell(r: Robot, grid, heads):
    by_col, _ = r._row_map(r._row(grid, 0, 1), heads)
    cell = by_col.get("Product Code")
    if cell is None or not r._visible(cell):
        raise RobotError("Product Code cell is not on screen")
    return cell


def select_vendor(r: Robot, vloc: dict, vendor: str) -> None:
    """Pick the vendor the way a real fill does, so the product list is the one that
    fill will see. PACT filters the product dropdown to the selected vendor's products:
    walked with no vendor every row resolves, and the same code then finds nothing once
    a vendor is in the header. That is why the snapshot records products PER VENDOR."""
    r._set_lookup("vendor_name", vloc, r._ctrl(vloc), vendor)
    # PACT rebuilds the grid after a vendor change. A real fill spends several seconds on
    # the header fields before it touches the grid; clicking straight into the Product Code
    # cell instead leaves a cell that will not open for editing. So: give it that time, and
    # park focus on a plain header field the way the fill does before the grid.
    time.sleep(3.0)
    park = r.profile.get("fields", {}).get("narration")
    if park:
        try:
            r._ctrl(park).set_focus()
            time.sleep(0.4)
        except Exception:
            pass


def harvest_products(r: Robot, g: dict, count: int, vloc: dict | None = None,
                     vendor: str | None = None) -> list[dict]:
    found: dict[str, dict] = {}
    grid = r._grid()
    heads = r._header_boxes(grid)
    for k in range(1, count + 1):
        r.new_record()
        time.sleep(0.6)
        if vendor:
            select_vendor(r, vloc, vendor)
        grid = r._grid()
        heads = r._header_boxes(grid)
        cell = product_cell(r, grid, heads)
        cell.click_input()
        time.sleep(0.3)
        editor = r._open_editor(cell, g)
        if editor is None:
            # one more go after a longer pause: the row may still have been rebuilding
            time.sleep(1.5)
            cell = product_cell(r, grid, heads)
            cell.click_input()
            time.sleep(0.5)
            editor = r._open_editor(cell, g)
        if editor is None:
            log(f"  product probe {k}: the cell would not open for editing; skipping")
            continue
        try:
            editor.set_edit_text("")
        except Exception:
            r._keys("^a{BACKSPACE}")
        # A character opens the dropdown; the notes record that the list does not filter on
        # it, so Down x k walks the master from the top.
        r._keys("A", pause=0.05)
        time.sleep(0.8)
        r._keys("{DOWN}" * k, pause=0.12)
        time.sleep(0.4)
        r._keys("{ENTER}")
        time.sleep(0.5)
        r._wait_resolved(grid, heads, 0, 1, g)
        row = read_row(r, grid, heads)
        code = row["Product Code"].strip()
        if not code:
            log(f"  product probe {k}: nothing committed ({row})")
            continue
        log(f"  product probe {k}: {code!r}  {row['Product Name']!r}  units={row['Units']!r} rate={row['UnitPrice']!r}")
        found[code] = {
            "code": code, "name": row["Product Name"], "units": row["Units"],
            "rate": row["UnitPrice"], "hsn": row["HSNCODE"], "probe": k,
        }
    return list(found.values())


def verify_product(r: Robot, g: dict, code: str, vloc: dict | None = None,
                   vendor: str | None = None) -> tuple[bool, str]:
    """Type the code the way a real fill does and see whether PACT resolves it."""
    r.new_record()
    time.sleep(0.6)
    if vendor:
        select_vendor(r, vloc, vendor)
    grid = r._grid()
    heads = r._header_boxes(grid)
    r._lookup_typed, r._lookup_resolved, r._lookup_spent = {}, {}, {}
    cell = product_cell(r, grid, heads)
    cell.click_input()
    time.sleep(0.3)
    r._type_cell(cell, "", g)
    time.sleep(0.3)
    cell = product_cell(r, grid, heads)
    cell.click_input()
    time.sleep(0.2)
    _, combo, landed = r._type_cell(cell, code, g)
    if not landed:
        return False, "the cell would not take the whole value"
    ok = r._commit_grid_lookup(grid, heads, 0, 1, "Product Code", code, g, combo)
    row = read_row(r, grid, heads)
    seen = row["Product Code"].strip()
    if ok and _same(seen, code):
        return True, f"resolved: {row['Product Name']!r}"
    return False, f"typed {code!r}, grid shows {seen!r}, resolved={ok}"


# --------------------------------------------------------------------------- vendors
def harvest_vendors(r: Robot, loc: dict, prefixes: str, per_prefix: int) -> list[dict]:
    combo = r._ctrl(loc)
    part = loc.get("child_edit", "PART_EditableTextBox")
    found: dict[str, dict] = {}
    for prefix in prefixes:
        for k in range(1, per_prefix + 1):
            r.new_record()
            time.sleep(0.5)
            combo = r._ctrl(loc)
            box = r._child_edit(combo, part)
            box.set_focus()
            time.sleep(0.2)
            try:
                box.set_edit_text("")
            except Exception:
                r._keys("^a{BACKSPACE}")
            time.sleep(0.2)
            r._keys(prefix, pause=0.05)
            r._await_dropdown(combo, 3.0)
            time.sleep(0.3)
            r._keys("{DOWN}" * k, pause=0.12)
            time.sleep(0.3)
            r._keys("{ENTER}")
            time.sleep(0.5)
            name = r._read_lookup(combo, part).strip()
            n = r._selection_count(combo)
            log(f"  vendor probe {prefix}{k}: {name!r} selected={n}")
            if name and n:
                found[name] = {"name": name, "probe": f"{prefix}{k}"}
    return list(found.values())


def verify_vendor(r: Robot, loc: dict, name: str) -> tuple[bool, str]:
    r.new_record()
    time.sleep(0.5)
    combo = r._ctrl(loc)
    try:
        r._set_lookup("vendor_name", loc, combo, name)
        return True, "resolved when typed"
    except RobotError as error:
        return False, str(error)[:120]


# --------------------------------------------------------------------------- per vendor
def per_vendor(r: Robot, g: dict, vloc: dict, a, out: Path, previous: dict) -> int:
    """For every vendor the snapshot marks usable: select it, walk its product list, and
    verify each code by typing with that vendor selected. Records `vendor_products`."""
    vendors = [v["name"] for v in previous.get("vendors", []) if v.get("typed_ok")]
    if a.only_vendor:
        vendors = [v for v in vendors if v == a.only_vendor]
    if not vendors:
        log("no usable vendors in the snapshot yet - run without --per-vendor first")
        return 1
    products = {p["code"]: p for p in previous.get("products", [])}
    vendor_products: dict[str, list[str]] = dict(previous.get("vendor_products", {}))
    for vendor in vendors:
        log(f"== vendor {vendor!r}: walking its product list")
        try:
            rows = harvest_products(r, g, a.products, vloc, vendor)
        except RobotError as error:
            log(f"  could not walk products for {vendor!r}: {error}")
            vendor_products[vendor] = []
            continue
        usable = []
        for p in rows:
            ok, why = verify_product(r, g, p["code"], vloc, vendor)
            log(f"  {p['code']:<16} {'OK ' if ok else 'NO '} {why}")
            products.setdefault(p["code"], {**p, "typed_ok": False, "typed_note": ""})
            products[p["code"]]["name"] = p["name"] or products[p["code"]].get("name", "")
            if ok:
                usable.append(p["code"])
                products[p["code"]]["typed_ok"] = True
                products[p["code"]]["typed_note"] = why
        vendor_products[vendor] = usable
        log(f"== vendor {vendor!r}: {len(usable)} product(s) resolve when typed: {usable}")
    r.new_record()
    snapshot = {
        **previous,
        "harvested_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "window": r.win.window_text(),
        "profile": a.profile,
        "products": list(products.values()),
        "vendor_products": vendor_products,
    }
    out.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    log(f"== wrote {out}")
    for v, codes in vendor_products.items():
        log(f"   {v!r}: {codes}")
    return 0 if any(vendor_products.values()) else 1


# --------------------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--profile", default="pact_purchase_order")
    ap.add_argument("--products", type=int, default=8)
    ap.add_argument("--vendors", type=int, default=8)
    ap.add_argument("--vendor-prefixes", default="AMSKRPV")
    ap.add_argument("--only-vendor", default="", help="with --per-vendor: just this vendor")
    ap.add_argument("--per-vendor", action="store_true",
                    help="walk the product master once per usable vendor already in the snapshot")
    ap.add_argument("--out", default=str(OUT), help="where to write the snapshot")
    ap.add_argument("--merge", action="store_true",
                    help="keep whatever an existing snapshot already holds and add to it")
    a = ap.parse_args()
    out = Path(a.out)
    previous = {}
    if (a.merge or a.per_vendor) and out.exists():
        previous = json.loads(out.read_text(encoding="utf-8"))

    profile = load_profile(a.profile)
    g = profile["grid"]
    vloc = profile["fields"]["vendor_name"]

    r = Robot(profile, log=log).attach()
    r.ensure_editable()

    if a.per_vendor:
        return per_vendor(r, g, vloc, a, out, previous)

    log("== products: walking the master")
    products = harvest_products(r, g, a.products)
    log(f"== products: {len(products)} distinct row(s) found; verifying each by typing")
    for p in products:
        ok, why = verify_product(r, g, p["code"])
        p["typed_ok"], p["typed_note"] = ok, why
        log(f"  {p['code']:<10} {'OK ' if ok else 'NO '} {why}")

    log("== vendors: walking the master")
    per = max(1, -(-a.vendors // len(a.vendor_prefixes)))
    vendors = harvest_vendors(r, vloc, a.vendor_prefixes, per)
    log(f"== vendors: {len(vendors)} distinct row(s) found; verifying each by typing")
    for v in vendors:
        ok, why = verify_vendor(r, vloc, v["name"])
        v["typed_ok"], v["typed_note"] = ok, why
        log(f"  {v['name']!r:<45} {'OK ' if ok else 'NO '} {why}")

    r.new_record()          # leave a clean, unsaved draft behind
    if previous:
        seen_p = {p["code"] for p in products}
        products = products + [p for p in previous.get("products", []) if p["code"] not in seen_p]
        seen_v = {v["name"] for v in vendors}
        vendors = vendors + [v for v in previous.get("vendors", []) if v["name"] not in seen_v]
    snapshot = {
        "harvested_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "window": r.win.window_text(),
        "profile": a.profile,
        "products": products,
        "vendors": vendors,
    }
    out.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    usable_p = [p["code"] for p in products if p.get("typed_ok")]
    usable_v = [v["name"] for v in vendors if v.get("typed_ok")]
    log(f"== wrote {out}")
    log(f"== usable products (typed): {usable_p}")
    log(f"== usable vendors  (typed): {usable_v}")
    return 0 if usable_p and usable_v else 1


if __name__ == "__main__":
    raise SystemExit(main())
