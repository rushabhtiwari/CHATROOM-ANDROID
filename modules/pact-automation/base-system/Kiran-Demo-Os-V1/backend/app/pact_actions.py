"""Controlled PACT Automation action interfaces and formatting helpers for KiranOS."""

from __future__ import annotations

from typing import Any, Optional

from . import pact_client


async def pact_status() -> dict[str, Any]:
    """Fetch current PACT Automation worker and profile status."""
    return await pact_client.status()


async def pact_list_entries(status_filter: Optional[str] = None) -> list[dict[str, Any]]:
    """List PACT entries, optionally filtered by status (e.g. 'pending', 'saved', 'failed')."""
    all_entries = await pact_client.entries()
    if status_filter:
        target = status_filter.strip().lower()
        return [e for e in all_entries if str(e.get("status", "")).lower() == target]
    return all_entries


async def pact_create_entry(record: dict[str, Any], source: str = "kiranos-chat") -> dict[str, Any]:
    """Create a new pending entry in PACT Automation."""
    return await pact_client.create_entry(record, source=source)


async def pact_approve_entry(entry_id: int) -> dict[str, Any]:
    """Approve a PACT entry by ID for processing."""
    return await pact_client.approve_entry(entry_id)


async def pact_reject_entry(entry_id: int) -> dict[str, Any]:
    """Reject a PACT entry by ID."""
    return await pact_client.reject_entry(entry_id)


async def pact_get_entry_log(entry_id: int) -> str:
    """Retrieve execution log for a PACT entry."""
    return await pact_client.entry_log(entry_id)


def format_status_message(status_data: dict[str, Any]) -> str:
    """Human-friendly summary of PACT Automation service status."""
    worker_alive = status_data.get("worker_alive", False)
    busy = status_data.get("busy", False)
    current = status_data.get("current")
    settings = status_data.get("settings", {}) or {}

    profile = settings.get("profile", "unknown")
    dry_run = "Enabled" if settings.get("dry_run") else "Disabled"
    auto_save = "Enabled" if settings.get("auto_save") else "Disabled"

    state_str = f"Busy (processing entry #{current})" if busy else "Idle (ready for queue)"
    worker_str = "Online" if worker_alive else "Offline"

    return (
        f"**PACT Automation Status**\n"
        f"- **Worker:** {worker_str}\n"
        f"- **State:** {state_str}\n"
        f"- **Active Profile:** `{profile}`\n"
        f"- **Dry-Run Mode:** {dry_run}\n"
        f"- **Auto-Save Mode:** {auto_save}"
    )


def format_record_for_confirmation(record: dict[str, Any]) -> str:
    """Format customer record key-values for user confirmation."""
    lines = []
    for key, val in record.items():
        title = key.replace("_", " ").title()
        lines.append(f"- **{title}:** {val}")
    return "\n".join(lines)


def format_entries_message(entries: list[dict[str, Any]], status_filter: Optional[str] = None) -> str:
    """Format a list of entries cleanly for chat display."""
    if not entries:
        if status_filter:
            return f"No PACT entries found with status `{status_filter}`."
        return "No PACT entries currently in the queue."

    header = f"**PACT Entries ({len(entries)})**" if not status_filter else f"**PACT Entries - {status_filter.capitalize()} ({len(entries)})**"
    items = []
    for entry in entries:
        e_id = entry.get("id")
        e_status = entry.get("status", "unknown").upper()
        record = entry.get("record", {}) or {}
        cust = (
            record.get("Customer")
            or record.get("customer")
            or record.get("customer_name")
            or record.get("party_name")
            or record.get("company")
            or "Unknown Party"
        )
        city = record.get("City") or record.get("city") or ""
        city_str = f" ({city})" if city else ""
        source = entry.get("source", "kiranos")
        items.append(f"- **#{e_id}** [{e_status}] {cust}{city_str} — _source: {source}_")

    return f"{header}\n" + "\n".join(items)
