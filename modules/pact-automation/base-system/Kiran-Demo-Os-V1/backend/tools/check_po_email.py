"""Will this purchase-order email make it through the pipeline?

Run it against a draft *before* asking somebody to send it, so a recording is not spent
discovering that the extractor could not find a delivery date.

    python tools/check_po_email.py --from buyer@acme.com --file draft.txt
    python tools/check_po_email.py --template          # print one that is known to work

It reports on the four things that actually decide the outcome, in the order the pipeline
applies them:

  1. **The sender's domain.** Unknown senders are quarantined before extraction is even
     attempted — deliberately, so a stranger never costs a model call. Fixable in the
     console, and it is a good thing to show rather than avoid.
  2. **A PDF attachment.** Its absence costs 0.18 of confidence, which drops a typical
     message below the 0.85 floor and parks it as LOW_CONFIDENCE.
  3. **The four fields.** PO number, quantity, value and delivery date each have to match a
     pattern. A missing delivery date is the single most common cause of an AMBIGUOUS_DATE
     exception, because it is the field people leave to "as discussed".
  4. **PACT's master.** The name the order resolves to has to exist in PACT's vendor
     master, spelled identically, or the push fails by design.

Nothing here writes to the ledger; it only reads the same patterns the extractor does.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import mailing_extraction as extraction  # noqa: E402
from app import mailing_workflow as flow  # noqa: E402
from app.demo_customers import is_in_pact_master, master_map  # noqa: E402
from app.mailing_store import domain_of, mailing_store  # noqa: E402

TEMPLATE_SUBJECT = "Purchase Order PO-ACM-2026-014"

TEMPLATE_BODY = """Dear Sir,

Please supply 12,000 m of cable protection sleeving against this purchase order.

PO number: PO-ACM-2026-014
Quantity: 12,000 m
Value: Rs 1,80,000
Delivery: 2026-10-15

Kindly acknowledge receipt.

Regards,
Purchase Department
Acme Engineering Pvt Ltd
"""

RULE = "-" * 78


def check(subject: str, body: str, sender: str, has_pdf: bool, pdf_name: str) -> int:
    print(f"\n{RULE}\nWill this get through?\n{RULE}")
    problems: list[str] = []

    # ---- 1. the sender -----------------------------------------------------
    domain = domain_of(sender)
    known = mailing_store.is_known_domain(sender)
    row = mailing_store.domain(domain)
    company = (row or {}).get("companyName")

    print("\n1. The sender")
    print(f"   address            {sender}")
    print(f"   domain             {domain}")
    if known:
        print(f"   known              YES -> reads as '{company}'")
    else:
        print("   known              NO  -> will be QUARANTINED as UNKNOWN_DOMAIN")
        print("                      Fix: On Hold queue -> Whitelist, and give the company")
        print("                      name PACT's vendor master actually contains.")
        problems.append("the sender's domain is not whitelisted")

    # ---- 2. the attachment -------------------------------------------------
    print("\n2. The attachment")
    if not has_pdf:
        print("   PDF                NO  -> costs 0.18 confidence; likely LOW_CONFIDENCE")
        problems.append("no PDF attachment")
    else:
        degraded = any(hint in pdf_name.lower() for hint in extraction.DEGRADED_HINTS)
        print(f"   PDF                YES ({pdf_name})")
        if degraded:
            print("   filename           LOOKS PHOTOGRAPHED -> forces the OCR_FAILURE branch")
            print(f"                      Avoid: {', '.join(extraction.DEGRADED_HINTS)}")
            problems.append(f"the filename {pdf_name!r} reads as a photographed original")
        else:
            print("   filename           fine")

    # ---- 3. the four fields ------------------------------------------------
    print("\n3. What the extractor can find")
    po = extraction.find_po_number(subject, body, [])
    quantity, _ = extraction._find(extraction.QTY_PATTERN, body, subject)
    value, _ = extraction._find(extraction.VALUE_PATTERN, body, subject)
    import re

    date = re.search(r"(\d{1,2}[-/ ][A-Za-z]{3,9}[-/ ]\d{2,4}|\d{4}-\d{2}-\d{2})", body or "")

    markers = [m for m in extraction.ORDER_MARKERS if m in f"{subject}\n{body}".lower()]

    field("order markers", ", ".join(markers) if markers else None,
          "none - the message will not read as an order at all", problems)
    field("PO number", po, "no PO number matched. Use the shape PO-ABC-2026-001", problems)
    field("quantity", quantity and f"{quantity} m", "no quantity matched. Write it as '12,000 m'", problems)
    field("value", value and f"Rs {value}",
          "no value matched. Write it as 'Rs 1,80,000' or 'INR 180000'", problems)
    field("delivery date", date.group(1) if date else None,
          "NO DATE -> AMBIGUOUS_DATE exception. Write it as '2026-10-15' or '15-Oct-2026'",
          problems)

    # ---- 4. PACT's master --------------------------------------------------
    print("\n4. PACT's vendor master")
    if not known:
        print("   customer           unknown until the domain is whitelisted")
        print("                      Whatever name you whitelist it as is what PACT must")
        print("                      resolve, so choose one that is already in the master.")
    elif is_in_pact_master(company):
        print(f"   customer           '{company}' -> resolves")
    else:
        print(f"   customer           '{company}' -> NOT in PACT's master")
        print("                      The PACT step will fail with:")
        print(f"                        customer not in PACT master: {company}")
        print("                      Fix, either one:")
        print(f"                        - add '{company}' to PACT's vendor master, or")
        print(f"                        - PACT_MASTER_MAP={company}=<a name that is in it>")
        print(f"                      In the master today: {', '.join(sorted(master_map().values()))}")
        problems.append(f"'{company}' is not in PACT's vendor master")

    # ---- verdict -----------------------------------------------------------
    print(f"\n{RULE}")
    if not problems:
        print("READY. This will run straight to the customer gate.")
    else:
        print(f"{len(problems)} thing(s) to sort out first:")
        for index, problem in enumerate(problems, 1):
            print(f"  {index}. {problem}")
    print(f"{RULE}\n")
    return 0 if not problems else 1


def field(label: str, found, advice: str, problems: list[str]) -> None:
    if found:
        print(f"   {label:<18} {found}")
    else:
        print(f"   {label:<18} MISSING - {advice}")
        problems.append(f"no {label}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from", dest="sender", default="", help="the sender's address")
    parser.add_argument("--subject", default=TEMPLATE_SUBJECT)
    parser.add_argument("--file", help="a text file holding the body")
    parser.add_argument("--no-pdf", action="store_true", help="check as if nothing is attached")
    parser.add_argument("--pdf-name", default="purchase-order.pdf")
    parser.add_argument("--template", action="store_true", help="print a body known to work")
    args = parser.parse_args()

    if args.template:
        print(f"\nSubject: {TEMPLATE_SUBJECT}\n")
        print(TEMPLATE_BODY)
        print("Attach a PDF named something like purchase-order.pdf.")
        print("Avoid filenames containing: " + ", ".join(extraction.DEGRADED_HINTS) + "\n")
        return 0

    body = Path(args.file).read_text(encoding="utf-8") if args.file else TEMPLATE_BODY
    sender = args.sender or "buyer@acme.example"
    return check(args.subject, body, sender, not args.no_pdf, args.pdf_name)


if __name__ == "__main__":
    raise SystemExit(main())
