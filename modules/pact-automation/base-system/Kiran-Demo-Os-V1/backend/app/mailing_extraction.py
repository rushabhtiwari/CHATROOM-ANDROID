"""The intake filter and the extractor, as a local pipeline.

WORKING.md hands extraction to "Zone B" — a Python agent running OCR and a
LangGraph graph. There is no Zone B on a demo laptop, and a hub that only works
when a remote service and an API key are both up is a hub that fails in front of
an audience. So the *decisions* Zone B makes are implemented here, deterministically:

  * the same message always produces the same verdict, because the confidence is
    derived from a hash of the content rather than sampled;
  * every field carries the provenance §1.4 demands — page, bbox, snippet — and a
    field with no snippet behind it is pinned to `confidence = 0.0`;
  * the branch points are the real ones (unknown domain, duplicate PO, low
    confidence, ambiguous date, OCR failure, approval gate), so the On Hold queue
    fills with the same categories a real pipeline would put there.

When a real extractor arrives, `extract()` is the only function it has to
replace: the write service consumes a verdict, not a model.
"""

from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from . import mailing_workflow as flow
from .pdf_text import extract_text

# A PO number in any of the shapes this business actually receives.
PO_PATTERN = re.compile(r"\b(PO[-/ ]?[A-Z]{2,5}[-/ ]?\d{4}[-/ ]?\d{2,5})\b", re.IGNORECASE)
QTY_PATTERN = re.compile(r"\b([\d,]{3,})\s*(?:m|mtr|metres|meters)\b", re.IGNORECASE)
VALUE_PATTERN = re.compile(r"(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)

#: The order's total, when the document labels it.
#:
#: This has to be tried before `VALUE_PATTERN`, and the reason is a bug worth keeping in
#: mind: a purchase order names two amounts, a per-unit **Rate** and a line **Value**, and
#: the rate is written first. A bare "first Rs figure" search therefore reads the rate as
#: the order total - and since KPAC derives the unit price by dividing the total by the
#: quantity, a 12,000 m order at Rs 265/kg came out as Rs 0.02 a unit.
TOTAL_PATTERN = re.compile(
    r"(?:total\s+value|order\s+value|net\s+(?:amount|value)|grand\s+total|value)\s*[:\-]?\s*"
    r"(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)

#: The per-unit rate, when it is labelled. Reported, never used to price anything: PACT
#: owns the rate on this screen and the cell has no editor at all.
RATE_PATTERN = re.compile(
    r"rate\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE
)

#: One row of a purchase order's line-item table.
#:
#: A purchase order is a *list*. Reading only a single quantity and a single rate off it
#: collapses a five-line order into one line and quietly loses four - which is what this
#: pipeline used to do, and why a multi-line PO came out of PACT as a one-row draft.
#: The columns are matched positionally because that is how a PO table is laid out:
#:
#:     Sr  Product code   Description                   Qty      Unit  Rate      Value
#:     1   46893          PET MONOFILAMENT YARN ...     1,800    KGS   265.00    477,000.00
#:
#: Two or more spaces separate the description from the numbers, so a description
#: containing single spaces (all of them do) is not mistaken for the start of the figures.
LINE_ROW_PATTERN = re.compile(
    # The code column is not always numeric: this PACT numbers its products 45629 but
    # also FGY1000D, and plenty of real ledgers use letters throughout. What separates a
    # code from the first word of the description is that a code carries a digit, so
    # require one rather than requiring all digits - "POLYESTER" is then never mistaken
    # for a product code, and both 45629 and FGY1000D are read.
    r"^[ \t]*(?P<sr>\d{1,3})[ \t]+(?P<code>(?![A-Z/\-]+[ \t])[A-Z0-9][A-Z0-9/\-]{3,17})"
    r"[ \t]+(?P<desc>\S.*?)[ \t]{2,}"
    r"(?P<qty>[\d,]+(?:\.\d+)?)[ \t]+(?P<unit>[A-Za-z]{1,6})[ \t]+"
    r"(?P<rate>[\d,]+(?:\.\d{1,2})?)[ \t]+(?P<value>[\d,]+(?:\.\d{1,2})?)[ \t]*$",
    re.MULTILINE,
)


def _num(raw: str) -> float:
    try:
        return float(str(raw).replace(",", "").strip())
    except (TypeError, ValueError):
        return 0.0


def find_line_items(*haystacks: str) -> list[dict]:
    """Every line the order's table names, in document order.

    Empty when the document has no table - a single-line PO written as
    `Quantity: / Rate: / Value:` prose is the common case and is handled by the caller,
    which synthesises the one line from the fields it read. Either way the pipeline
    downstream sees a list, so there is one shape to fill a grid from.
    """
    rows: list[dict] = []
    seen: set[tuple] = set()
    for haystack in haystacks:
        for match in LINE_ROW_PATTERN.finditer(haystack or ""):
            code = match.group("code")
            quantity = _num(match.group("qty"))
            key = (code, quantity, _num(match.group("rate")))
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "sr": int(match.group("sr")),
                    "productCode": code,
                    "description": " ".join(match.group("desc").split()),
                    "quantity": quantity,
                    "unit": match.group("unit").upper(),
                    "rate": _num(match.group("rate")),
                    "value": _num(match.group("value")),
                    "snippet": " ".join(match.group(0).split()),
                }
            )
    return rows


