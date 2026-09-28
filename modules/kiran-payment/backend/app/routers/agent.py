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
from collections import defaultdict, deque
from typing import Any, AsyncIterator, Literal, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from .. import openai_client
from ..config import ANTHROPIC_API_KEY, OPENAI_MODEL, ai_key_name, has_api_key, use_openai

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
            f"Add `{ai_key_name()}` to `backend/.env` to turn it on."
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
        f"Add `{ai_key_name()}` to `backend/.env` for a real answer."
    )


async def _stream_offline(text: str) -> AsyncIterator[str]:
    """Chunked so the client's streaming renderer is exercised without a key."""
    words = text.split(" ")
    for index in range(0, len(words), 5):
        yield _sse({"delta": " ".join(words[index : index + 5]) + " "})
        await asyncio.sleep(0.02)
    yield _sse({"done": True})
    yield "data: [DONE]\n\n"


async def _stream_openai(body: AgentRequest) -> AsyncIterator[str]:
    system = SYSTEM_SUMMARY if body.mode == "summary" else SYSTEM_CHAT
    try:
        async for delta in openai_client.stream_chat(
            OPENAI_MODEL, system, _messages(body), MAX_OUTPUT_TOKENS
        ):
            yield _sse({"delta": delta})
        yield _sse({"done": True})
        yield "data: [DONE]\n\n"
    except Exception as error:  # noqa: BLE001 — the reason is shown to the user
        yield _sse({"error": openai_client.readable(error)})


async def _stream_model(body: AgentRequest) -> AsyncIterator[str]:
    if use_openai():
        async for frame in _stream_openai(body):
            yield frame
        return
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


def _readable(error: Exception) -> str:
    name = type(error).__name__
    if "credit balance" in str(error).lower():
        # The key authenticates; the account behind it cannot pay for the call.
        return (
            "The Anthropic account has no credit, so the model refused the request. "
            "Add credit under Plans & Billing; the key in backend/.env is fine."
        )
    if "Authentication" in name or "PermissionDenied" in name:
        return "The Anthropic API key was rejected. Check backend/.env."
    if "RateLimit" in name:
        return "The model is rate limited right now. Try again shortly."
    if "Connection" in name or "Timeout" in name or "APITimeout" in name:
        return "Could not reach the model. Check the server's network."
    return "The assistant could not complete that request."


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

    if not has_api_key():
        text = _offline_reply(body)
        if not body.stream:
            return JSONResponse({"reply": text, "demo": True})
        return StreamingResponse(
            _stream_offline(text),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
        )

    if not body.stream and use_openai():
        try:
            text = await openai_client.complete_chat(
                OPENAI_MODEL,
                SYSTEM_SUMMARY if body.mode == "summary" else SYSTEM_CHAT,
                _messages(body),
                MAX_OUTPUT_TOKENS,
            )
            return JSONResponse({"reply": text})
        except Exception as error:  # noqa: BLE001
            return JSONResponse({"error": openai_client.readable(error)}, status_code=502)

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
            return JSONResponse({"reply": text})
        except Exception as error:  # noqa: BLE001
            return JSONResponse({"error": _readable(error)}, status_code=502)

    return StreamingResponse(
        _stream_model(body),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@router.get("/agent/status")
def agent_status() -> dict:
    model = OPENAI_MODEL if use_openai() else AGENT_MODEL
    return {
        "configured": has_api_key(),
        "provider": "openai" if use_openai() else "anthropic",
        "model": model if has_api_key() else None,
    }
