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
        user_is_admin=False,
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
    (
        "coming-soon app still resolves so access is ready at launch",
        {"app_status": "coming_soon", "department_grants": [DepartmentGrant(SALES, VIEWER)]},
        VIEWER,
        "department",
    ),
    (
        "admin gets the highest role without any department",
        {"user_is_admin": True},
        MANAGER,
        "admin",
    ),
    (
        "admin access beats a block exception",
        {"user_is_admin": True, "override": _override("deny")},
        MANAGER,
        "admin",
    ),
    (
        "admin access beats a lower grant exception",
        {"user_is_admin": True, "override": _override("grant", VIEWER)},
        MANAGER,
        "admin",
    ),
    (
        "admin sees coming-soon apps with the highest role",
        {"user_is_admin": True, "app_status": "coming_soon"},
        MANAGER,
        "admin",
    ),
    (
        "suspended admin gets nothing",
        {"user_is_admin": True, "user_status": "suspended"},
        None,
        "suspended",
    ),
    (
        "disabled app stays closed to admins",
        {"user_is_admin": True, "app_status": "disabled"},
        None,
        "app_disabled",
    ),
    (
        "admin in the portal keeps its single role",
        {"user_is_admin": True, "app_is_system": True},
        VIEWER,
        "system_app",
    ),
    (
        "admin with no app roles gets nothing",
        {"user_is_admin": True, "app_roles": []},
        None,
        "no_access",
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