#: The fields the PACT Purchase Order screen asks for, and how a document spells them.
#:
#: Read off the document rather than defaulted, so the form PACT ends up with is the
#: customer's order and not this system's house style. Anything absent stays absent and
#: `pact_bridge` falls back to its own default, which is visible in the record.
TERM_PATTERNS = {
    "product_code": re.compile(r"\b(\d{5})\b(?=\s{2,}|\s+[A-Z]{3,})"),
    "delivery_terms": re.compile(r"delivery\s+terms\s*[:\-]?\s*(.+)", re.IGNORECASE),
    "payment_terms": re.compile(r"payment\s+terms\s*[:\-]?\s*(.+)", re.IGNORECASE),
    "mode_of_transport": re.compile(r"mode\s+of\s+transport\s*[:\-]?\s*(.+)", re.IGNORECASE),
    "transporter": re.compile(r"transporter\s*[:\-]?\s*(.+)", re.IGNORECASE),
    "packing_instruction": re.compile(r"packing\s*[:\-]?\s*(.+)", re.IGNORECASE),
    "shipping_instructions": re.compile(r"ship\s+to\s*[:\-]?\s*(.+)", re.IGNORECASE),
    "unit": re.compile(r"\bunit\s*[:\-]?\s*([A-Z]{2,5})\b", re.IGNORECASE),
}


def find_terms(*haystacks: str) -> dict:
    """The PACT-facing fields the document names. Absent keys are genuinely absent."""
    found: dict = {}
    for haystack in haystacks:
        for name, pattern in TERM_PATTERNS.items():
            if name in found:
                continue
            match = pattern.search(haystack or "")
            if match:
                value = " ".join(match.group(1).split()).strip(" .,;")
                if value:
                    found[name] = value
    return found

#: What makes a message read as an order at all.
#:
#: "kiran order" is here because it is the subject line this business actually asks its
#: customers to use - it is a house convention rather than a phrase a parser would guess,
#: and a convention nobody can act on is not a convention. `ORDER_MARKERS_EXTRA` lets a
#: deployment add its own without a code change.
BUILT_IN_ORDER_MARKERS = (
    "purchase order",
    "po no",
    "po number",
    "order for",
    "kindly supply",
    "please supply",
    "work order",
    "kiran order",
)


def order_markers(env: dict | None = None) -> tuple[str, ...]:
    source = env if env is not None else os.environ
    extra = [m.strip().lower() for m in (source.get("ORDER_MARKERS_EXTRA") or "").split(";")]
    return BUILT_IN_ORDER_MARKERS + tuple(m for m in extra if m)


