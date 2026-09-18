"""Keep the suite away from the live demo data.

Every store in this backend persists to `backend/data` and calls `reset()` in tests, so
without this the suite overwrites the real order ledger, the console state and the
calendar with seed data - silently, and permanently. The environment is set here, before
any test module imports `app.config`, so every path derived from DATA_DIR lands in a
scratch directory that is thrown away afterwards.

The mail and SMTP credentials from `backend/.env` are blanked for the same reason: with
them present the suite would poll a real mailbox and put real messages on the wire.
"""

from __future__ import annotations

import os
import tempfile

_scratch = tempfile.mkdtemp(prefix="kiranos-tests-")
os.environ["KIRANOS_DATA_DIR"] = os.path.join(_scratch, "data")
os.environ["KIRANOS_UPLOAD_DIR"] = os.path.join(_scratch, "uploads")
os.environ["SMTP_SEND"] = "false"
os.environ["IMAP_USER"] = ""
os.environ["IMAP_APP_PASSWORD"] = ""
os.environ["IMAP_PASSWORD"] = ""
os.environ["DEMO_MAIL_REDIRECT"] = ""
os.environ["PACT_AUTO_RELEASE"] = "false"
