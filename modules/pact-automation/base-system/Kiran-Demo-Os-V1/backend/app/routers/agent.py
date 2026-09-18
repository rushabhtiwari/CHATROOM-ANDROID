"""The in-conversation assistant.

Moved here from the chat module's own Node server so the system has one
backend, one key and one place to reason about spend. The browser contract is
unchanged: POST a prompt with the room's recent messages, get server-sent
events back, one `delta` per chunk.

Without a key the endpoint still answers — deterministically, from the context
it was handed. A demo that dies because of a missing environment variable is a
demo that dies in front of the client.
"""

from __future__ import annotations

import asyncio
import json
import time
import re
from collections import defaultdict, deque
from typing import Any, AsyncIterator, Literal, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from .. import openclaw, pact_actions, pact_client
from ..config import (
    ANTHROPIC_API_KEY,
    PACT_AUTOMATION_TOKEN,
    PACT_AUTOMATION_URL,
    has_api_key,
    has_openclaw,
)

router = APIRouter(tags=["assistant"])

# Conversation is cheap, but a runaway client should not be able to spend the
# deployment's budget. One request every five seconds, sustained, is generous.
RATE_LIMIT = 12
RATE_WINDOW = 60.0
MAX_OUTPUT_TOKENS = 1024

AGENT_MODEL = "claude-sonnet-5"

_hits: dict[str, deque[float]] = defaultdict(deque)


def _rate_limited(key: str) -> Optional[int]:
    """Returns the seconds to wait, or None when the request may proceed."""
    now = time.monotonic()
    window = _hits[key]
    while window and now - window[0] > RATE_WINDOW:
        window.popleft()
    if len(window) >= RATE_LIMIT:
        return max(1, int(RATE_WINDOW - (now - window[0])))
    window.append(now)
    return None


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8_000)


class AgentRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8_000)
    # Room context can be long, but it is bounded so a client cannot push an
    # arbitrarily large body through the model on the deployment's key.
    context: str = Field(default="", max_length=24_000)
    history: list[HistoryTurn] = Field(default_factory=list, max_length=12)
    userName: str = Field(default="", max_length=120)
    mode: Literal["chat", "summary"] = "chat"
    stream: bool = False


SYSTEM_CHAT = """You are the assistant inside KiranOS, the operations console \
for Kiran Cable Protection Products Private Limited.

You are answering inside a conversation. Your reply is private to the person \
who asked until they choose to share it.

Be direct and specific. Use the conversation you were given as the source of \
truth, and say plainly when it does not contain the answer rather than \
inventing one. Prefer short paragraphs and tight bullet lists. Name people as \
they are named in the transcript. Amounts are Indian rupees; write them as \
Rs 1,20,000 in the Indian digit grouping.

PACT Automation Integration:
KiranOS is integrated with the local PACT Automation worker for automated ERP workflows.
You can monitor PACT worker status, list queued/pending entries, create records, approve or reject entries, and view execution logs.
Safety and Control Rules for PACT Actions:
- Never perform state-changing actions (creating entries, approving, or rejecting) without explicit user confirmation.
- When a user asks to add a customer or record to PACT, parse the details (Customer, City, Phone, etc.), present the found record clearly, and request confirmation before submitting.
- When asked to approve or reject an entry, verify or request confirmation from the user.
- Never output system secrets, tokens (e.g. PACT_AUTOMATION_TOKEN), or API keys (e.g. ANTHROPIC_API_KEY) in any response.

Never open with a restatement of the question or a pleasantry. Answer."""

SYSTEM_SUMMARY = """You are the assistant inside KiranOS, the operations \
console for Kiran Cable Protection Products Private Limited.

Summarise the conversation you are given for someone catching up. Structure it as:

- A one-line statement of where things stand.
- **Decisions** — what was settled, and by whom.
- **Open items** — what still needs a decision, and who owns it.

Lead with anything addressed to the person catching up. Omit a section that \
has nothing in it rather than writing "none". Keep the whole thing under 200 \
words. Amounts are Indian rupees, written as Rs 1,20,000."""


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _messages(body: AgentRequest) -> list[dict[str, str]]:
    turns: list[dict[str, str]] = [
        {"role": turn.role, "content": turn.content} for turn in body.history
    ]

    prompt = body.prompt
    if body.context.strip():
        prompt = (
            "Recent messages in this conversation:\n"
            f"<transcript>\n{body.context}\n</transcript>\n\n"
            f"{body.prompt}"
        )
    if body.userName:
        prompt = f"(Asked by {body.userName}.)\n\n{prompt}"

    turns.append({"role": "user", "content": prompt})
    return turns


