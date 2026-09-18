"""Receipt understanding.

One call to Claude does two jobs at once: it reads the receipt into structured
fields, and it checks those fields against the company's category caps. Both
come back in a single forced tool call, so there is no prose to parse and no
second round trip.

The trust boundary matters more than the accuracy. The model's reading is a
*proposal*: it pre-fills the claim form, the employee corrects anything wrong,
and their submission is what creates the claim. We keep the original extraction
alongside the confirmed values so HR and Accounts can see what changed.

If the key is missing or the network is down, extraction degrades to a filename
heuristic rather than failing. A demo should never dead-end on wifi.
"""

from __future__ import annotations

import base64
import json
import re
from pathlib import Path
from typing import Any, Optional

from .config import (
    ANTHROPIC_API_KEY,
    EXTRACTION_MODEL,
    IMAGE_TYPES,
    PDF_TYPES,
    has_api_key,
)

# The schema Claude must fill. `strict` plus a forced tool choice means the
# input always validates, so the server never parses free text.
RECEIPT_TOOL = {
    "name": "record_receipt",
    "description": (
        "Record the structured contents of an expense receipt, and flag any "
        "company policy caps the amounts exceed."
    ),
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": (
                    "A short claim title an employee would recognise, e.g. "
                    "'Client visit - Pune, 3 days' or 'Taj Vivanta - 2 nights'. "
                    "Max 60 characters."
                ),
            },
            "category": {
                "type": "string",
                "enum": ["TRAVEL", "LODGING", "MEALS", "FUEL", "OTHER"],
                "description": (
                    "TRAVEL for flights/trains/cabs, LODGING for hotels, MEALS "
                    "for food, FUEL for petrol/diesel, OTHER for anything else."
                ),
            },
            "amount": {
                "type": "number",
                "description": (
                    "The total payable on the receipt, in rupees. Use the grand "
                    "total including taxes, not a subtotal or a per-night rate."
                ),
            },
            "vendor": {
                "type": "string",
                "description": "Merchant or supplier name as printed.",
            },
            "invoice_number": {
                "type": "string",
                "description": "Invoice, bill or PNR number. Empty string if absent.",
            },
            "invoice_date": {
                "type": "string",
                "description": "Date on the receipt as YYYY-MM-DD. Empty string if absent.",
            },
            "travel_from": {
                "type": "string",
                "description": (
                    "Start of the stay or trip as YYYY-MM-DD, for hotel check-in "
                    "or outbound travel. Empty string if not applicable."
                ),
            },
            "travel_to": {
                "type": "string",
                "description": (
                    "End of the stay or trip as YYYY-MM-DD, for hotel check-out "
                    "or return travel. Empty string if not applicable."
                ),
            },
            "justification": {
                "type": "string",
                "description": (
                    "One or two sentences an employee could submit as the business "
                    "justification, written from what the receipt shows. Do not "
                    "invent a business reason that is not implied by the document."
                ),
            },
            "line_items": {
                "type": "array",
                "description": "Individual charges on the receipt. Empty array if not itemised.",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "amount": {"type": "number"},
                    },
                    "required": ["description", "amount"],
                    "additionalProperties": False,
                },
            },
            "nights": {
                "type": "integer",
                "description": "Number of nights for a hotel bill, else 0.",
            },
            "days": {
                "type": "integer",
                "description": "Number of days the claim covers, else 0.",
            },
            "confidence": {
                "type": "object",
                "description": "0 to 1 confidence for each field you filled in.",
                "properties": {
                    "title": {"type": "number"},
                    "category": {"type": "number"},
                    "amount": {"type": "number"},
                    "vendor": {"type": "number"},
                    "dates": {"type": "number"},
                },
                "required": ["title", "category", "amount", "vendor", "dates"],
                "additionalProperties": False,
            },
            "readable": {
                "type": "boolean",
                "description": (
                    "False if the document is too blurred, cropped or unrelated "
                    "to read as a receipt."
                ),
            },
            "notes": {
                "type": "string",
                "description": (
                    "Anything a reviewer should know: unclear totals, handwriting, "
                    "a foreign currency, a second passenger. Empty string if none."
                ),
            },
        },
        "required": [
            "title",
            "category",
            "amount",
            "vendor",
            "invoice_number",
            "invoice_date",
            "travel_from",
            "travel_to",
            "justification",
            "line_items",
            "nights",
            "days",
            "confidence",
            "readable",
            "notes",
        ],
        "additionalProperties": False,
    },
}