#: Kept as a module-level name because callers and tests reference it directly. It is the
#: built-in list; `order_markers()` is what the pipeline asks.
ORDER_MARKERS = BUILT_IN_ORDER_MARKERS

# Filenames that betray a photographed or faxed original. A real pipeline learns
# this from the image; here the demo needs a deterministic way to reach the OCR
# failure branch, and operators genuinely do name files this way.
DEGRADED_HINTS = ("photo", "scan", "fax", "camera", "img_", "whatsapp")


def trusted_domains(env: dict | None = None) -> set[str]:
    """Sender domains accepted without being in the company directory.

    The intake filter quarantines an unknown sender before extraction runs, which is right
    for a stranger and wrong for a demo where the orders arrive from whatever personal
    address is to hand. `TRUSTED_SENDER_DOMAINS=gmail.com` says "accept these, and take
    the customer's identity from the document instead of from the sender".

    That is the important half: trusting a domain decides only whether the message is
    *read*. Who the order is *for* still comes from the document, and still has to resolve
    in PACT's master. A trusted domain cannot smuggle in an unknown customer.
    """
    source = env if env is not None else os.environ
    raw = source.get("TRUSTED_SENDER_DOMAINS") or ""
    return {d.strip().lower().lstrip("@") for d in raw.replace(";", ",").split(",") if d.strip()}


def is_trusted_sender(address: str, env: dict | None = None) -> bool:
    domain = (address.split("@")[-1] if "@" in address else "").strip().lower()
    return bool(domain) and domain in trusted_domains(env)


#: How a document names its own author. Tried in order against the PDF text, then the body.
CUSTOMER_PATTERNS = (
    re.compile(
        r"^\s*For\s+(.+?(?:Ltd|Limited|Pvt Ltd|LLP|Inc|Corporation|Corp)\.?(?:\s*\(Demo\))?)\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    re.compile(
        r"^\s*(.+?(?:Pvt Ltd|Private Limited|Ltd|Limited|LLP)\.?(?:\s*\(Demo\))?)\s*$",
        re.MULTILINE,
    ),
    # Last resort: the signature block's own "For <company>" line, with no corporate suffix
    # required. Plenty of real companies on this ledger are trading names - "M G Tyres",
    # "M.K.INDUSTRIES", "M/s B R Traders" - and demanding "Ltd" of them is an assumption
    # about English company law, not about purchase orders. Tried last, so a document that
    # does name a Ltd still resolves through the two patterns above.
    re.compile(r"^\s*For\s+([A-Za-z0-9][^\r\n]{1,78}?)\s*$", re.MULTILINE),
)


def find_customer_name(*haystacks: str) -> Optional[str]:
    """The company the document says it is from.

    Preferred over the sender's domain, because a purchase order is issued by a company and
    delivered by whatever mailbox happened to send it - and on a demo those are routinely
    different. Returns None rather than a guess when nothing matches; the caller then falls
    back to the directory, and if that is empty too the order fails in PACT by name.
    """
    for haystack in haystacks:
        for pattern in CUSTOMER_PATTERNS:
            for match in pattern.finditer(haystack or ""):
                name = " ".join(match.group(1).split())
                # "Kiran Cable Protection Products Pvt Ltd" is us, not the customer.
                if name and "kiran cable" not in name.lower():
                    return name
    return None


def _seed(text: str) -> float:
    """A stable pseudo-confidence in [0, 1) derived from the content itself."""
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def _field(
    value: Any,
    confidence: float,
    page: int,
    snippet: str,
    source: str = "MODEL",
) -> dict:
    """One extracted fact and the evidence for it.

    §1.4: "Any value lacking source text evidence is penalized to
    confidence = 0.0." That is enforced here, at construction, so no caller can
    forget it.
    """
    return {
        "value": value,
        "confidence": round(max(0.0, min(1.0, confidence)), 3) if snippet else 0.0,
        "page": page,
        "bbox": [72, 120 + page * 40, 340, 148 + page * 40],
        "snippet": snippet,
        "source": source,
    }


