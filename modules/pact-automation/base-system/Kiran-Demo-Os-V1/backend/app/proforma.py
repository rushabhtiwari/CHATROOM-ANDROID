"""The demo proforma.

The single rule this file exists to enforce: **it must never read as a tax invoice.**

A proforma that looks like a real financial document is not a cosmetic problem. Somebody
files it, somebody's accounts team books against it, and a demonstration has produced a
document with consequences. So the disclaimer is not a footer — it is the first thing in
the document, it is repeated in the watermark, and `assert_not_a_tax_invoice` refuses to
return HTML that fails the check. The guard runs on every render, so a well-intentioned
tidy-up of the layout fails here rather than in a customer's inbox.

The specific things that make a document *look* like a tax invoice, and are therefore
absent: the words "Tax Invoice" (except negated), a GSTIN, a tax breakdown, an invoice
number series, a "payable by" date, and bank details. A demo does not need any of them.
"""

from __future__ import annotations

import html
import re
from datetime import datetime, timezone
from typing import Any, Optional


class ProformaError(Exception):
    """A rendered proforma that a reader could mistake for a real document."""


#: Phrases that must never appear in a proforma. "Tax invoice" is handled separately,
#: because saying "this is NOT a tax invoice" is exactly what we want it to say.
FORBIDDEN_IN_PROFORMA: tuple[str, ...] = (
    "gstin",
    "original for recipient",
    "duplicate for transporter",
    "triplicate for supplier",
    "amount payable",
    "please remit",
    "bank details",
    "ifsc",
    "e-invoice",
    "irn",
)


def tax_invoice_mentions_are_negated(document: str) -> bool:
    """True when every mention of "tax invoice" is preceded by a negation.

    The document is allowed — required, in fact — to say it is *not* a tax invoice. What it
    may not do is describe itself as one.
    """
    text = re.sub(r"\s+", " ", (document or "").lower())
    for match in re.finditer(r"tax invoice", text):
        before = text[max(0, match.start() - 30) : match.start()]
        if not re.search(r"\b(not|never|isn't|is not|nor)\b[^.]*$", before):
            return False
    return True


def assert_not_a_tax_invoice(document: str) -> None:
    text = re.sub(r"<[^>]+>", " ", document or "").lower()
    found = [word for word in FORBIDDEN_IN_PROFORMA if word in text]
    if found:
        raise ProformaError(
            "a demo proforma must not read as a financial document, but this one contains: "
            + ", ".join(found)
        )
    if not tax_invoice_mentions_are_negated(document):
        raise ProformaError(
            "this document describes itself as a tax invoice; every mention must be negated"
        )


def proforma_totals(proposal: dict) -> dict[str, Any]:
    quantity = float(proposal.get("quantityMetres") or 0)
    value = float(proposal.get("orderValue") or 0)
    rate = round(value / quantity, 4) if quantity else None
    return {"currency": "INR", "quantityMetres": quantity, "rate": rate, "subtotal": value}


def render_proforma_html(
    *,
    document_no: str,
    proposal: dict,
    seller_name: str,
    pact_document_no: Optional[str] = None,
    issued_at: Optional[datetime] = None,
    price_notes: Optional[list[str]] = None,
) -> str:
    """The document itself. Watermarked, disclaimed, and checked before it is returned."""
    issued = (issued_at or datetime.now(timezone.utc)).strftime("%d %b %Y")
    totals = proforma_totals(proposal)
    notes = price_notes or []

    rate_cell = "-" if totals["rate"] is None else f"{totals['rate']:,.2f}"
    rows = f"""
      <tr>
        <td>1</td>
        <td>Cable protection products, as ordered</td>
        <td class="num">{totals['quantityMetres']:,.0f} m</td>
        <td class="num">{rate_cell}</td>
        <td class="num">{totals['subtotal']:,.2f}</td>
      </tr>"""

    note_block = ""
    if notes:
        items = "".join(f"<li>{html.escape(str(note))}</li>" for note in notes)
        note_block = (
            '<div class="notes"><strong>What PACT actually priced this at</strong>'
            f"<ul>{items}</ul></div>"
        )

    document = f"""
<div class="proforma">
  <div class="watermark">DEMO</div>
  <p class="banner">DEMONSTRATION PROFORMA.
     This is not a tax invoice, not a demand for payment, and it has no legal or
     accounting effect.</p>

  <div class="head">
    <div>
      <div class="who">{html.escape(seller_name)}</div>
      <div class="muted">Demonstration document</div>
    </div>
    <div class="meta">
      <div><span>Proforma no</span><strong>{html.escape(document_no)}</strong></div>
      <div><span>Issued</span><strong>{html.escape(issued)}</strong></div>
      <div><span>PACT draft</span><strong>{html.escape(pact_document_no or '-')}</strong></div>
    </div>
  </div>

  <div class="party">
    <span>For</span>
    <strong>{html.escape(str(proposal.get('customer') or '-'))}</strong>
    <span>Against purchase order</span>
    <strong>{html.escape(str(proposal.get('poNumber') or '-'))}</strong>
    <span>Indicated delivery</span>
    <strong>{html.escape(str(proposal.get('deliveryDate') or '-'))}</strong>
  </div>

  <table>
    <thead>
      <tr><th>#</th><th>Description</th><th class="num">Quantity</th>
          <th class="num">Rate</th><th class="num">Value (INR)</th></tr>
    </thead>
    <tbody>{rows}</tbody>
    <tfoot>
      <tr><td colspan="4">Indicative value</td>
          <td class="num">{totals['subtotal']:,.2f}</td></tr>
    </tfoot>
  </table>
  {note_block}

  <p class="muted small">No tax has been computed and none is claimed. The PACT document
     referenced above is a <strong>draft</strong>, saved with Save Draft and never posted,
     so it has not entered the books.</p>
</div>
<style>
 .proforma{{position:relative;border:1px solid #d8d4cc;border-radius:10px;padding:22px;
   background:#fff;overflow:hidden}}
 .proforma .watermark{{position:absolute;top:38%;left:50%;transform:translate(-50%,-50%)
   rotate(-24deg);font:700 92px/1 system-ui,sans-serif;color:rgba(190,60,60,.10);
   letter-spacing:.18em;pointer-events:none;user-select:none}}
 .proforma .banner{{background:#fff4d6;border:1px solid #e6c65c;border-radius:6px;
   padding:10px 12px;font-weight:600;margin:0 0 18px}}
 .proforma .head{{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}}
 .proforma .who{{font-size:17px;font-weight:600}}
 .proforma .meta div{{display:flex;gap:10px;justify-content:flex-end;font-size:12.5px}}
 .proforma .meta span{{color:#6b6b66}}
 .proforma .party{{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:18px 0;
   font-size:13px}}
 .proforma .party span{{color:#6b6b66}}
 .proforma table{{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}}
 .proforma th,.proforma td{{border-bottom:1px solid #eceae5;padding:8px 6px;text-align:left}}
 .proforma th{{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b6b66}}
 .proforma .num{{text-align:right;font-variant-numeric:tabular-nums}}
 .proforma tfoot td{{font-weight:600;border-bottom:none}}
 .proforma .notes{{margin-top:14px;font-size:12.5px;background:#faf9f7;border:1px solid #eceae5;
   border-radius:6px;padding:10px 12px}}
 .proforma .muted{{color:#6b6b66}}
 .proforma .small{{font-size:12px;margin-top:16px}}
</style>"""

    assert_not_a_tax_invoice(document)
    return document
