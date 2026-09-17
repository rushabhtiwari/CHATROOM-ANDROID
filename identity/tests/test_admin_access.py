from joserfc import jwt
from joserfc.jwk import KeySet
from sqlalchemy import select

from app.models import App, User
from tests.factories import (
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)
from tests.oidc_helpers import full_login, portal_token, refresh, sign_in


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_admins_see_every_available_app(client, db, settings):
    admin = make_user(db, is_admin=True)
    make_app(db, slug="crm")
    disabled, _ = make_app(db, slug="old-tool", status="disabled")
    token = portal_token(client, db, admin, settings)

    apps = {a["slug"]: a for a in client.get("/me/apps", headers=_auth(token)).json()}

    catalog = db.scalars(
        select(App.slug).where(App.is_system.is_(False), App.status != "disabled")
    ).all()
    assert set(apps) == set(catalog)
    assert apps["crm"]["role"] == "manager"
    assert apps["chat"]["role"] == "manager" and apps["chat"]["status"] == "coming_soon"
    assert "old-tool" not in apps


def test_admin_tokens_carry_the_highest_role(client, db):
    admin = make_user(db, is_admin=True)
    app, _ = make_app(db, slug="crm")
    sign_in(client, db, admin)

    tokens = full_login(client, app)

    keys = KeySet.import_key_set(client.get("/jwks").json())
    assert (
        jwt.decode(tokens["access_token"], keys, algorithms=["RS256"]).claims["role"] == "manager"
    )


def test_losing_admin_rights_falls_back_at_next_refresh(client, db):
    person = make_user(db, is_admin=True)
    team = make_department(db)
    add_to_department(db, person, team)
    app, roles = make_app(db, slug="crm")
    grant_department(db, team, app, roles["viewer"])
    sign_in(client, db, person)
    tokens = full_login(client, app)

    db.get(User, person.id).is_admin = False
    db.commit()
    refreshed = refresh(client, app, tokens["refresh_token"]).json()

    keys = KeySet.import_key_set(client.get("/jwks").json())
    assert (
        jwt.decode(refreshed["access_token"], keys, algorithms=["RS256"]).claims["role"] == "viewer"
    )