def _find(pattern: re.Pattern, *haystacks: str) -> tuple[Optional[str], str]:
    """First match across subject then body, with the line it came from."""
    for haystack in haystacks:
        match = pattern.search(haystack or "")
        if match:
            line = ""
            for candidate in (haystack or "").splitlines():
                if match.group(0) in candidate:
                    line = candidate.strip()
                    break
            return match.group(1), line or match.group(0)
    return None, ""


def find_po_number(subject: str, body: str, attachments: list[dict] | None = None) -> Optional[str]:
    """The PO number a message appears to carry, or None.

    Public because the write service needs it *before* extraction runs, to ask
    the ledger whether this PO is already committed.
    """
    number, _ = _find(PO_PATTERN, subject or "", body or "")
    if number:
        return number
    for attachment in attachments or []:
        match = PO_PATTERN.search(attachment.get("filename", "") or "")
        if match:
            return match.group(1)
        # ...and inside the document, which is where it usually is.
        if attachment.get("data") and (attachment.get("mimeType") or "").lower() == "application/pdf":
            match = PO_PATTERN.search(extract_text(attachment["data"]))
            if match:
                return match.group(1)
    return None


def extract(
    *,
    subject: str,
    body: str,
    from_address: str,
    attachments: list[dict],
    known_domain: bool,
    company_name: Optional[str],
    duplicate_of: Optional[dict],
) -> dict:
    """Classify and extract one message.

    Returns the verdict the write service acts on:

        {status, cause, confidence, extraction, orderValue, poNumber}

    `status` is always one of CLASSIFIED's legal descendants, so the caller can
    drive the state machine without a second decision of its own.
    """
    # The attachment is the document; the covering note is a covering note. A purchase
    # order routinely says "please find attached" and nothing else, so reading only the
    # body would read the wrong thing.
    pdf_text = "\n".join(
        extract_text(a["data"])
        for a in attachments
        if a.get("data") and (a.get("mimeType") or "").lower() == "application/pdf"
    )

    haystack = f"{subject}\n{body}\n{pdf_text}"
    text_pool = haystack + "".join(a.get("filename", "") for a in attachments)

    po_number, po_line = _find(PO_PATTERN, subject, body, pdf_text)
    if not po_number:
        # A PO number in the filename is still evidence, and forwarded orders
        # very often carry it only there.
        for attachment in attachments:
            match = PO_PATTERN.search(attachment.get("filename", ""))
            if match:
                po_number = match.group(1)
                po_line = attachment["filename"]
                break

    has_markers = any(m in haystack.lower() for m in order_markers()) or bool(po_number)
    pdfs = [a for a in attachments if (a.get("mimeType") or "").lower() == "application/pdf"]
    degraded = any(
        hint in (a.get("filename", "") or "").lower() for a in attachments for hint in DEGRADED_HINTS
    )

    # ---- Intake filter (§3.3.1) -------------------------------------------
    # An unknown sender is quarantined whatever the content says. This is the
    # one branch that runs before extraction, because the whole point is not to
    # spend a model call on a stranger.
    # A trusted domain is read; who it is *for* still comes from the document.
    if not known_domain and not is_trusted_sender(from_address):
        return {
            "status": "NOT_AN_ORDER",
            "cause": "UNKNOWN_DOMAIN",
            "confidence": 0.0,
            "extraction": {"fields": {}, "modelConfidence": 0.0},
            "poNumber": po_number or "",
            "orderValue": 0.0,
        }

    if not has_markers:
        return {
            "status": "NOT_AN_ORDER",
            "cause": "NO_ORDER_MARKERS",
            "confidence": 0.0,
            "extraction": {"fields": {}, "modelConfidence": 0.0},
            "poNumber": "",
            "orderValue": 0.0,
        }

    # ---- Extraction --------------------------------------------------------
    # A clean typed PDF sits high; every defect below subtracts from it, so the
    # confidence a reviewer sees is explainable rather than arbitrary.
    base = 0.90 + _seed(text_pool) * 0.09
    if not pdfs:
        base -= 0.18
    if degraded:
        base -= 0.55
    confidence = max(0.0, min(0.99, base))

    quantity_raw, quantity_line = _find(QTY_PATTERN, pdf_text, body, subject)
    # The labelled total first - see TOTAL_PATTERN for why the order matters.
    value_raw, value_line = _find(TOTAL_PATTERN, pdf_text, body, subject)
    if not value_raw:
        value_raw, value_line = _find(VALUE_PATTERN, pdf_text, body, subject)
    rate_raw, rate_line = _find(RATE_PATTERN, pdf_text, body, subject)
    terms = find_terms(pdf_text, body, subject)

    line_items = find_line_items(pdf_text, body, subject)

    quantity = int(quantity_raw.replace(",", "")) if quantity_raw else 0
    order_value = float(value_raw.replace(",", "")) if value_raw else 0.0

    if line_items:
        # The table is the document. When one exists its rows are authoritative and the
        # headline figures are their sum, so the number a reviewer approves is the number
        # the PACT grid will add up to rather than whichever "Value:" line matched first.
        quantity = int(sum(item["quantity"] for item in line_items))
        summed = round(sum(item["value"] for item in line_items), 2)
        if summed:
            order_value = summed
            value_line = f"sum of {len(line_items)} line item(s)"
        quantity_line = f"sum of {len(line_items)} line item(s)"

    if not order_value and quantity:
        # No stated value: price it off the standing rate so the approval gate
        # still has a number to judge. Derived, and labelled as such.
        order_value = round(quantity * 14.75, 2)
        value_line = f"derived from {quantity:,} m at the standing rate"

    # The delivery date is the field that most often has no evidence at all,
    # which is exactly why it is the demo's ambiguous-date branch.
    date_match = re.search(
        r"Delivery[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}[-/ ][A-Za-z]{3,9}[-/ ]\d{2,4})",
        f"{pdf_text}\n{body}",
        re.IGNORECASE,
    ) or re.search(
        r"(\d{1,2}[-/ ][A-Za-z]{3,9}[-/ ]\d{2,4}|\d{4}-\d{2}-\d{2})", f"{pdf_text}\n{body}"
    )
    delivery_line = date_match.group(1) if date_match else ""
    delivery_value = (
        delivery_line
        if delivery_line
        else (datetime.now(timezone.utc) + timedelta(days=21)).date().isoformat()
    )

    fields = {
        "poNumber": _field(po_number or "", confidence, 1, po_line),
        # The document's own name for its author wins over the sender directory: a PO is
        # issued by a company and sent by whatever mailbox was to hand.
        "customer": _field(
            find_customer_name(pdf_text, body, subject) or company_name or "",
            min(0.99, confidence + 0.04),
            1,
            from_address,
        ),
        "quantityMetres": _field(quantity, confidence - 0.01, 2, quantity_line),
        "orderValue": _field(order_value, confidence, 2, value_line),
        "deliveryDate": _field(delivery_value, confidence - 0.05, 2, delivery_line),
    }

    # What PACT's form needs, carried alongside the five headline fields. Kept out of
    # `fields` because those are what the customer is asked to confirm, and a customer
    # confirming "BY ROAD" is not the point of the question.
    if rate_raw:
        terms["unit_rate"] = rate_raw.replace(",", "")

    if not line_items:
        # A single-line order written as prose (`Product code / Quantity: / Rate:`) is
        # still an order with one line. Synthesising it here means everything downstream -
        # the receipt's line count, the PACT grid, the proforma - reads one shape and
        # never has to ask whether the document happened to be tabular.
        code = terms.get("product_code") or ""
        rate = _num(terms.get("unit_rate") or 0)
        if not rate and quantity:
            rate = round(order_value / quantity, 2)
        if code or quantity:
            line_items = [
                {
                    "sr": 1,
                    "productCode": code,
                    "description": "",
                    "quantity": float(quantity),
                    "unit": terms.get("unit") or "",
                    "rate": rate,
                    "value": round(order_value, 2),
                    "snippet": quantity_line or value_line or "",
                }
            ]

    extraction = {
        "fields": fields,
        "pactTerms": terms,
        # Every line the order asked for. One PO, one record, one PACT document.
        "lineItems": line_items,
        "modelConfidence": round(confidence, 3),
    }

    # ---- Validation gates, in the order a reviewer would apply them --------
    if degraded and confidence < 0.5:
        return _exception("OCR_FAILURE", confidence, extraction, po_number, order_value)

    if duplicate_of is not None:
        return _exception("DUPLICATE_PO", confidence, extraction, po_number, order_value)

    if confidence < flow.CONFIDENCE_FLOOR:
        return _exception("LOW_CONFIDENCE", confidence, extraction, po_number, order_value)

    if not delivery_line:
        return _exception("AMBIGUOUS_DATE", confidence, extraction, po_number, order_value)

    # ---- Clean. Every clean order stops for the admin gate. ----
    #
    # This used to be conditional on `APPROVAL_GATE_VALUE`, so a small order ran straight
    # through to COMMITTED with nobody looking at it. There is no straight-through path
    # any more: an admin approves every order before any work starts. The value threshold
    # survives only as the "large order" mark on the queue.
    return {
        "status": "AWAITING_ADMIN_APPROVAL",
        "highValue": order_value >= flow.APPROVAL_GATE_VALUE,
        "cause": None,
        "confidence": round(confidence, 3),
        "extraction": extraction,
        "poNumber": po_number or "",
        "orderValue": order_value,
    }


