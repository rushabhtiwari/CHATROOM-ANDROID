"""Generate the demo purchase-order PDFs.

    python tools/make_demo_pos.py                 # four PDFs into backend/demo-pos/
    python tools/make_demo_pos.py --out C:\\temp   # somewhere else

One per demo customer, each already carrying every field the PACT Purchase Order screen
asks for — so the pipeline fills that form from the document rather than from defaults:

    PO number, PO date            -> party_ref_no, party_ref_date
    Customer name                 -> the party lookup (must be in PACT's master)
    Product code, quantity, rate  -> the GrdBody grid row
    Delivery / payment terms      -> the Extra Fields tab
    Mode of transport, transporter
    Delivery date

The product codes are real. `46893` and `42010` were read off the live PACT window and
their provenance is in `C:\\Users\\prach\\pact-automation\\demo\\discovered_values.md`;
neither is invented, because a code PACT does not have fails the row.

## Why the PDF is written by hand

`pdf_text.py` reads text out of a PDF with nothing but `zlib`, and this writes one the same
way. No reportlab, no wheels to install the morning of a demo. The content streams are left
**uncompressed** on purpose: the document is meant to be read back by the extractor, and a
plain stream makes that exact rather than probable — and lets you `strings` the file when
something looks wrong.

The layout is deliberately plain. This is a document a machine reads; making it pretty
would add drawing operators and nothing else.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.demo_customers import DEMO_CUSTOMERS  # noqa: E402

SELLER = "Kiran Cable Protection Products Pvt Ltd"

# Product code -> (description, unit, rate PACT applies). Read off the live window.
PRODUCTS = {
    "46893": ("PET MONOFILAMENT YARN 0.22MM BLACK FR 250 DIN", "KGS", 265.0),
    "42010": ("SYNTHETIC MONOFILMENT YARN 0.25MM NATURAL WHITE FR", "KGS", 240.0),
}

# One order per customer.
#
# The quantities are chosen against the Rs 5,00,000 staff approval gate
# (`mailing_workflow.APPROVAL_GATE_VALUE`), not at random. Three sit below it and run
# straight to the customer; the Nilkanth order sits above it deliberately, so the demo can
# show that a large order still stops for a reviewer before it ever reaches the customer.
# Both gates are worth showing, and they are different gates.
# `lines` is a list of (product code, quantity). Every entry becomes a row in the
# document's line-item table, and every row becomes a row in the PACT grid of the ONE
# document that order produces. A one-entry list writes the single-line prose layout
# instead, which is the shape most orders on this desk actually arrive in.
ORDERS = [
    # 1,800 x 265  = Rs 4,77,000   below the large-order mark - the one to walk through
    ("PO-MEG-2026-014", [("46893", 1800)], "BY ROAD", "VRL Logistics", "EX WORKS", "30 DAYS"),
    # 1,500 x 240  = Rs 3,60,000
    ("PO-SAH-2026-221", [("42010", 1500)], "BY ROAD", "TCI Freight", "FOR DESTINATION", "45 DAYS"),
    # 900 x 265    = Rs 2,38,500
    ("PO-VAI-2026-063", [("46893", 900)], "BY AIR", "Blue Dart", "EX WORKS", "15 DAYS"),
    # 4,000 x 240  = Rs 9,60,000   above the large-order mark
    ("PO-NIL-2026-108", [("42010", 4000)], "BY ROAD", "Gati Ltd", "FOR DESTINATION", "60 DAYS"),
]

# The multi-line order. This is the document that proves the claim the whole pipeline
# rests on: one purchase order, however many lines, becomes ONE PACT document with one
# grid row per line and ONE Save Draft.
#   1,200 x 265 = Rs 3,18,000
#     800 x 240 = Rs 1,92,000
#     600 x 265 = Rs 1,59,000   ->  Rs 6,69,000 over three lines
MULTI_LINE_ORDER = (
    "PO-MEG-2026-015",
    [("46893", 1200), ("42010", 800), ("46893", 600)],
    "BY ROAD",
    "VRL Logistics",
    "EX WORKS",
    "30 DAYS",
)


# --------------------------------------------------------------------------- #
# The document                                                                 #
# --------------------------------------------------------------------------- #


def build_lines(customer, po_number, order_lines, transport, transporter, delivery, payment):
    today = date(2026, 9, 4)
    delivery_on = today + timedelta(days=41)

    rows = []
    for index, (code, quantity) in enumerate(order_lines, start=1):
        description, unit, rate = PRODUCTS[code]
        rows.append((index, code, description, quantity, unit, rate, quantity * rate))

    # Every label is one the extractor or a human reader looks for. The four the pipeline
    # actually parses - PO number, quantity, value, delivery date - are written in the
    # exact shapes `mailing_extraction`'s patterns expect, which is why this file and that
    # one have to change together.
    return [
        ("head", "PURCHASE ORDER"),
        ("", ""),
        ("bold", customer.name),
        ("", f"{customer.city}, Maharashtra, India"),
        ("", f"Email: {customer.contact_email}"),
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
        ("", f"Packing: Wooden crates, palletised"),
        ("", f"Ship to: {customer.name}, {customer.city}"),
        ("", ""),
        ("", "Kindly acknowledge receipt of this order."),
        ("", ""),
        ("", "For " + customer.name),
        ("", "Purchase Department"),
    ]


def _table(rows) -> list[tuple[str, str]]:
    """The line-item block.

    A single-line order is written the way this desk's customers actually write one -
    `Quantity:` / `Rate:` / `Value:` in prose - because that is the shape the extractor
    has to cope with in the field. Two or more lines are written as a column table, which
    `mailing_extraction.LINE_ROW_PATTERN` reads. Both end up as the same `lineItems` list,
    which is the point: one shape reaches PACT whatever the document looked like.

    The columns are separated by runs of two or more spaces on purpose - that is what
    stops a description containing single spaces being mistaken for the figures.
    """
    if len(rows) == 1:
        index, code, description, quantity, unit, rate, value = rows[0]
        return [
            ("bold", "Sr  Product code   Description"),
            ("", f"{index}   {code}          {description}"),
            ("", ""),
            ("", f"Quantity: {quantity:,} {unit}"),
            ("", f"Unit: {unit}"),
            ("", f"Rate: Rs {rate:,.2f} per {unit}"),
            ("", f"Value: Rs {value:,.2f}"),
        ]

    header = (
        f"{'Sr':<4}{'Product code':<15}{'Description':<40}"
        f"{'Qty':>9}  {'Unit':<6}{'Rate':>10}{'Value':>16}"
    )
    out = [("bold", header)]
    for index, code, description, quantity, unit, rate, value in rows:
        out.append(
            (
                "",
                f"{index:<4}{code:<15}{description[:38]:<40}"
                f"{quantity:>9,}  {unit:<6}{rate:>10,.2f}{value:>16,.2f}",
            )
        )
    out += [
        ("", ""),
        ("", f"Quantity: {sum(r[3] for r in rows):,} {rows[0][4]}"),
        ("", f"Total value: Rs {sum(r[6] for r in rows):,.2f}"),
    ]
    return out


def pdf_bytes(lines: list[tuple[str, str]]) -> bytes:
    """A one-page PDF with an uncompressed content stream."""
    top, left, leading = 780.0, 56.0, 15.5
    parts: list[str] = ["BT"]
    y = top
    font = None
    for style, text in lines:
        size = 16 if style == "head" else 10.5
        want = "/F2" if style in ("head", "bold") else "/F1"
        if (want, size) != font:
            parts.append(f"{want} {size} Tf")
            font = (want, size)
        if text:
            parts.append(f"1 0 0 1 {left:.2f} {y:.2f} Tm ({_escape(text)}) Tj")
        y -= leading * (1.6 if style == "head" else 1.0)
    parts.append("ET")
    content = "\n".join(parts).encode("latin-1", errors="replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"

    start = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{start}\n".encode()
        + b"%%EOF\n"
    )
    return bytes(out)


def _escape(text: str) -> str:
    return text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parents[1] / "demo-pos"),
        help="where to write the PDFs",
    )
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    # Proves the loop closes: what is written must read back through the same extractor
    # the pipeline uses. A PDF the pipeline cannot read is not a demo asset.
    from app.mailing_extraction import find_line_items
    from app.pdf_text import extract_text

    print(f"\nWriting to {out}\n")
    jobs = list(zip(DEMO_CUSTOMERS, ORDERS))
    # The multi-line order goes to the first demo customer, alongside their single-line one.
    jobs.append((DEMO_CUSTOMERS[0], MULTI_LINE_ORDER))
    for customer, order in jobs:
        po_number, order_lines, transport, transporter, delivery, payment = order
        lines = build_lines(
            customer, po_number, order_lines, transport, transporter, delivery, payment
        )
        data = pdf_bytes(lines)
        # No "scan", "photo", "fax" or "whatsapp" in the name - those force the pipeline's
        # OCR-failure branch, deliberately.
        path = out / f"{po_number}.pdf"
        path.write_bytes(data)

        # Proves the loop closes twice over: the text must come back out, and the
        # extractor must find exactly as many line items as the document was written with.
        text = extract_text(data)
        total_qty = sum(q for _, q in order_lines)
        # A single-line order is written in prose and has no table to find - `extract()`
        # synthesises its one line from the fields instead, so 0 rows here is correct for
        # it. A multi-line order must read back row for row.
        read = find_line_items(text)
        expected = len(order_lines) if len(order_lines) > 1 else 0
        ok = po_number in text and f"{total_qty:,} m" in text and len(read) == expected
        print(f"  {path.name:<24} {len(data):>6} bytes   readable: {'YES' if ok else 'NO'}")
        print(f"      {customer.name}")
        for code, quantity in order_lines:
            print(f"      product {code} x {quantity:,} m")
        shape = "table" if len(order_lines) > 1 else "prose (one line)"
        print(f"      {len(order_lines)} line(s) written as {shape}, {len(read)} row(s) read back")
        if not ok:
            print("      !! the extractor could not read this back")

    print(
        "\nSubject line to use:  Kiran Order <PO number>\n"
        "Attach one PDF per message. Send from any Gmail address.\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