def _system_prompt(caps: list[dict]) -> str:
    cap_lines = "\n".join(
        f"- {c['label']}: Rs {c['cap']:,.0f} {c['unit']} (category {c['category']})"
        for c in caps
    )
    return (
        "You read expense receipts for an Indian corporate reimbursement system "
        "and return structured data.\n\n"
        "Rules:\n"
        "- Amounts are Indian rupees. Strip currency symbols, commas and the word "
        "INR. If a total is shown in another currency, record the rupee figure if "
        "one is printed, otherwise record the number as-is and say so in notes.\n"
        "- Record the grand total actually payable, after taxes and discounts.\n"
        "- Dates are YYYY-MM-DD. Indian receipts are usually DD/MM/YYYY, so "
        "03/09/2026 is 2026-09-03, not 9 March.\n"
        "- Never invent a value. If a field is not on the document, use an empty "
        "string, 0, or an empty array, and set that field's confidence low.\n"
        "- Be honest in `confidence`. A reviewer uses it to decide what to check.\n\n"
        "The company's expense caps, for context when writing notes:\n"
        f"{cap_lines}\n\n"
        "Call record_receipt exactly once."
    )


def _media_type(path: Path) -> Optional[str]:
    suffix = path.suffix.lower()
    return IMAGE_TYPES.get(suffix) or PDF_TYPES.get(suffix)


def _content_block(path: Path) -> Optional[dict]:
    """Builds the image or document block for one file, or None if unsupported."""
    media_type = _media_type(path)
    if not media_type:
        return None

    data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")
    if media_type == "application/pdf":
        return {
            "type": "document",
            "source": {"type": "base64", "media_type": media_type, "data": data},
        }
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": media_type, "data": data},
    }


def _policy_findings(
    category: str, amount: float, nights: int, days: int, caps: list[dict]
) -> list[dict]:
    """Checks the extracted amounts against the caps. Plain arithmetic, so the
    compliance panel shows a number a reviewer can verify, not a model opinion."""
    cap = next((c for c in caps if c["category"] == category), None)
    if not cap or not amount:
        return []

    unit = cap["unit"]
    limit = float(cap["cap"])
    findings: list[dict] = []

    if unit == "per night" and nights > 0:
        per_night = amount / nights
        if per_night > limit:
            over = (per_night - limit) * nights
            findings.append(
                {
                    "severity": "BREACH",
                    "code": "LODGING_CAP",
                    "message": (
                        f"Rs {per_night:,.0f} per night over {nights} night(s) "
                        f"exceeds the Rs {limit:,.0f} cap by Rs {over:,.0f}."
                    ),
                    "cap": limit,
                    "observed": per_night,
                }
            )
    elif unit == "per day" and days > 0:
        per_day = amount / days
        if per_day > limit:
            over = (per_day - limit) * days
            findings.append(
                {
                    "severity": "BREACH",
                    "code": "MEALS_CAP",
                    "message": (
                        f"Rs {per_day:,.0f} per day over {days} day(s) exceeds "
                        f"the Rs {limit:,.0f} cap by Rs {over:,.0f}."
                    ),
                    "cap": limit,
                    "observed": per_day,
                }
            )
    elif amount > limit:
        findings.append(
            {
                "severity": "BREACH",
                "code": f"{category}_CAP",
                "message": (
                    f"Rs {amount:,.0f} exceeds the {cap['label'].lower()} of "
                    f"Rs {limit:,.0f} {unit} by Rs {amount - limit:,.0f}."
                ),
                "cap": limit,
                "observed": amount,
            }
        )
    elif amount > limit * 0.9:
        findings.append(
            {
                "severity": "INFO",
                "code": f"{category}_NEAR_CAP",
                "message": (
                    f"Rs {amount:,.0f} is within 10% of the Rs {limit:,.0f} "
                    f"{cap['label'].lower()}."
                ),
                "cap": limit,
                "observed": amount,
            }
        )

    return findings


VALID_CATEGORIES = {"TRAVEL", "LODGING", "MEALS", "FUEL", "OTHER"}


