"""HTTP client for the local PACT Automation service."""

from __future__ import annotations

from typing import Any

import httpx

from .config import PACT_AUTOMATION_TIMEOUT, PACT_AUTOMATION_TOKEN, PACT_AUTOMATION_URL


class PactServiceError(Exception):
    """Raised when the local PACT Automation service cannot complete a request."""


def configured() -> bool:
    return bool(PACT_AUTOMATION_URL)


def _headers() -> dict[str, str]:
    if not PACT_AUTOMATION_TOKEN:
        return {}
    return {"Authorization": f"Bearer {PACT_AUTOMATION_TOKEN}"}


def _url(path: str) -> str:
    return f"{PACT_AUTOMATION_URL.rstrip('/')}{path}"


async def _request(method: str, path: str, **kwargs: Any) -> Any:
    if not configured():
        raise PactServiceError("PACT Automation is not configured")
    try:
        async with httpx.AsyncClient(timeout=PACT_AUTOMATION_TIMEOUT) as client:
            response = await client.request(method, _url(path), headers=_headers(), **kwargs)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as error:
        detail = error.response.text[:300] or error.response.reason_phrase
        raise PactServiceError(f"PACT Automation returned HTTP {error.response.status_code}: {detail}") from error
    except (httpx.HTTPError, ValueError) as error:
        raise PactServiceError(f"Could not reach PACT Automation: {error}") from error
    except Exception as error:
        raise PactServiceError(f"PACT Automation request failed: {error}") from error


async def status() -> dict[str, Any]:
    return await _request("GET", "/api/status")


async def entries() -> list[dict[str, Any]]:
    value = await _request("GET", "/api/entries")
    return value if isinstance(value, list) else []


async def create_entry(record: dict[str, Any], source: str = "kiranos") -> dict[str, Any]:
    return await _request("POST", "/api/entries", json={"record": record, "source": source})


async def approve_entry(entry_id: int) -> dict[str, Any]:
    return await _request("POST", f"/api/entries/{entry_id}/approve")


async def reject_entry(entry_id: int) -> dict[str, Any]:
    return await _request("POST", f"/api/entries/{entry_id}/reject")


async def entry_log(entry_id: int) -> str:
    try:
        # First attempt dedicated log endpoint if available on the PACT service
        try:
            direct_log = await _request("GET", f"/api/entries/{entry_id}/log")
            if isinstance(direct_log, dict) and "log" in direct_log:
                return str(direct_log["log"])
            if isinstance(direct_log, str):
                return direct_log
        except Exception:
            pass

        # Fallback to inspecting entries list
        records = await entries()
        entry = next((item for item in records if item.get("id") == entry_id), None)
        if not entry:
            raise PactServiceError(f"PACT entry {entry_id} was not found")
        log = entry.get("log", "")
        if isinstance(log, str):
            return log
        if isinstance(log, list):
            return "\n".join(str(item) for item in log)
        return ""
    except PactServiceError:
        raise
    except Exception as error:
        raise PactServiceError(f"Failed to fetch PACT entry log for {entry_id}: {error}") from error