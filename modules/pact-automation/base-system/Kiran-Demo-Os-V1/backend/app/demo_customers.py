"""The four demo customers, and the seam between what we call them and what PACT does.

KiranOS and PACT are separate systems with separate name lists and nothing keeps them in
step. For the demo the two lists are made to agree by construction: four synthetic
customers exist in both, spelled identically, so the mapping below is the identity mapping
and the seam is visible without doing any work.

The reason it exists at all is the day the lists stop agreeing. Then this table is where
"Motherson Sumi Systems Ltd" is declared to be "MOTHERSON SUMI SYS LTD" in PACT, and no
call site moves. It is deliberately a table of decisions somebody made, not an algorithm:

    **Never guess. Never pick a near-match.**

A name that does not resolve fails that order with ``customer not in PACT master: <name>``
and stops. Trigram similarity, longest-common-prefix and "it's obviously that one" are all
ways of filing an order against the wrong company's account, which is not a mistake this
system may make quietly. The failure is cheap: somebody adds the name to PACT or to this
table and re-runs.

The "(Demo)" suffix is deliberate too. Nobody browsing PACT's master in six months mistakes
these for real customers, and they cannot collide with a real firm of a similar name. The
names must match character-for-character in both systems, so the suffix is part of the name
rather than a display decoration.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


class PactMasterError(Exception):
    """A customer that PACT's master does not contain. Never resolved by guessing."""


@dataclass(frozen=True)
class DemoCustomer:
    name: str
    domain: str
    contact_email: str
    contact_name: str
    city: str
    code: str


# Registered in PACT's **vendor** master for the demo — see the Purchase Order
# simplification in docs/DEMO_RUNBOOK.md. The alphabetical placement (M / S / V / N) sits
# well past the A-range the party dropdown opens on, so the lookup has to genuinely filter
# rather than land on the first row.
DEMO_CUSTOMERS: tuple[DemoCustomer, ...] = (
    DemoCustomer(
        name="Meghdoot Auto Components Pvt Ltd (Demo)",
        domain="meghdootauto.example",
        contact_email="purchase@meghdootauto.example",
        contact_name="Meghdoot Purchase Desk",
        city="Pune",
        code="CUST-D01",
    ),
    DemoCustomer(
        name="Sahyadri Electricals Pvt Ltd (Demo)",
        domain="sahyadrielectricals.example",
        contact_email="purchase@sahyadrielectricals.example",
        contact_name="Sahyadri Purchase Desk",
        city="Nashik",
        code="CUST-D02",
    ),
    DemoCustomer(
        name="Vaijanti Industrial Systems Pvt Ltd (Demo)",
        domain="vaijantiindustrial.example",
        contact_email="purchase@vaijantiindustrial.example",
        contact_name="Vaijanti Purchase Desk",
        city="Aurangabad",
        code="CUST-D03",
    ),
    DemoCustomer(
        name="Nilkanth Engineering Works Pvt Ltd (Demo)",
        domain="nilkanthengineering.example",
        contact_email="purchase@nilkanthengineering.example",
        contact_name="Nilkanth Purchase Desk",
        city="Mumbai",
        code="CUST-D04",
    ),
) + (
    # The six customers the PDFs in `demo-pos/` are written from. Unlike the four above
    # these are real rows of PACT's vendor master, so the names are spelled exactly as
    # PACT holds them (capitals and stops included) - the party lookup matches on the
    # name and resolves nothing by guessing. They are listed here so their domains are
    # seeded as known: a demo PO then runs the whole path without an operator first
    # having to clear it out of the unknown-sender queue.
    DemoCustomer(
        name="M/s Accurate Weight Industries",
        domain="msaccurateweightindustries.example",
        contact_email="purchase@msaccurateweightindustries.example",
        contact_name="Accurate Weight Purchase Desk",
        city="Belagavi",
        code="CUST-P01",
    ),
    DemoCustomer(
        name="M/s B R Traders",
        domain="msbrtraders.example",
        contact_email="purchase@msbrtraders.example",
        contact_name="B R Traders Purchase Desk",
        city="Hubballi",
        code="CUST-P02",
    ),
    # Not resolvable on the live window as of 2026-09-21: PACT clears the box rather than
    # matching, so the push stops safely instead of saving a wrong party. Kept here so the
    # sender is still a known domain and the failure is the master lookup, which says so.
    DemoCustomer(
        name="M.a. Mannan Silk Lining House",
        domain="mamannansilklininghouse.example",
        contact_email="purchase@mamannansilklininghouse.example",
        contact_name="Mannan Purchase Desk",
        city="Mysuru",
        code="CUST-P03",
    ),
    # Not resolvable on the live window either - see the note above.
    DemoCustomer(
        name="M.J.COMFORT",
        domain="mjcomfort.example",
        contact_email="purchase@mjcomfort.example",
        contact_name="M J Comfort Purchase Desk",
        city="Mangaluru",
        code="CUST-P04",
    ),
    DemoCustomer(
        name="M.K.INDUSTRIES",
        domain="mkindustries.example",
        contact_email="purchase@mkindustries.example",
        contact_name="M K Industries Purchase Desk",
        city="Bengaluru",
        code="CUST-P05",
    ),
    DemoCustomer(
        name="M.r. Enterprises",
        domain="mrenterprises.example",
        contact_email="purchase@mrenterprises.example",
        contact_name="M R Enterprises Purchase Desk",
        city="Mysuru",
        code="CUST-P06",
    ),
)


