import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.access import DepartmentGrant, OverrideRef, RoleRef, decide

NOW = datetime(2026, 9, 16, 12, 0, tzinfo=UTC)
VIEWER = RoleRef(uuid.uuid4(), "viewer", 10)
EDITOR = RoleRef(uuid.uuid4(), "editor", 20)
MANAGER = RoleRef(uuid.uuid4(), "manager", 30)
SALES = uuid.uuid4()
FINANCE = uuid.uuid4()


def _decide(**overrides):
    args = dict(
        user_status="active",
        app_status="active",
        app_is_system=False,
        app_roles=[VIEWER, EDITOR, MANAGER],
        override=None,
        department_grants=[],
        now=NOW,
    )
    args.update(overrides)
    return decide(**args)


def _override(effect, role=None, expires_at=None):
    return OverrideRef(id=uuid.uuid4(), effect=effect, role=role, expires_at=expires_at)


CASES = [
    ("no access by default", {}, None, "no_access"),
    (
        "suspended beats everything",
        {"user_status": "suspended", "override": _override("grant", MANAGER)},
        None,
        "suspended",
    ),
    (
        "disabled app",
        {"app_status": "disabled", "department_grants": [DepartmentGrant(SALES, VIEWER)]},
        None,
        "app_disabled",
    ),
    ("system app gives lowest role", {"app_is_system": True}, VIEWER, "system_app"),
    ("system app with no roles", {"app_is_system": True, "app_roles": []}, None, "no_access"),
    (
        "single department",
        {"department_grants": [DepartmentGrant(SALES, EDITOR)]},
        EDITOR,
        "department",
    ),
    (
        "highest department role wins",
        {"department_grants": [DepartmentGrant(FINANCE, VIEWER), DepartmentGrant(SALES, MANAGER)]},
        MANAGER,
        "department",
    ),
    (
        "deny beats department",
        {"override": _override("deny"), "department_grants": [DepartmentGrant(SALES, MANAGER)]},
        None,
        "override_deny",
    ),
    (
        "grant replaces a higher department role",
        {
            "override": _override("grant", VIEWER),
            "department_grants": [DepartmentGrant(SALES, MANAGER)],
        },
        VIEWER,
        "override_grant",
    ),
    (
        "grant without departments",
        {"override": _override("grant", EDITOR)},
        EDITOR,
        "override_grant",
    ),
    (
        "future expiry still active",
        {
            "override": _override("deny", expires_at=NOW + timedelta(seconds=1)),
            "department_grants": [DepartmentGrant(SALES, VIEWER)],
        },
        None,
        "override_deny",
    ),
    (
        "expired deny is ignored",
        {
            "override": _override("deny", expires_at=NOW),
            "department_grants": [DepartmentGrant(SALES, VIEWER)],
        },
        VIEWER,
        "department",
    ),
    (
        "expired grant falls back to no access",
        {"override": _override("grant", MANAGER, expires_at=NOW - timedelta(days=1))},
        None,
        "no_access",
    ),
]


@pytest.mark.parametrize(("case", "kwargs", "expected_role", "expected_reason"), CASES)
def test_decide(case, kwargs, expected_role, expected_reason):
    decision = _decide(**kwargs)
    assert decision.role == expected_role, case
    assert decision.reason == expected_reason, case


def test_decision_reports_winning_department():
    grants = [DepartmentGrant(FINANCE, VIEWER), DepartmentGrant(SALES, MANAGER)]
    assert _decide(department_grants=grants).department_id == SALES
