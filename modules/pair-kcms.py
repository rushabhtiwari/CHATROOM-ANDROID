"""Pairs KCMS with the identity service so the Projects tile signs people in silently.

Piped into the identity container by start-modules.ps1, with the shared secret in
KCMS_CLIENT_SECRET. Sets that secret and the callback address on the `projects` app.
Safe to run on every start: nothing is written when the pairing already matches.
"""

import os

from sqlalchemy import select

from app.db import get_sessionmaker
from app.models import App
from app.security import hash_secret, verify_secret

CALLBACK = "http://localhost:3020/auth/central/callback/"

secret = os.environ["KCMS_CLIENT_SECRET"]
with get_sessionmaker()() as db:
    app = db.scalar(select(App).where(App.slug == "projects"))
    if app is None:
        raise SystemExit("no `projects` app in the catalog")
    if not verify_secret(app.client_secret_hash, secret):
        app.client_secret_hash = hash_secret(secret)
    if CALLBACK not in app.redirect_uris:
        app.redirect_uris = [*app.redirect_uris, CALLBACK]
    db.commit()
print("paired")