def _offline_reply(body: AgentRequest) -> str:
    """A useful answer built from the transcript when no key is configured.

    This is not a pretend model. It says what it is, and then does the one
    thing it can genuinely do without one: show the recent exchange back,
    attributed, so the person catching up still gets value.
    """
    lines = [line for line in body.context.splitlines() if line.strip()]
    if not lines:
        return (
            "The assistant is not connected to a model right now, and there are "
            "no recent messages in this conversation to work from.\n\n"
            "Add `ANTHROPIC_API_KEY` to `backend/.env` to turn it on."
        )

    speakers: list[str] = []
    for line in lines:
        name = line.split(":", 1)[0].strip()
        if name and name not in speakers:
            speakers.append(name)

    recent = lines[-6:]
    body_text = "\n".join(f"- {line}" for line in recent)
    return (
        "**Running without a model key**, so this is the conversation itself "
        "rather than an analysis of it.\n\n"
        f"**In the room:** {', '.join(speakers[:6])}\n\n"
        f"**Last {len(recent)} messages**\n{body_text}\n\n"
        "Add `ANTHROPIC_API_KEY` to `backend/.env` for a real answer."
    )


async def _stream_offline(text: str) -> AsyncIterator[str]:
    """Chunked so the client's streaming renderer is exercised without a key."""
    words = text.split(" ")
    for index in range(0, len(words), 5):
        yield _sse({"delta": " ".join(words[index : index + 5]) + " "})
        await asyncio.sleep(0.02)
    yield _sse({"done": True})
    yield "data: [DONE]\n\n"


async def _stream_model(body: AgentRequest) -> AsyncIterator[str]:
    try:
        import anthropic
    except ImportError:
        yield _sse({"error": "The anthropic package is not installed on the server."})
        return

    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY, timeout=90.0)
    system = SYSTEM_SUMMARY if body.mode == "summary" else SYSTEM_CHAT

    try:
        async with client.messages.stream(
            model=AGENT_MODEL,
            max_tokens=MAX_OUTPUT_TOKENS,
            system=system,
            messages=_messages(body),
        ) as stream:
            async for delta in stream.text_stream:
                if delta:
                    yield _sse({"delta": delta})
        yield _sse({"done": True})
        yield "data: [DONE]\n\n"
    except Exception as error:  # noqa: BLE001 — the reason is shown to the user
        # The reply may already be part-streamed, so the error has to travel in
        # the stream rather than as a status code.
        yield _sse({"error": _readable(error)})


async def _stream_openclaw(body: AgentRequest) -> AsyncIterator[str]:
    try:
        async for delta in openclaw.stream(
            [
                {"role": "system", "content": SYSTEM_SUMMARY if body.mode == "summary" else SYSTEM_CHAT},
                *_messages(body),
            ]
        ):
            yield _sse({"delta": delta})
        yield _sse({"done": True})
        yield "data: [DONE]\n\n"
    except Exception as error:  # noqa: BLE001 — the reason is shown to the user
        yield _sse({"error": _readable(error)})


def _readable(error: Exception) -> str:
    name = type(error).__name__
    if "Authentication" in name or "PermissionDenied" in name:
        return "The Anthropic API key was rejected. Check backend/.env."
    if "RateLimit" in name:
        return "The model is rate limited right now. Try again shortly."
    if "Connection" in name or "Timeout" in name or "APITimeout" in name:
        return "Could not reach the model. Check the server's network."
    return "The assistant could not complete that request."


def _sanitize_secrets(text: str) -> str:
    """Ensure sensitive tokens and keys are never leaked in agent replies."""
    if not text:
        return text
    if PACT_AUTOMATION_TOKEN and PACT_AUTOMATION_TOKEN in text:
        text = text.replace(PACT_AUTOMATION_TOKEN, "[REDACTED_PACT_TOKEN]")
    if ANTHROPIC_API_KEY and ANTHROPIC_API_KEY in text:
        text = text.replace(ANTHROPIC_API_KEY, "[REDACTED_ANTHROPIC_KEY]")
    return text


