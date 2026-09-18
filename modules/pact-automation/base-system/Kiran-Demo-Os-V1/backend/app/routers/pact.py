"""KiranOS API boundary for the local PACT Automation worker."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import ANTHROPIC_API_KEY, PACT_AUTOMATION_TOKEN
from .. import pact_client

router = APIRouter(prefix="/pact", tags=["pact-automation"])


def _sanitize_response(data: Any) -> Any:
    """Ensure sensitive tokens, passwords, and API keys are never exposed in API responses."""
    if isinstance(data, dict):
        sanitized: dict[str, Any] = {}
        for k, v in data.items():
            k_lower = str(k).lower()
            if any(secret_kw in k_lower for secret_kw in ("token", "secret", "password", "api_key", "auth_header")):
                continue
            sanitized[k] = _sanitize_response(v)
        return sanitized
    if isinstance(data, list):
        return [_sanitize_response(x) for x in data]
    if isinstance(data, str):
        val = data
        if PACT_AUTOMATION_TOKEN and PACT_AUTOMATION_TOKEN in val:
            val = val.replace(PACT_AUTOMATION_TOKEN, "[REDACTED_PACT_TOKEN]")
        if ANTHROPIC_API_KEY and ANTHROPIC_API_KEY in val:
            val = val.replace(ANTHROPIC_API_KEY, "[REDACTED_ANTHROPIC_KEY]")
        return val
    return data


class PactEntryRequest(BaseModel):
    record: dict[str, Any] = Field(min_length=1)
    source: str = Field(default="kiranos", min_length=1, max_length=120)


async def _call(operation):
    try:
        raw = await operation()
        return _sanitize_response(raw)
    except pact_client.PactServiceError as error:
        detail = _sanitize_response(str(error))
        raise HTTPException(status_code=503, detail=detail) from error


@router.get("/status")
async def status():
    return await _call(pact_client.status)


@router.get("/entries")
async def entries():
    return await _call(pact_client.entries)


@router.post("/entries")
async def create_entry(body: PactEntryRequest):
    return await _call(lambda: pact_client.create_entry(body.record, body.source))


@router.post("/entries/{entry_id}/approve")
async def approve_entry(entry_id: int):
    return await _call(lambda: pact_client.approve_entry(entry_id))


@router.post("/entries/{entry_id}/reject")
async def reject_entry(entry_id: int):
    return await _call(lambda: pact_client.reject_entry(entry_id))


@router.get("/entries/{entry_id}/log")
async def entry_log(entry_id: int):
    log_text = await _call(lambda: pact_client.entry_log(entry_id))
    return {"id": entry_id, "log": log_text}