def by_domain(domain: str) -> Optional[DemoCustomer]:
    key = (domain or "").strip().lower()
    return next((c for c in DEMO_CUSTOMERS if c.domain == key), None)


def by_name(name: str) -> Optional[DemoCustomer]:
    key = _normalise(name)
    return next((c for c in DEMO_CUSTOMERS if _normalise(c.name) == key), None)


# --------------------------------------------------------------------------- #
# KiranOS company name -> PACT master name                                     #
# --------------------------------------------------------------------------- #

#: Every name above is identity: the rows were created in PACT with exactly these
#: strings, so there is nothing to translate. Listed explicitly rather than inferred,
#: because "the table is empty so anything goes" is the behaviour this module exists to
#: prevent.
#:
#: `OTHER_PACT_VENDORS` are the remaining rows of PACT's vendor master. No demo PDF is
#: written from them, but an order can still name one - the seeded ledger does - and
#: without them the push fails with "customer not in PACT master" for a company PACT
#: demonstrably holds. They are spelled as the master spells them.
OTHER_PACT_VENDORS: tuple[str, ...] = (
    "M.a. Road Lines",
    "M S Enterpries",
    "M K MOBILES PRIVATE LIMITED",
)

PACT_MASTER_MAP: dict[str, str] = {
    **{c.name: c.name for c in DEMO_CUSTOMERS},
    **{name: name for name in OTHER_PACT_VENDORS},
}


def parse_pairs(raw: str | None) -> dict[str, str]:
    """``A=B;C=D`` into a dict.

    A malformed entry raises rather than being skipped: a mapping that was meant to be
    there and silently is not would send an order to the wrong master record, which is
    exactly the failure the rest of this file is built around.
    """
    out: dict[str, str] = {}
    if not (raw or "").strip():
        return out
    for chunk in raw.split(";"):
        entry = chunk.strip()
        if not entry:
            continue
        left, sep, right = entry.partition("=")
        if not sep or not left.strip() or not right.strip():
            raise PactMasterError(f"PACT_MASTER_MAP entry {entry!r} is not 'KiranOS Name=PACT Name'")
        out[left.strip()] = right.strip()
    return out


def master_map(env: dict[str, str] | None = None) -> dict[str, str]:
    """The built-in table plus anything ``PACT_MASTER_MAP`` adds — no deploy needed."""
    source = env if env is not None else os.environ
    return {**PACT_MASTER_MAP, **parse_pairs(source.get("PACT_MASTER_MAP"))}


