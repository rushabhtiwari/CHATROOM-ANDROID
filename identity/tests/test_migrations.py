import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import App, AppRole, UserAppOverride
from tests.factories import make_app, make_user


def test_portal_client_is_seeded(db):
    portal = db.scalar(select(App).where(App.client_id == "portal"))
    assert portal.is_system is True
    roles = db.scalars(select(AppRole).where(AppRole.app_id == portal.id)).all()
    assert [(r.key, r.rank) for r in roles] == [("user", 10)]


def test_grant_override_requires_role(db):
    user = make_user(db)
    app, _ = make_app(db)
    db.add(UserAppOverride(user_id=user.id, app_id=app.id, effect="grant", reason="x"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_override_role_must_belong_to_same_app(db):
    user = make_user(db)
    app, _ = make_app(db)
    _, other_roles = make_app(db)
    db.add(
        UserAppOverride(
            user_id=user.id,
            app_id=app.id,
            effect="grant",
            app_role_id=other_roles["viewer"].id,
            reason="x",
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()