def _extract_customer_record(text: str) -> Optional[dict[str, Any]]:
    """Extract customer record fields from natural language text."""
    clean = re.sub(r"\bto\s+pact\b", "", text, flags=re.IGNORECASE).strip()

    # Pattern 1: Add [Customer] in [City] with [phone/mobile/contact] [Phone]
    m1 = re.search(
        r"(?:add|create|queue)\s+(?:customer\s+)?(.+?)\s+in\s+([A-Za-z\s]+?)\s+with\s+(?:phone|mobile|contact|tel)\s+([+\d\s-]+?)(?:\.|\s*$)",
        clean,
        re.IGNORECASE,
    )
    if m1:
        cust = m1.group(1).strip().strip("*_`")
        city = m1.group(2).strip().strip("*_`")
        phone = m1.group(3).strip().strip("*_`")
        if cust and (city or phone):
            return {"Customer": cust, "City": city, "Phone": phone}

    # Pattern 2: Add [Customer] with [phone/mobile/contact] [Phone] in [City]
    m2 = re.search(
        r"(?:add|create|queue)\s+(?:customer\s+)?(.+?)\s+with\s+(?:phone|mobile|contact|tel)\s+([+\d\s-]+?)\s+in\s+([A-Za-z\s]+?)(?:\.|\s*$)",
        clean,
        re.IGNORECASE,
    )
    if m2:
        cust = m2.group(1).strip().strip("*_`")
        phone = m2.group(2).strip().strip("*_`")
        city = m2.group(3).strip().strip("*_`")
        if cust and (city or phone):
            return {"Customer": cust, "City": city, "Phone": phone}

    # Pattern 3: Comma separated: Add [Customer], [City], [Phone]
    m3 = re.search(
        r"(?:add|create|queue)\s+(?:customer\s+)?([^,]+),\s*([^,]+?),\s*(?:(?:phone|mobile|contact)\s*)?([+\d\s-]+?)(?:\.|\s*$)",
        clean,
        re.IGNORECASE,
    )
    if m3:
        cust = m3.group(1).strip().strip("*_`")
        city = m3.group(2).strip().strip("*_`")
        phone = m3.group(3).strip().strip("*_`")
        if cust and (city or phone):
            return {"Customer": cust, "City": city, "Phone": phone}

    # Pattern 4: Explicit key-value fields like Customer: ..., City: ..., Phone: ...
    cust_m = re.search(r"(?:customer|name|client|party):\s*([^\n,]+)", text, re.IGNORECASE)
    city_m = re.search(r"(?:city|location):\s*([^\n,]+)", text, re.IGNORECASE)
    phone_m = re.search(r"(?:phone|mobile|tel|contact):\s*([+\d\s-]+)", text, re.IGNORECASE)
    if cust_m:
        rec: dict[str, Any] = {"Customer": cust_m.group(1).strip().strip("*_`")}
        if city_m:
            rec["City"] = city_m.group(1).strip().strip("*_`")
        if phone_m:
            rec["Phone"] = phone_m.group(1).strip().strip("*_`")
        return rec

    return None


