"""Generate demo purchase orders that use REAL PACT master rows, so nothing mismatches.

    python tools/make_client_pos.py

Every vendor and product here comes from `demo/pact_master_snapshot.json` at the root of the
pact-automation checkout, which `scripts\\harvest_pact_master.py` writes by driving the live
PACT window: it walks each master with Down-then-Enter, reads the committed row back, and
then re-types every value the way the robot does on a real order and records whether it
resolved. Only rows marked `typed_ok` are used, because that is the only kind of row the
robot can reach during a fill - a name the lookup cannot filter to fails the draft at the
first field, and a code the product master does not hold leaves the grid blank.

Why the codes changed. The orders used to buy `44223`, which resolved on 2026-09-07 and had
stopped resolving by 2026-09-08 (the KPAC log shows the dropdown selecting nothing for it in
4.7 s on every attempt). The product master reachable on this screen is what the snapshot
says it is, and re-running the harvester is how to find out again.

Every order is written as a column table, even a two-line one, so the product code is read
off the document itself rather than defaulted. The rate is the one thing that will not
match: this PACT holds a master UnitPrice of 0 for these products and the column cannot be
typed on the Purchase Order screen, so PACT shows 0 whatever the order says. KPAC reads
that back and records it as a price note rather than pretending otherwise.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from make_demo_pos import _table, pdf_bytes  # noqa: E402

SELLER = "Kiran Cable Protection Products Pvt Ltd"

#: Written by scripts\harvest_pact_master.py in the pact-automation checkout.
SNAPSHOT = Path(__file__).resolve().parents[4] / "demo" / "pact_master_snapshot.json"

#: (PO number, buying company, city, quantities, transport, transporter, delivery, payment)
#:
#: The product codes are NOT written here. PACT filters the Product Code dropdown to the
#: selected vendor's own products - walked with no vendor every master row resolves, and
#: the same code then finds nothing once a vendor is in the header - so each order takes
#: its codes from the snapshot's `vendor_products` list for that vendor, one per quantity.
#: A vendor the snapshot has no typed-verified products for is skipped, loudly.
#: Transporter names deliberately avoid a 'Ltd' ending - a line ending in Ltd is matched
#: by the customer-name pattern before the signature line is.
ORDERS = [
    ("PO-MKI-2026-201", "M.K.INDUSTRIES", "Bengaluru", [250, 150],
     "BY ROAD", "VRL Logistics", "EX WORKS", "30 DAYS"),
    ("PO-BRT-2026-202", "M/s B R Traders", "Hubballi", [400, 60],
     "BY ROAD", "TCI Freight", "FOR DESTINATION", "45 DAYS"),
    # The multi-line one: three lines, one PACT document, one Save Draft.
    ("PO-MRE-2026-203", "M.r. Enterprises", "Mysuru", [120, 200, 80],
     "BY ROAD", "Gati Express", "EX WORKS", "60 DAYS"),
    ("PO-MJC-2026-204", "M.J.COMFORT", "Mangaluru", [90, 45],
     "BY ROAD", "Safexpress", "FOR DESTINATION", "30 DAYS"),
    ("PO-AWI-2026-205", "M/s Accurate Weight Industries", "Belagavi", [300, 100],
     "BY RAIL", "Blue Dart", "EX WORKS", "45 DAYS"),
    ("PO-MAM-2026-103", "M.a. Mannan Silk Lining House", "Mysuru", [120, 200, 80],
     "BY ROAD", "Gati Express", "EX WORKS", "60 DAYS"),
]

#: `M K MOBILES PRIVATE LIMITED` and `M S Enterpries` used to be here and are gone on
#: purpose. Both resolved on 2026-09-07; on 2026-09-08 neither is reachable through the
#: lookup any more - typing `M K` or `M S` leaves the combo with nothing selected, and
#: Down+Enter on that unfiltered list lands on `M.a. Mannan Silk Lining House`, a real but
#: completely different company. That is exactly the near-match the robot refuses to
#: accept, so an order for either name now fails at the first field. Re-run the harvester
#: if they come back.

#: The rate each order states, per unit. PACT holds 0 - see the module docstring.
STATED_RATE = 96.5


def load_snapshot() -> tuple[dict[str, dict], dict[str, list[str]]]:
    """Products by code, and the typed-verified codes per vendor (`vendor_products`)."""
    if not SNAPSHOT.exists():
        raise SystemExit(f"no snapshot at {SNAPSHOT} - run scripts\\harvest_pact_master.py first")
    data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    products = {p["code"]: p for p in data.get("products", [])}
    by_vendor = {
        vendor: [code for code in codes if code in products]
        for vendor, codes in (data.get("vendor_products") or {}).items()
    }
    return products, {vendor: codes for vendor, codes in by_vendor.items() if codes}


def _mailbox(company: str) -> str:
    return "purchase@" + (re.sub(r"[^a-z0-9]", "", company.lower()) or "customer") + ".example"


def build_lines(products, po_number, company, city, order_lines, transport, transporter, delivery, payment):
    today = date.today()
    delivery_on = today + timedelta(days=41)

    rows = []
    for index, (code, quantity) in enumerate(order_lines, start=1):
        product = products[code]
        # Quotes and parentheses are fine in a PDF string but noisy in a demo document.
        description = re.sub(r'["()]', "", product["name"]).strip()
        unit = product.get("units") or "NOS"
        rows.append((index, code, description, quantity, unit, STATED_RATE, quantity * STATED_RATE))

    return [
        ("head", "PURCHASE ORDER"),
        ("", ""),
        ("bold", company),
        ("", f"{city}, Karnataka, India"),
        ("", "Email: " + _mailbox(company)),
        ("", ""),
        ("bold", f"To: {SELLER}"),
        ("", ""),
        ("", f"PO number: {po_number}"),
        ("", f"PO date: {today.strftime('%d-%b-%Y')}"),
        ("", f"Delivery: {delivery_on.strftime('%Y-%m-%d')}"),
        ("", ""),
        ("bold", "Please supply the following against this purchase order."),
        ("", ""),
    ] + _table(rows) + [
        ("", ""),
        ("bold", "Terms"),
        ("", f"Delivery terms: {delivery}"),
        ("", f"Payment terms: {payment}"),
        ("", f"Mode of transport: {transport}"),
        ("", f"Transporter: {transporter}"),
        ("", "Packing: Wooden crates, palletised"),
        ("", f"Ship to: {company}, {city}"),
        ("", ""),
        ("", "Kindly acknowledge receipt of this order."),
        ("", ""),
        # The signature line the extractor reads the customer from. It has to be the last
        # "For ..." line in the document and it has to be exactly the PACT master spelling.
        ("", "For " + company),
        ("", "Purchase Department"),
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(Path(__file__).resolve().parents[1] / "demo-pos"))
    args = parser.parse_args()

    products, by_vendor = load_snapshot()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    from app.mailing_extraction import find_customer_name, find_line_items
    from app.pdf_text import extract_text

    print(f"\nSnapshot: {SNAPSHOT}")
    print(f"  {len(by_vendor)} vendor(s) with products that resolve when typed\n")
    print(f"Writing to {out}\n")
    ok_all = True
    for po_number, company, city, quantities, transport, transporter, delivery, payment in ORDERS:
        codes = by_vendor.get(company, [])
        if not codes:
            print(f"  {po_number:<18} SKIPPED - the snapshot has no typed-verified products for "
                  f"{company!r}; run harvest_pact_master.py --per-vendor")
            ok_all = False
            continue
        # One code per line, cycling through the vendor's list: a vendor with a single
        # product still gets a multi-line order, as separate delivery lots of it.
        order_lines = [(codes[i % len(codes)], qty) for i, qty in enumerate(quantities)]
        lines = build_lines(products, po_number, company, city, order_lines,
                            transport, transporter, delivery, payment)
        data = pdf_bytes(lines)
        path = out / f"{po_number}.pdf"
        path.write_bytes(data)

        # Read it back through the pipeline's own extractor. A PDF this system cannot read
        # is not a demo asset - and the customer name and every code have to be exact.
        text = extract_text(data)
        seen_name = find_customer_name(text)
        read = find_line_items(text)
        codes_ok = [r["productCode"] for r in read] == [c for c, _ in order_lines]
        qty_ok = [int(r["quantity"]) for r in read] == [q for _, q in order_lines]
        ok = po_number in text and seen_name == company and codes_ok and qty_ok
        ok_all = ok_all and ok

        print(f"  {path.name:<22} {'OK ' if ok else 'BAD'}  {len(data):>5} bytes")
        print(f"      customer read back : {seen_name!r}")
        print(f"      lines              : {len(order_lines)} written, {len(read)} table row(s) read")
        for code, qty in order_lines:
            print(f"                           {code:<16} x {qty:>5,} {products[code].get('units', '')}  {products[code]['name'][:40]}")
        if not ok:
            print("      !! the extractor did not read this back correctly")

    print("\n  Subject line for each:   Kiran Order <PO number>")
    print("  Send to:                 anzarsk098@gmail.com\n")
    return 0 if ok_all else 1


if __name__ == "__main__":
    raise SystemExit(main())
