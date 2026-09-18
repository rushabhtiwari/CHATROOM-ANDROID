"""Confirms receipt reading works after you add ANTHROPIC_API_KEY to backend/.env.

    cd backend
    .\.venv\Scripts\python.exe tools\check-extraction.py [path\to\receipt.pdf]

With no argument it builds a sample hotel invoice and reads that, so you can
verify the key without hunting for a file.
"""

from __future__ import annotations

import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

from app.config import EXTRACTION_MODEL, has_api_key  # noqa: E402
from app.extraction import extract  # noqa: E402
from app.store import store  # noqa: E402

SAMPLE_LINES = [
    (60, 780, 18, "TAJ VIVANTA PUNE"),
    (60, 758, 10, "Nagar Road, Pune 411014  |  GSTIN 27AABCT1234C1ZV"),
    (60, 720, 13, "TAX INVOICE"),
    (60, 698, 11, "Invoice No : TV-2026-44817"),
    (60, 682, 11, "Invoice Date : 04/09/2026"),
    (60, 666, 11, "Guest Name : Rohan Deshmukh"),
    (60, 650, 11, "Check-in  : 02/09/2026    Check-out : 04/09/2026"),
    (60, 634, 11, "Room Type : Deluxe King    Nights : 2"),
    (60, 600, 11, "Room Charges (2 nights)                       10,000.00"),
    (60, 582, 11, "Laundry Service                                  450.00"),
    (60, 564, 11, "CGST @ 9%                                        940.50"),
    (60, 546, 11, "SGST @ 9%                                        940.50"),
    (60, 520, 13, "GRAND TOTAL                            INR  12,331.00"),
    (60, 492, 10, "Payment Status : PAID IN FULL"),
]


def build_sample(target: Path) -> Path:
    """Writes a small, real PDF invoice with no third-party dependencies."""

    def esc(t: str) -> str:
        return t.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")

    stream = (
        "BT\n"
        + "".join(
            f"/F1 {size} Tf\n1 0 0 1 {x} {y} Tm\n({esc(text)}) Tj\n"
            for x, y, size, text in SAMPLE_LINES
        )
        + "ET\n"
    )
    data = zlib.compress(stream.encode("latin-1"))

    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length "
        + str(len(data)).encode()
        + b" /Filter /FlateDecode >>\nstream\n"
        + data
        + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>",
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"

    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n".encode() + b"0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode()

    target.write_bytes(bytes(out))
    return target


def main() -> int:
    if not has_api_key():
        print("No ANTHROPIC_API_KEY found.")
        print("Add it to backend/.env, then run this again:")
        print("    ANTHROPIC_API_KEY=sk-ant-...")
        return 1

    print(f"Key found. Reading with {EXTRACTION_MODEL}...\n")

    if len(sys.argv) > 1:
        path = Path(sys.argv[1])
        if not path.exists():
            print(f"No such file: {path}")
            return 1
    else:
        path = build_sample(Path(__file__).parent / "sample-invoice.pdf")
        print(f"Using generated sample: {path.name}\n")

    result = extract([path], store.policy_caps(), [path.name])

    if result["source"] != "claude":
        print(f"FAILED - fell back to '{result['source']}'")
        print(f"  {result.get('notes')}")
        return 1

    print(f"  Title      : {result['title']}")
    print(f"  Category   : {result['category']}")
    print(f"  Amount     : Rs {result['amount']:,.2f}")
    print(f"  Vendor     : {result['vendor']}")
    print(f"  Invoice    : {result['invoiceNumber']}  ({result['invoiceDate']})")
    print(f"  Dates      : {result['travelDates']}")
    print(f"  Confidence : {result['overallConfidence']:.0%}")
    if result["lineItems"]:
        print("  Line items :")
        for item in result["lineItems"]:
            print(f"      {item['description']:<32} Rs {item['amount']:>10,.2f}")
    if result["policyFindings"]:
        print("  Policy     :")
        for finding in result["policyFindings"]:
            print(f"      [{finding['severity']}] {finding['message']}")
    if result["notes"]:
        print(f"  Notes      : {result['notes']}")

    print("\nExtraction is live. The claim form will fill in from uploads.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