def _exception(
    cause: str,
    confidence: float,
    extraction: dict,
    po_number: Optional[str],
    order_value: float,
) -> dict:
    return {
        "status": "EXCEPTION",
        "cause": cause,
        "confidence": round(confidence, 3),
        "extraction": extraction,
        "poNumber": po_number or "",
        "orderValue": order_value,
    }


# --------------------------------------------------------------------------- #
# The proposal                                                                 #
# --------------------------------------------------------------------------- #


def proposal_from_extraction(extraction: dict) -> dict:
    """The values-only view of an extraction, for the pipeline and the emails.

    Confidences, bounding boxes and model metadata are dropped. Lived in
    `client_confirmation.py` until the customer gate was removed; it is here now because
    the extraction is what it is a view of.
    """
    fields = (extraction or {}).get("fields") or {}

    def value(name):
        return (fields.get(name) or {}).get("value")

    return {
        "poNumber": value("poNumber") or "",
        "customer": value("customer") or "",
        "quantityMetres": value("quantityMetres") or 0,
        "orderValue": value("orderValue") or 0.0,
        "deliveryDate": value("deliveryDate") or "",
        # Every line of the order. `pact_bridge.build_record` fills one PACT grid row per
        # entry here, in this order, into one document.
        "lineItems": list((extraction or {}).get("lineItems") or []),
        # The PACT-facing fields the document named. Carried so the form is filled from
        # the customer's order rather than from this system's defaults.
        "pactTerms": (extraction or {}).get("pactTerms") or {},
    }


def render_proposal(proposal: dict) -> str:
    """What we read, as plain text - for the internal notification and the console."""
    lines = [
        f"Purchase order {proposal.get('poNumber') or '(number not found)'}",
        f"From: {proposal.get('customer') or '(not identified)'}",
        "",
    ]
    for item in proposal.get("lineItems") or []:
        lines.append(
            f"  {item.get('sr', ''):>2}  {item.get('productCode', ''):<8}"
            f"{(item.get('description') or '')[:38]:<40}"
            f"{item.get('quantity', 0):>10,.0f} {item.get('unit') or '':<5}"
            f"{item.get('value', 0):>14,.2f}"
        )
    if proposal.get("lineItems"):
        lines.append("")
    lines += [
        f"  Total quantity  {proposal.get('quantityMetres') or '-'}",
        f"  Order value     Rs {float(proposal.get('orderValue') or 0):,.2f}",
        f"  Delivery date   {proposal.get('deliveryDate') or '-'}",
    ]
    return "\n".join(lines)