def _number(value, default: float = 0.0) -> float:
    """Reads a number from a payload that may not have been schema-validated.

    Tolerates the formatted strings a model sometimes returns for money —
    "Rs 12,331.00", "₹12,331" — rather than discarding the amount.
    """
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, str):
        cleaned = re.sub(r"[^0-9.\-]", "", value.replace(",", ""))
        try:
            return float(cleaned)
        except ValueError:
            return default
    return default


def _shape(raw: dict, caps: list[dict], source: str, model: Optional[str]) -> dict:
    """Turns a tool payload into the camelCase shape the frontend consumes.

    Written to tolerate a payload that was not schema-validated: a category the
    UI has no label for, or a total that arrived as text, would otherwise reach
    the browser and break a screen.
    """
    amount = _number(raw.get("amount"))
    category = str(raw.get("category") or "OTHER").upper()
    if category not in VALID_CATEGORIES:
        category = "OTHER"
    nights = int(_number(raw.get("nights")))
    days = int(_number(raw.get("days")))

    travel_from = (raw.get("travel_from") or "").strip()
    travel_to = (raw.get("travel_to") or "").strip()
    travel_dates = (
        {"from": travel_from, "to": travel_to} if travel_from and travel_to else None
    )

    supplied = raw.get("confidence")
    confidence = (
        {str(k): _number(v) for k, v in supplied.items()}
        if isinstance(supplied, dict)
        else {}
    )
    overall = round(sum(confidence.values()) / len(confidence), 3) if confidence else 0.0

    findings = _policy_findings(category, amount, nights, days, caps)
    if raw.get("readable") is False:
        findings.insert(
            0,
            {
                "severity": "WARN",
                "code": "UNREADABLE",
                "message": (
                    "The document could not be read confidently. Please check "
                    "every field before submitting."
                ),
                "cap": None,
                "observed": None,
            },
        )

    return {
        "title": (raw.get("title") or "").strip()[:80] or None,
        "category": category,
        "amount": amount or None,
        "currency": "INR",
        "vendor": (raw.get("vendor") or "").strip() or None,
        "invoiceNumber": (raw.get("invoice_number") or "").strip() or None,
        "invoiceDate": (raw.get("invoice_date") or "").strip() or None,
        "travelDates": travel_dates,
        "justification": (raw.get("justification") or "").strip() or None,
        "lineItems": [
            {
                "description": str(i.get("description", "")),
                "amount": _number(i.get("amount")),
            }
            for i in (raw.get("line_items") or [])
            if isinstance(i, dict)
        ],
        "confidence": confidence,
        "overallConfidence": overall,
        "policyFindings": findings,
        "notes": (raw.get("notes") or "").strip() or None,
        "source": source,
        "model": model,
        "receiptIds": [],
    }


# --------------------------------------------------------------------------- #
# Offline fallback                                                            #
# --------------------------------------------------------------------------- #

_FILENAME_CATEGORY = [
    (r"hotel|taj|vivanta|oyo|marriott|lemon|inn|stay|lodg", "LODGING"),
    (r"fuel|petrol|diesel|hpcl|iocl|bpcl|shell", "FUEL"),
    (r"meal|food|restaurant|cafe|swiggy|zomato|dine", "MEALS"),
    (r"flight|indigo|vistara|airline|boarding|irctc|rail|train|ola|uber|cab|taxi|travel", "TRAVEL"),
]

# The pre-extracted sample. Reached when the venue wifi dies, or explicitly via
# `useSample`, so the flow can always be demonstrated end to end.
SAMPLE_EXTRACTION = {
    "title": "Taj Vivanta, Pune - 2 nights",
    "category": "LODGING",
    "amount": 11800.0,
    "vendor": "Taj Vivanta Pune",
    "invoice_number": "TV-2026-44817",
    "invoice_date": "2026-09-04",
    "travel_from": "2026-09-02",
    "travel_to": "2026-09-04",
    "justification": (
        "Two-night stay in Pune for the on-site client visit with the "
        "procurement team."
    ),
    "line_items": [
        {"description": "Room charges (2 nights)", "amount": 10000.0},
        {"description": "GST @ 18%", "amount": 1800.0},
    ],
    "nights": 2,
    "days": 3,
    "confidence": {
        "title": 0.94,
        "category": 0.98,
        "amount": 0.99,
        "vendor": 0.97,
        "dates": 0.92,
    },
    "readable": True,
    "notes": "Room rate is Rs 5,000 per night before tax.",
}