async def _handle_pact_intent(body: AgentRequest) -> Optional[str]:
    """Inspect the prompt and conversation history for PACT Automation intents."""
    prompt = body.prompt.strip()
    p_lower = prompt.lower()

    # Find the most recent assistant message and combined recent context
    assistant_turns = [turn.content for turn in body.history if turn.role == "assistant"]
    last_assistant_msg = assistant_turns[-1] if assistant_turns else ""
    recent_context = f"{last_assistant_msg}\n{body.context}".strip()

    # 1. User confirmation: "yes", "confirm", "proceed", "sure", "send it", "do it", "ok", etc.
    confirm_words = {
        "yes",
        "confirm",
        "confirmed",
        "proceed",
        "yes please",
        "sure",
        "send it",
        "do it",
        "approve it",
        "yes, confirm",
        "yes confirm",
        "ok",
        "okay",
        "yep",
        "yeah",
        "go ahead",
    }
    is_confirm = p_lower in confirm_words or any(
        p_lower.startswith(w) for w in ["yes,", "yes ", "confirm ", "proceed "]
    )

    # User cancellation: "no", "cancel", "abort", "nevermind", etc.
    cancel_words = {
        "no",
        "cancel",
        "cancelled",
        "abort",
        "stop",
        "nevermind",
        "don't do it",
        "no thanks",
        "reject it",
        "no, cancel",
        "no cancel",
    }
    is_cancel = p_lower in cancel_words or any(
        p_lower.startswith(w) for w in ["no,", "no ", "cancel ", "abort "]
    )

    if is_cancel:
        ctx_lower = recent_context.lower()
        if (
            "should i send it to pact" in ctx_lower
            or "i found this record:" in ctx_lower
            or "are you sure you want to approve pact entry" in ctx_lower
            or "are you sure you want to reject pact entry" in ctx_lower
        ):
            return "❌ Operation cancelled. No changes were made in PACT Automation."

    if is_confirm and recent_context:
        ctx_lower = recent_context.lower()

        # Check if previous assistant message was asking to send customer record to PACT
        if "should i send it to pact" in ctx_lower or "i found this record:" in ctx_lower:
            rec: dict[str, Any] = {}
            for field in ["Customer", "City", "Phone"]:
                m = re.search(rf"(?:- \*\*{field}:\*\*|\b{field}:)\s*([^\n\r]+)", recent_context, re.IGNORECASE)
                if m:
                    val = m.group(1).strip().strip("*_`")
                    if val and val.lower() not in ("n/a", "unknown"):
                        rec[field] = val
            if rec.get("Customer"):
                try:
                    res = await pact_client.create_entry(rec, source="kiranos-chat")
                    entry_id = res.get("id", "unknown")
                    status = res.get("status", "pending")
                    return (
                        f"✅ Successfully sent record to PACT Automation.\n"
                        f"Created entry #{entry_id} for **{rec.get('Customer')}** with status `{status}`."
                    )
                except pact_client.PactServiceError as err:
                    return f"❌ Could not create PACT entry: {err}"

        # Check if previous assistant message was asking to confirm approve
        approve_matches = re.findall(
            r"(?:approve\s+(?:pact\s+(?:entry\s*)?|entry\s*)?#?|pact\s+entry\s*#?)(\d+)",
            recent_context,
            re.IGNORECASE,
        )
        if ("approve" in ctx_lower or "approval" in ctx_lower) and approve_matches:
            entry_id = int(approve_matches[-1])
            try:
                res = await pact_client.approve_entry(entry_id)
                status = res.get("status", "approved")
                return f"✅ PACT entry #{entry_id} has been approved. Status: `{status}`."
            except pact_client.PactServiceError as err:
                return f"❌ Could not approve PACT entry #{entry_id}: {err}"

        # Check if previous assistant message was asking to confirm reject
        reject_matches = re.findall(
            r"(?:reject\s+(?:pact\s+(?:entry\s*)?|entry\s*)?#?|pact\s+entry\s*#?)(\d+)",
            recent_context,
            re.IGNORECASE,
        )
        if ("reject" in ctx_lower or "rejection" in ctx_lower) and reject_matches:
            entry_id = int(reject_matches[-1])
            try:
                res = await pact_client.reject_entry(entry_id)
                status = res.get("status", "rejected")
                return f"❌ PACT entry #{entry_id} has been rejected. Status: `{status}`."
            except pact_client.PactServiceError as err:
                return f"❌ Could not reject PACT entry #{entry_id}: {err}"

    # 2. Check PACT status / busy
    if (
        "pact status" in p_lower
        or "status of pact" in p_lower
        or "check pact status" in p_lower
        or ("check pact" in p_lower and "entry" not in p_lower)
        or ("pact" in p_lower and "busy" in p_lower)
        or ("pact" in p_lower and "worker" in p_lower and "status" in p_lower)
        or p_lower in ("pact", "pact automation", "pact status?", "status pact")
    ):
        try:
            status_data = await pact_actions.pact_status()
            if "busy" in p_lower:
                busy = status_data.get("busy", False)
                cur = status_data.get("current")
                prefix = (
                    f"PACT is currently **busy with entry #{cur}**."
                    if busy
                    else "PACT is currently **idle** and ready for requests."
                )
                return f"{prefix}\n\n{pact_actions.format_status_message(status_data)}"
            return pact_actions.format_status_message(status_data)
        except pact_client.PactServiceError as err:
            return (
                f"⚠️ Could not reach PACT Automation: {err}\n\n"
                f"Please verify that the PACT Automation service is running on `{PACT_AUTOMATION_URL}`."
            )

    # 3. Add Customer to PACT:
    # "Add [Customer] in [City] with phone [Phone] to PACT"
    if (
        (p_lower.startswith("add ") or p_lower.startswith("create ") or p_lower.startswith("queue "))
        and ("pact" in p_lower or "customer" in p_lower)
    ) or ("add" in p_lower and "to pact" in p_lower):
        record = _extract_customer_record(prompt)
        if record and record.get("Customer"):
            return (
                f"I found this record:\n"
                f"Customer: {record.get('Customer')}\n"
                f"City: {record.get('City', 'N/A')}\n"
                f"Phone: {record.get('Phone', 'N/A')}\n\n"
                f"Should I send it to PACT? (Reply 'yes' or 'confirm' to proceed)"
            )

    # 4. Show / List PACT entries
    if (
        (
            any(k in p_lower for k in ["show", "list", "view", "get", "display", "pending"])
            and "pact" in p_lower
            and any(k in p_lower for k in ["entry", "entries", "queue"])
        )
        or p_lower.startswith("pact entries")
        or p_lower.startswith("pact queue")
        or p_lower.startswith("pending pact")
    ) and not any(kw in p_lower for kw in ["approve", "reject", "fail", "why", "log"]):
        status_filter = None
        for s in ["pending", "saved", "failed", "rejected", "approved"]:
            if s in p_lower:
                status_filter = s
                break
        try:
            entries = await pact_actions.pact_list_entries(status_filter=status_filter)
            return pact_actions.format_entries_message(entries, status_filter=status_filter)
        except pact_client.PactServiceError as err:
            return f"⚠️ Could not fetch PACT entries: {err}"

    # 5. "Why did PACT entry [ID] fail?"
    why_fail_m = re.search(
        r"why\s+(?:did|has)\s+(?:pact\s+(?:entry\s*)?|entry\s*)?#?(\d+)\s+fail(?:ed)?",
        prompt,
        re.IGNORECASE,
    )
    if why_fail_m:
        entry_id = int(why_fail_m.group(1))
        try:
            entries = await pact_actions.pact_list_entries()
            entry = next((e for e in entries if e.get("id") == entry_id), None)
            log = await pact_actions.pact_get_entry_log(entry_id)
            if not entry:
                return f"PACT entry #{entry_id} was not found."

            status = entry.get("status", "unknown")
            error = entry.get("error")
            mismatches = entry.get("result", {}).get("verifier", {}).get("mismatches", [])

            lines = [f"**PACT Entry #{entry_id} Failure Explanation**", f"- **Status:** `{status}`"]
            if error:
                lines.append(f"- **Error:** {error}")
            if mismatches:
                lines.append("- **Verification Mismatches:**")
                for mis in mismatches:
                    field = mis.get("field", "field")
                    exp = mis.get("expected")
                    seen = mis.get("seen")
                    lines.append(f"  • {field}: expected `{exp}`, saw `{seen}`")

            if log:
                lines.append(f"\n**Execution Log Snippet:**\n```\n{log}\n```")
            else:
                lines.append("\n_No log entries recorded for this entry._")

            return "\n".join(lines)
        except pact_client.PactServiceError as err:
            return f"⚠️ Could not retrieve details for PACT entry #{entry_id}: {err}"

    # 6. "Show the log for PACT entry [ID]" / "PACT log for [ID]"
    log_m = re.search(
        r"(?:(?:show|view|get|display)\s+(?:the\s+)?)?(?:pact\s+)?log\s+(?:for\s+)?(?:pact\s+(?:entry\s*)?|entry\s*)?#?(\d+)|pact\s+(?:entry\s*)?#?(\d+)\s+log",
        prompt,
        re.IGNORECASE,
    )
    if log_m:
        entry_id = int(log_m.group(1) or log_m.group(2))
        try:
            log = await pact_actions.pact_get_entry_log(entry_id)
            if not log.strip():
                return f"No log entries recorded for PACT entry #{entry_id}."
            return f"**Log for PACT Entry #{entry_id}:**\n```\n{log}\n```"
        except pact_client.PactServiceError as err:
            return f"⚠️ Could not retrieve log for PACT entry #{entry_id}: {err}"

    # 7. Approve PACT entry [ID]
    approve_m = re.search(
        r"approve\s+(?:pact\s+(?:entry\s*)?|entry\s*)?#?(\d+)",
        prompt,
        re.IGNORECASE,
    )
    if approve_m:
        entry_id = int(approve_m.group(1))
        if "confirm" in p_lower or "yes" in p_lower or "proceed" in p_lower:
            try:
                res = await pact_client.approve_entry(entry_id)
                return f"✅ PACT entry #{entry_id} has been approved. Status: `{res.get('status', 'approved')}`."
            except pact_client.PactServiceError as err:
                return f"❌ Could not approve PACT entry #{entry_id}: {err}"
        return f"Are you sure you want to approve PACT entry #{entry_id}? (Reply 'yes' or 'confirm' to proceed)"

    # 8. Reject PACT entry [ID]
    reject_m = re.search(
        r"reject\s+(?:pact\s+(?:entry\s*)?|entry\s*)?#?(\d+)",
        prompt,
        re.IGNORECASE,
    )
    if reject_m:
        entry_id = int(reject_m.group(1))
        if "confirm" in p_lower or "yes" in p_lower or "proceed" in p_lower:
            try:
                res = await pact_client.reject_entry(entry_id)
                return f"❌ PACT entry #{entry_id} has been rejected. Status: `{res.get('status', 'rejected')}`."
            except pact_client.PactServiceError as err:
                return f"❌ Could not reject PACT entry #{entry_id}: {err}"
        return f"Are you sure you want to reject PACT entry #{entry_id}? (Reply 'yes' or 'confirm' to proceed)"

    return None


