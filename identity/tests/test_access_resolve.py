from datetime import timedelta

from app.access import resolve_access, resolve_role
from app.security import utcnow
from tests.factories import (
    add_override,
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)


def test_resolves_highest_role_across_departments(db):
    user = make_user(db)
    sales, finance = make_department(db), make_department(db)
    add_to_department(db, user, sales)
    add_to_department(db, user, finance)
    app, roles = make_app(db)
    grant_department(db, sales, app, roles["manager"])
    grant_department(db, finance, app, roles["viewer"])

    decision = resolve_access(db, user, app)

    assert decision.role.key == "manager"
    assert decision.department_id == sales.id


def test_ignores_departments_the_user_is_not_in(db):
    user = make_user(db)
    other = make_department(db)
    app, roles = make_app(db)
    grant_department(db, other, app, roles["manager"])

    assert resolve_role(db, user, app) is None


def test_ignores_grants_for_other_apps(db):
    user = make_user(db)
    sales = make_department(db)
    add_to_department(db, user, sales)
    crm, crm_roles = make_app(db)
    invoicing, _ = make_app(db)
    grant_department(db, sales, crm, crm_roles["viewer"])

    assert resolve_role(db, user, invoicing) is None


def test_override_grant_and_expiry(db):
    user = make_user(db)
    app, roles = make_app(db)
    add_override(db, user, app, "grant", roles["viewer"], expires_at=utcnow() + timedelta(days=1))

    assert resolve_role(db, user, app).key == "viewer"
    assert resolve_role(db, user, app, now=utcnow() + timedelta(days=2)) is None