def _heuristic(file_names: list[str], caps: list[dict]) -> dict:
    """Last resort: infer what we can from the filename alone.

    Confidence is deliberately near zero — this is a starting point for the
    employee to correct, and it must not read as a confident machine reading.
    """
    joined = " ".join(file_names).lower()
    category = "OTHER"
    for pattern, value in _FILENAME_CATEGORY:
        if re.search(pattern, joined):
            category = value
            break

    stem = Path(file_names[0]).stem if file_names else "receipt"
    title = re.sub(r"[-_]+", " ", stem).strip().title()[:60]

    return _shape(
        {
            "title": title,
            "category": category,
            "amount": 0,
            "vendor": "",
            "invoice_number": "",
            "invoice_date": "",
            "travel_from": "",
            "travel_to": "",
            "justification": "",
            "line_items": [],
            "nights": 0,
            "days": 0,
            "confidence": {
                "title": 0.2,
                "category": 0.3,
                "amount": 0.0,
                "vendor": 0.0,
                "dates": 0.0,
            },
            "readable": False,
            "notes": (
                "Automatic reading was unavailable, so only the file name could "
                "be used. Please fill in the amount and details."
            ),
        },
        caps,
        source="heuristic",
        model=None,
    )


def sample_extraction(caps: list[dict]) -> dict:
    return _shape(SAMPLE_EXTRACTION, caps, source="sample", model=None)


# --------------------------------------------------------------------------- #
# The real call                                                               #
# --------------------------------------------------------------------------- #


def extract(
    paths: list[Path], caps: list[dict], names: list[str] | None = None
) -> dict:
    """Reads one or more receipt files into a single claim proposal.

    Multiple files are sent in one message, so a boarding pass plus a hotel bill
    for the same trip produce one coherent claim rather than two fragments.

    `names` carries the filenames the employee chose; the paths on disk are
    prefixed to keep them unique, and that prefix must not leak into the claim.
    """
    file_names = names or [p.name for p in paths]

    if not has_api_key():
        result = _heuristic(file_names, caps)
        result["notes"] = (
            "No ANTHROPIC_API_KEY is configured, so the receipt was not read. "
            "Add a key to backend/.env to enable extraction."
        )
        return result

    blocks = [b for b in (_content_block(p) for p in paths) if b]
    if not blocks:
        return _heuristic(file_names, caps)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY, timeout=90.0)

        instruction = (
            "Read the attached receipt"
            + ("s" if len(blocks) > 1 else "")
            + " and record the claim."
        )
        if len(blocks) > 1:
            instruction += (
                " They belong to one trip, so combine them into a single claim: "
                "sum the totals, and pick the category of the largest charge."
            )

        messages = [
            {
                "role": "user",
                "content": [*blocks, {"type": "text", "text": instruction}],
            }
        ]

        def call(tool: dict):
            return client.messages.create(
                model=EXTRACTION_MODEL,
                max_tokens=2048,
                system=_system_prompt(caps),
                tools=[tool],
                # Forced, so there is exactly one structured payload and never
                # any prose for the server to parse.
                tool_choice={"type": "tool", "name": "record_receipt"},
                messages=messages,
            )

        try:
            response = call(RECEIPT_TOOL)
        except anthropic.BadRequestError:
            # `strict` schema validation is not offered by every model. The
            # schema still shapes the call; we just lose the guarantee, so the
            # values are read defensively below either way.
            relaxed = {k: v for k, v in RECEIPT_TOOL.items() if k != "strict"}
            response = call(relaxed)

        tool_use = next(
            (b for b in response.content if getattr(b, "type", None) == "tool_use"),
            None,
        )
        if tool_use is None:
            return _heuristic(file_names, caps)

        # Tool inputs are already parsed objects; never string-match them.
        raw = tool_use.input
        if isinstance(raw, str):
            raw = json.loads(raw)
        if not isinstance(raw, dict):
            return _heuristic(file_names, caps)

        return _shape(raw, caps, source="claude", model=EXTRACTION_MODEL)

    except Exception as exc:  # noqa: BLE001 - the demo must not die on a bad call
        result = _heuristic(file_names, caps)
        result["notes"] = (
            f"Automatic reading failed ({type(exc).__name__}). "
            "Please enter the details manually."
        )
        return result


def describe_backend() -> dict[str, Any]:
    return {
        "configured": has_api_key(),
        "model": EXTRACTION_MODEL if has_api_key() else None,
    }
