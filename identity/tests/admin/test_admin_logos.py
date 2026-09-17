import struct
import zlib

from sqlalchemy import select

from app.models import App
from tests.factories import make_app, make_user
from tests.oidc_helpers import portal_token


def png(size: int = 0) -> bytes:
    """A valid 1x1 PNG, optionally padded with an ancillary chunk to reach roughly `size` bytes."""

    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    pixels = chunk(b"IDAT", zlib.compress(b"\x00\xff\xff\xff"))
    padding = chunk(b"tEXt", b"x" * max(0, size - 70)) if size else b""
    return b"\x89PNG\r\n\x1a\n" + header + padding + pixels + chunk(b"IEND", b"")


JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 60
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 40
SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
GIF = b"GIF89a" + b"\x00" * 40


def upload(api, app_id, content: bytes, name="logo.png", declared="image/png"):
    return api.put(f"/admin/apps/{app_id}/logo", files={"file": (name, content, declared)})


def test_upload_detects_type_from_bytes_and_serves_it(api, db, audited):
    app, _ = make_app(db, slug="crm")

    response = upload(api, app.id, JPEG, name="logo.png", declared="image/png")

    assert response.status_code == 200, response.text
    assert isinstance(response.json()["logo_version"], int)
    served = api.get("/apps/crm/logo")
    assert served.status_code == 200
    assert served.content == JPEG
    assert served.headers["content-type"] == "image/jpeg"
    assert served.headers["cache-control"] == "private, max-age=86400"
    assert served.headers["x-content-type-options"] == "nosniff"
    assert served.headers["content-security-policy"] == "default-src 'none'"
    assert audited("app_logo_updated")


def test_png_and_webp_are_accepted(api, db):
    app, _ = make_app(db, slug="crm")
    assert upload(api, app.id, png()).status_code == 200
    assert api.get("/apps/crm/logo").headers["content-type"] == "image/png"
    assert upload(api, app.id, WEBP, name="logo.webp", declared="image/webp").status_code == 200
    assert api.get("/apps/crm/logo").headers["content-type"] == "image/webp"


def test_other_types_and_large_files_are_rejected(api, db):
    app, _ = make_app(db, slug="crm")
    message = "Logo must be a PNG, JPEG or WebP image up to 256 KB"

    for content, name, declared in [
        (SVG, "logo.svg", "image/svg+xml"),
        (SVG, "logo.png", "image/png"),
        (GIF, "logo.gif", "image/gif"),
        (b"hello", "logo.txt", "text/plain"),
        (png(256 * 1024 + 1), "big.png", "image/png"),
    ]:
        response = upload(api, app.id, content, name=name, declared=declared)
        assert response.status_code == 422, name
        assert response.json()["detail"] == message
    assert db.get(App, app.id).logo_content_type is None


def test_remove_logo(api, db, audited):
    app, _ = make_app(db, slug="crm")
    upload(api, app.id, png())

    assert api.delete(f"/admin/apps/{app.id}/logo").status_code == 204

    assert api.get("/apps/crm/logo").status_code == 404
    assert api.get(f"/admin/apps/{app.id}").json()["logo_version"] is None
    assert audited("app_logo_removed")


def test_logo_is_visible_to_any_signed_in_person_but_not_anonymous(client, db, settings):
    app, _ = make_app(db, slug="crm")
    app.logo, app.logo_content_type = png(), "image/png"
    db.commit()
    token = portal_token(client, db, make_user(db), settings)

    assert (
        client.get("/apps/crm/logo", headers={"Authorization": f"Bearer {token}"}).status_code
        == 200
    )
    assert client.get("/apps/crm/logo").status_code == 401
    assert (
        client.get("/apps/nope/logo", headers={"Authorization": f"Bearer {token}"}).status_code
        == 404
    )


def test_logo_version_appears_in_app_detail(api, db):
    chat = db.scalar(select(App).where(App.slug == "chat"))
    upload(api, chat.id, png())
    detail = api.get(f"/admin/apps/{chat.id}").json()
    assert detail["logo_version"] is not None


def test_non_admins_cannot_upload(client, db, settings):
    app, _ = make_app(db, slug="crm")
    token = portal_token(client, db, make_user(db), settings)
    response = client.put(
        f"/admin/apps/{app.id}/logo",
        files={"file": ("logo.png", png(), "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