@router.post("/agent")
async def agent(body: AgentRequest, request: Request):
    client_key = request.client.host if request.client else "anonymous"
    retry_after = _rate_limited(client_key)
    if retry_after is not None:
        return JSONResponse(
            {"error": f"Too many requests. Try again in {retry_after}s."},
            status_code=429,
            headers={"Retry-After": str(retry_after)},
        )

    # 1. PACT Automation primary control interface (works offline and online)
    pact_reply = await _handle_pact_intent(body)
    if pact_reply is not None:
        pact_reply = _sanitize_secrets(pact_reply)
        if not body.stream:
            return JSONResponse({"reply": pact_reply, "pact": True})
        return StreamingResponse(
            _stream_offline(pact_reply),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
        )

    # 2. Offline fallback mode when no LLM key is configured
    if not has_api_key():
        if has_openclaw():
            if not body.stream:
                try:
                    text = await openclaw.complete(
                        [
                            {"role": "system", "content": SYSTEM_SUMMARY if body.mode == "summary" else SYSTEM_CHAT},
                            *_messages(body),
                        ]
                    )
                    return JSONResponse({"reply": _sanitize_secrets(text), "provider": "openclaw"})
                except Exception as error:  # noqa: BLE001 — the reason is shown to the user
                    return JSONResponse({"error": _readable(error)}, status_code=502)
            return StreamingResponse(
                _stream_openclaw(body),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
            )
        text = _sanitize_secrets(_offline_reply(body))
        if not body.stream:
            return JSONResponse({"reply": text, "demo": True})
        return StreamingResponse(
            _stream_offline(text),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
        )

    # 3. Anthropic Claude model when configured
    if not body.stream:
        try:
            import anthropic

            client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY, timeout=90.0)
            message = await client.messages.create(
                model=AGENT_MODEL,
                max_tokens=MAX_OUTPUT_TOKENS,
                system=SYSTEM_SUMMARY if body.mode == "summary" else SYSTEM_CHAT,
                messages=_messages(body),
            )
            text = "".join(block.text for block in message.content if block.type == "text")
            return JSONResponse({"reply": _sanitize_secrets(text)})
        except Exception as error:  # noqa: BLE001
            return JSONResponse({"error": _readable(error)}, status_code=502)

    return StreamingResponse(
        _stream_model(body),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@router.get("/agent/status")
def agent_status() -> dict:
    if has_openclaw():
        return {"configured": True, "provider": "openclaw", "model": "openclaw"}
    return {
        "configured": has_api_key(),
        "provider": "anthropic" if has_api_key() else None,
        "model": AGENT_MODEL if has_api_key() else None,
    }