def resolve_pact_party(name: str | None, env: dict[str, str] | None = None) -> str:
    """The name PACT will accept for this company, or a hard failure.

    Matching ignores case and collapses runs of whitespace, because those differences are
    transcription noise rather than a different company. Nothing looser is allowed: no
    prefix matching, no fuzzy distance, no "the only entry starting with M".
    """
    cleaned = (name or "").strip()
    if not cleaned:
        raise PactMasterError("customer not in PACT master: <no customer name on the order>")
    key = _normalise(cleaned)
    for kiranos_name, pact_name in master_map(env).items():
        if _normalise(kiranos_name) == key:
            return pact_name
    raise PactMasterError(f"customer not in PACT master: {cleaned}")


def is_in_pact_master(name: str | None, env: dict[str, str] | None = None) -> bool:
    """The same question without the throw, for pre-flight display."""
    try:
        resolve_pact_party(name, env)
        return True
    except PactMasterError:
        return False


# --------------------------------------------------------------------------- #
# Product codes                                                                #
# --------------------------------------------------------------------------- #

#: Codes PACT's product master actually contains, keyed by whatever the customer's own
#: document calls the material.
#:
#: Every code here was read off the live PACT window and its provenance is recorded in
#: ``C:\\Users\\prach\\pact-automation\\demo\\discovered_values.md``. None is invented: the
#: product dropdown does not expose its rows to UI Automation, so a code can only be
#: obtained by committing a row on a throwaway draft and reading it back.
#:
#: ``PACT_PRODUCT_MAP`` (same ``A=B;C=D`` syntax) adds to it.
PRODUCT_CODES: dict[str, str] = {
    # PET MONOFILAMENT YARN 0.22MM BLACK FR 250 DIN - HSN 54041200, KGS, PACT rate 265
    "PET-MONO-0.22-BLACK": "46893",
    "46893": "46893",
    # SYNTHETIC MONOFILMENT YARN 0.25MM NATURAL WHITE FR - HSN 54041200, KGS
    "SYN-MONO-0.25-WHITE": "42010",
    "42010": "42010",
}

#: The code used when a demo PO does not name a material at all. It is a real code, and
#: naming it here rather than picking one at fill time keeps "which product did the demo
#: use" a question with one answer.
DEFAULT_PRODUCT_CODE = "46893"


def default_product_code(env: dict[str, str] | None = None) -> str:
    """The standing code, overridable through ``PACT_DEFAULT_PRODUCT_CODE``.

    A PACT company's product master is its own: this instance holds exactly one row
    (FGY1000D), and an earlier one held 46893 and 42010. Baking the answer into the module
    means a company change silently sends every order to a code that is no longer there,
    which fails at the grid with a blank Product Code and no explanation. Same shape as the
    two maps above - the table is the default, the environment adds to it.
    """
    source = env if env is not None else os.environ
    return (source.get("PACT_DEFAULT_PRODUCT_CODE") or "").strip() or DEFAULT_PRODUCT_CODE


def product_map(env: dict[str, str] | None = None) -> dict[str, str]:
    source = env if env is not None else os.environ
    return {**PRODUCT_CODES, **parse_pairs(source.get("PACT_PRODUCT_MAP"))}


def resolve_product_code(material: str | None, env: dict[str, str] | None = None) -> Optional[str]:
    """The PACT code for a customer material, or None to let the caller decide."""
    code = (material or "").strip()
    if not code:
        return None
    key = _normalise(code)
    for material_code, pact_code in product_map(env).items():
        if _normalise(material_code) == key:
            return pact_code
    return None


# --------------------------------------------------------------------------- #
# Which PACT screen                                                            #
# --------------------------------------------------------------------------- #


def kpac_profile(env: dict[str, str] | None = None) -> str:
    """Which KPAC profile — which PACT screen — this deployment drives.

    Configuration rather than a constant, so the screen can be switched without a code
    change. Defaults to the Purchase Order profile because that is the one proven against
    the live window.
    """
    source = env if env is not None else os.environ
    return (source.get("KPAC_PROFILE") or "").strip() or "pact_purchase_order"


def _normalise(value: str) -> str:
    return " ".join((value or "").split()).lower()
