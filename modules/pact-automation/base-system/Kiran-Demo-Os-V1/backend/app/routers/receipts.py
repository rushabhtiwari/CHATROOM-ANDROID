"""Receipt upload and extraction.

Upload and extraction are one round trip on purpose: the employee drops a file
and the claim form fills in. Splitting them would add a second spinner to the
one moment in the demo where latency is already visible.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..config import MAX_UPLOAD_BYTES, UPLOAD_DIR
from ..extraction import describe_backend, extract, sample_extraction
from ..store import store

router = APIRouter(prefix="/receipts", tags=["receipts"])

_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_name(name: str) -> str:
    """Keeps the original name readable but strips anything path-like."""
    cleaned = _SAFE.sub("-", Path(name).name).strip("-.") or "receipt"
    return cleaned[:120]


@router.get("/status")
def status() -> dict:
    """Whether extraction is live, so the UI can say so honestly."""
    return describe_backend()


@router.post("/extract")
async def upload_and_extract(
    files: list[UploadFile] = File(default=[]),
    use_sample: str = Form(default="false"),
) -> dict:
    """Stores the uploaded receipts and returns a claim proposal.

    The response never contains a filed claim — only a suggestion. The employee
    confirms or corrects it, and their submission is what creates the record.
    """
    caps = store.policy_caps()
    wants_sample = str(use_sample).lower() in ("1", "true", "yes")

    if wants_sample and not files:
        extraction = sample_extraction(caps)
        extraction["receiptIds"] = []
        return {"receipts": [], "extraction": extraction}

    if not files:
        raise HTTPException(status_code=400, detail="No files were uploaded.")

    stored: list[dict] = []
    paths: list[Path] = []

    for upload in files:
        payload = await upload.read()
        if not payload:
            continue
        if len(payload) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"{upload.filename} is larger than 10 MB.",
            )

        original = _safe_name(upload.filename or "receipt")
        disk_name = f"{uuid.uuid4().hex[:12]}-{original}"
        path = UPLOAD_DIR / disk_name
        path.write_bytes(payload)
        paths.append(path)

        record = store.register_receipt(
            {
                "fileName": original,
                "sizeKb": max(1, round(len(payload) / 1024)),
                "uploadedOn": datetime.now(timezone.utc)
                .isoformat()
                .replace("+00:00", "Z"),
                "url": f"/uploads/{disk_name}",
                "mimeType": upload.content_type,
                "storedName": disk_name,
            }
        )
        stored.append(record)

    if not stored:
        raise HTTPException(status_code=400, detail="Every uploaded file was empty.")

    extraction = (
        sample_extraction(caps)
        if wants_sample
        else extract(paths, caps, [r["fileName"] for r in stored])
    )
    extraction["receiptIds"] = [r["id"] for r in stored]

    return {"receipts": stored, "extraction": extraction}
