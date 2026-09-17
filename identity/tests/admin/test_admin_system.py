from datetime import timedelta

from sqlalchemy import select

from app.models import SigningKey
from app.security import utcnow


def test_audit_log_filters(api, admin):
    api.post("/admin/departments", json={"slug": "ops", "name": "Ops"})
    entries = api.get("/admin/audit", params={"event": "department_created"}).json()
    assert len(entries) == 1
    assert entries[0]["actor_user_id"] == str(admin.id)
    assert entries[0]["request_id"]


def test_key_rotation_keeps_old_key_published(api, db):
    old_kid = db.scalar(select(SigningKey.kid).where(SigningKey.retired_at.is_(None)))
    old_token = api.headers["Authorization"]

    new_kid = api.post("/admin/keys/rotate").json()["kid"]

    kids = {k["kid"] for k in api.get("/jwks").json()["keys"]}
    assert {old_kid, new_kid} <= kids
    assert api.get("/me", headers={"Authorization": old_token}).status_code == 200


def test_retired_key_unpublished_after_24h(api, db):
    old_kid = db.scalar(select(SigningKey.kid).where(SigningKey.retired_at.is_(None)))
    api.post("/admin/keys/rotate")
    db.get(SigningKey, old_kid).retired_at = utcnow() - timedelta(hours=25)
    db.commit()
    assert old_kid not in {k["kid"] for k in api.get("/jwks").json()["keys"]}
