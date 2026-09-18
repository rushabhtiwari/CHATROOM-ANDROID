"""Every message the PO pipeline sends, as pure functions from data to text.

Separated from sending so the words themselves can be asserted on. That matters most for
the acknowledgement, where the wording is a commercial commitment rather than a matter of
taste.

## Why the acknowledgement is worded the way it is

It goes out the moment a PO is read — before anybody at Kiran has looked at it, and before
the customer has confirmed the numbers were read correctly. At that point Kiran has done
exactly one thing: received a document. So the message may say that, and nothing else.

Words like *accepted*, *confirmed* and *approved* describe a decision to supply. Sending
them automatically would turn every inbound email into an apparent agreement to fulfil an
order at whatever prices and dates a regex happened to parse, which is a contract problem
rather than a copy problem. `assert_receipt_wording` enforces the ban at render time and
the tests assert it independently, so a well-meaning edit to friendlier phrasing fails
loudly instead of reaching a customer.

"Received" and "reviewing" are the whole of the promise.

## The three messages the customer gets

1. `render_receipt` - automatic, the moment the order is read. Under the wording ban.
2. `render_order_acknowledgement` - after the **admin** has approved. This one may say
   the order is accepted, because by then a person has decided that it is.
3. `render_final_dispatch` - after the PACT draft exists. Carries the document number and
   a dispatch date and tracking reference that are **fabricated for the demo** and labelled
   as such in the message itself.

Only the first is under `assert_receipt_wording`. That is the point of the split: the ban
exists because message 1 goes out before any human has looked at the order, and messages 2
and 3 do not.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    text: str
    html: str


class ReceiptWordingError(Exception):
    """A draft acknowledgement that promises something. Refused before it is sent."""


#: Words an acknowledgement may not contain, in any form.
FORBIDDEN_IN_ACKNOWLEDGEMENT: tuple[str, ...] = (
    "accepted",
    "accept",
    "acknowledged",
    "confirmed",
    "confirm",
    "approved",
    "approve",
    "agreed",
    "booked",
    "we will supply",
    "we will deliver",
)


def assert_receipt_wording(text: str) -> None:
    """Raise if a draft acknowledgement says more than "we have it and we are reading it"."""
    haystack = (text or "").lower()
    found = [w for w in FORBIDDEN_IN_ACKNOWLEDGEMENT if re.search(rf"\b{re.escape(w)}\b", haystack)]
    if found:
        raise ReceiptWordingError(
            "an acknowledgement may only record receipt, but this one says: "
            + ", ".join(found)
            + ". Nothing has been agreed at this point in the pipeline."
        )


def _stamp(moment: datetime) -> str:
    return moment.strftime("%d %b %Y %H:%M UTC")


# --------------------------------------------------------------------------- #
# 1 — the acknowledgement (ungated, immediate)                                 #
# --------------------------------------------------------------------------- #


def render_receipt(
    *,
    po_number: str,
    customer_name: str,
    seller_name: str,
    received_at: datetime,
    line_count: int,
) -> RenderedEmail:
    """Message 1: the automatic receipt, sent the moment the order is read."""
    po = po_number or "(number not found on the document)"
    subject = f"We have received your purchase order {po}"
    items = "line item" if line_count == 1 else "line items"

    text = "\n".join(
        [
            f"Dear {customer_name or 'Sir or Madam'},",
            "",
            f"This is an automatic receipt for purchase order {po}, which reached us at",
            f"{_stamp(received_at)}.",
            "",
            f"We have read {line_count} {items} from your document and are reviewing it.",
            "You will hear from us again once our order desk has been through it.",
            "",
            "This message records receipt only. It is not an agreement to supply, and no",
            "commercial commitment arises from it.",
            "",
            "Regards,",
            seller_name,
            "(sent automatically - please reply to this address if anything looks wrong)",
        ]
    )

    assert_receipt_wording(subject)
    assert_receipt_wording(text)

    body = f"""
     <p>Dear {html.escape(customer_name or 'Sir or Madam')},</p>
     <p>This is an automatic receipt for purchase order <strong>{html.escape(po)}</strong>,
        which reached us at {html.escape(_stamp(received_at))}.</p>
     <p>We have read {line_count} {items} from your document and are reviewing it. You
        will hear from us again once our order desk has been through it.</p>
     <p class="muted">This message records receipt only. It is not an agreement to supply,
        and no commercial commitment arises from it.</p>
     <p>Regards,<br>{html.escape(seller_name)}</p>"""
    assert_receipt_wording(_strip_tags(body))
    return RenderedEmail(subject=subject, text=text, html=_wrap(subject, body))


# --------------------------------------------------------------------------- #
# 2 — the internal notification (ungated, immediate)                           #
# --------------------------------------------------------------------------- #


def render_internal_notification(
    *,
    po_number: str,
    customer_name: str,
    order_value: float,
    quantity_metres: Any,
    delivery_date: Any,
    confidence: float,
    job_url: str,
    pact_master_problem: Optional[str] = None,
) -> RenderedEmail:
    """The internal heads-up. Ungated and immediate, like the acknowledgement.

    Sales seeing an order early is how a wrong price is caught before the customer is asked
    to confirm it. It states plainly that nothing has been committed, because an internal
    mail that reads like a booking is how a machine's guess becomes someone's production
    schedule.
    """
    po = po_number or "(number not found)"
    customer = customer_name or "(customer not identified)"
    subject = f"[PO received] {po} - {customer}"

    pact_line = (
        f"! PACT: {pact_master_problem}\n"
        "  This order cannot reach PACT until somebody adds that name to the master."
        if pact_master_problem
        else "PACT: the customer resolves against the master, so a draft can be created "
        "once Accounts release it."
    )

    text = "\n".join(
        [
            "A purchase order arrived and has been read automatically.",
            "",
            f"  PO number     {po}",
            f"  Customer      {customer}",
            f"  Quantity      {quantity_metres or '-'} m",
            f"  Order value   Rs {order_value:,.0f}",
            f"  Delivery      {delivery_date or '-'}",
            f"  Confidence    {confidence:.0%}",
            "",
            pact_line,
            "",
            "NOTHING HAS BEEN COMMITTED. The customer has been sent an automatic receipt",
            "and nothing else. No PACT document exists until an admin approves this order",
            "and Accounts release it.",
            "",
            f"Open the job: {job_url}",
        ]
    )
    return RenderedEmail(
        subject=subject,
        text=text,
        html=_wrap(subject, f"<pre>{html.escape(text)}</pre>"),
    )


# --------------------------------------------------------------------------- #
# 2b - the acknowledgement, after the admin has approved                        #
# --------------------------------------------------------------------------- #


def render_order_acknowledgement(
    *,
    po_number: str,
    customer_name: str,
    seller_name: str,
    line_summary: str,
    order_value: float,
    delivery_date: str,
    currency: str = "INR",
) -> RenderedEmail:
    """Message 2: sent when a person at Kiran has approved the order.

    Deliberately NOT under `assert_receipt_wording`. That ban protects the automatic
    receipt, which goes out before anybody has looked at the document; this message is the
    output of somebody looking at it, and it is allowed to say so.
    """
    po = po_number or "(number not found)"
    subject = f"Your purchase order {po} has been accepted"

    text = "\n".join(
        [
            f"Dear {customer_name or 'Sir or Madam'},",
            "",
            f"Your purchase order {po} has been reviewed and accepted by our order desk.",
            "It has been passed to production planning.",
            "",
            "What we have on order for you:",
            "",
            line_summary,
            "",
            f"  Order value     {currency} {order_value:,.2f}",
            f"  Delivery date   {delivery_date or 'to be advised'}",
            "",
            "If anything above does not match your order, reply to this message and we will",
            "correct it before dispatch.",
            "",
            "Regards,",
            seller_name,
        ]
    )

    body = f"""
     <p>Dear {html.escape(customer_name or 'Sir or Madam')},</p>
     <p>Your purchase order <strong>{html.escape(po)}</strong> has been reviewed and
        accepted by our order desk. It has been passed to production planning.</p>
     <pre>{html.escape(line_summary)}</pre>
     <p><strong>Order value</strong> {html.escape(currency)} {order_value:,.2f}<br>
        <strong>Delivery date</strong> {html.escape(delivery_date or 'to be advised')}</p>
     <p class="muted">If anything above does not match your order, reply to this message and
        we will correct it before dispatch.</p>
     <p>Regards,<br>{html.escape(seller_name)}</p>"""
    return RenderedEmail(subject=subject, text=text, html=_wrap(subject, body))


# --------------------------------------------------------------------------- #
# 3 - the closing message, after the PACT draft exists                          #
# --------------------------------------------------------------------------- #

#: The banner every fabricated figure in the closing message sits under.
#:
#: The dispatch date and the tracking reference in this message are **invented**. Nothing
#: has been handed to a carrier and no consignment exists. That is acceptable for a
#: rehearsal and only for a rehearsal, which is why it is said in the message rather than
#: only in a runbook - a forwarded copy carries the caveat with it.
DEMO_DISPATCH_BANNER = (
    "DEMONSTRATION MESSAGE - the dispatch date and tracking reference below are "
    "sample values generated for a demonstration. No consignment has been booked."
)


def render_final_dispatch(
    *,
    po_number: str,
    customer_name: str,
    seller_name: str,
    document_no: str,
    dispatch_date: str,
    tracking_url: str,
    tracking_reference: str,
    line_summary: str,
    order_value: float,
    currency: str = "INR",
) -> RenderedEmail:
    """Message 3: the order is in the system and on its way."""
    po = po_number or "(number not found)"
    subject = f"DEMO: purchase order {po} is confirmed for dispatch"

    text = "\n".join(
        [
            DEMO_DISPATCH_BANNER,
            "",
            f"Dear {customer_name or 'Sir or Madam'},",
            "",
            f"Your purchase order {po} is now confirmed on our system under document",
            f"number {document_no}.",
            "",
            line_summary,
            "",
            f"  Order value        {currency} {order_value:,.2f}",
            f"  Expected dispatch  {dispatch_date}",
            f"  Tracking reference {tracking_reference}",
            f"  Track the order    {tracking_url}",
            "",
            "This message is not a tax invoice and is not a demand for payment.",
            "",
            "Regards,",
            seller_name,
        ]
    )

    body = f"""
     <p class="demo-banner">{html.escape(DEMO_DISPATCH_BANNER)}</p>
     <p>Dear {html.escape(customer_name or 'Sir or Madam')},</p>
     <p>Your purchase order <strong>{html.escape(po)}</strong> is now confirmed on our
        system under document number <strong>{html.escape(document_no)}</strong>.</p>
     <pre>{html.escape(line_summary)}</pre>
     <p><strong>Order value</strong> {html.escape(currency)} {order_value:,.2f}<br>
        <strong>Expected dispatch</strong> {html.escape(dispatch_date)}<br>
        <strong>Tracking reference</strong> {html.escape(tracking_reference)}</p>
     <p><a class="button" href="{html.escape(tracking_url)}">Track this order</a></p>
     <p class="muted">This message is not a tax invoice and is not a demand for payment.</p>
     <p>Regards,<br>{html.escape(seller_name)}</p>"""
    return RenderedEmail(subject=subject, text=text, html=_wrap(subject, body))


# --------------------------------------------------------------------------- #
# 4 — the demo proforma covering note (gated)                                  #
# --------------------------------------------------------------------------- #


def render_proforma_email(
    *,
    po_number: str,
    customer_name: str,
    seller_name: str,
    document_no: str,
    proforma_html: str,
    total: Optional[float],
    currency: str = "INR",
) -> RenderedEmail:
    """The covering note for the demo proforma.

    Both this and the document itself say DEMO, in the subject line and in the first
    sentence. A proforma a reader could file as a tax invoice is the specific thing this
    pipeline must never produce.
    """
    po = po_number or "(number not found)"
    subject = f"DEMO PROFORMA for purchase order {po} - not a tax invoice"

    lines = [
        f"Dear {customer_name or 'Sir or Madam'},",
        "",
        "THIS IS A DEMONSTRATION DOCUMENT.",
        "It is not a tax invoice, not a demand for payment, and it has no legal or",
        "accounting effect.",
        "",
        f"Purchase order {po} has been accepted. A draft has been created in our system",
        f"under document number {document_no}.",
    ]
    if total is not None:
        lines.append(f"Indicative value: {currency} {total:,.2f}")
    lines += ["", "The demo proforma is below.", "", "Regards,", seller_name]

    body = f"""
     <p class="demo-banner">DEMO PROFORMA - not a tax invoice, not a demand for payment.</p>
     <p>Dear {html.escape(customer_name or 'Sir or Madam')},</p>
     <p>Purchase order <strong>{html.escape(po)}</strong> has been accepted. A draft has
        been created in our system under document number
        <strong>{html.escape(document_no)}</strong>.</p>
     {proforma_html}"""
    return RenderedEmail(subject=subject, text="\n".join(lines), html=_wrap(subject, body))


# --------------------------------------------------------------------------- #
# Shared chrome                                                                #
# --------------------------------------------------------------------------- #

_TAG = re.compile(r"<[^>]+>")


def _strip_tags(value: str) -> str:
    return _TAG.sub(" ", value)


def _wrap(title: str, body: str) -> str:
    """One inline stylesheet, because mail clients strip external ones."""
    return (
        "<!doctype html><html><head><meta charset=\"utf-8\">"
        f"<title>{html.escape(title)}</title><style>"
        "body{font:14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;"
        "color:#1a1a1a;margin:0;padding:24px;background:#f6f6f4}"
        ".card{max-width:700px;margin:0 auto;background:#fff;border:1px solid #e3e3df;"
        "border-radius:10px;padding:24px}"
        "pre{white-space:pre-wrap;font:12.5px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;"
        "background:#faf9f7;border:1px solid #eceae5;border-radius:6px;padding:12px;overflow-x:auto}"
        ".muted{color:#6b6b66;font-size:13px}"
        ".button{display:inline-block;background:#1a1a1a;color:#fff;padding:10px 18px;"
        "border-radius:6px;text-decoration:none}"
        ".demo-banner{background:#fff4d6;border:1px solid #e6c65c;border-radius:6px;"
        "padding:10px 12px;font-weight:600;letter-spacing:.02em}"
        f"</style></head><body><div class=\"card\">{body}</div></body></html>"
    )
