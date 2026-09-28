"""OpenAI, for when it is the provider (`AI_PROVIDER=openai`, or only its key set).

The assistant and the receipt reader were written against Anthropic's API.
This is the same two calls against OpenAI's Chat Completions: a streamed
reply, and one forced function call that returns a receipt as structured
data. It speaks HTTP through httpx, which the server already depends on,
rather than adding a second SDK for two endpoints.
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator, Optional

import httpx

from .config import OPENAI_API_KEY, OPENAI_BASE_URL

TIMEOUT = httpx.Timeout(90.0, connect=10.0)


class OpenAIError(Exception):
    """A failed call, carrying the HTTP status and OpenAI's own error code."""

    def __init__(self, message: str, status: int = 0, code: str = "") -> None:
        super().__init__(message)
        self.status = status
        self.code = code


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}


def _error_from(response: httpx.Response, body: bytes) -> OpenAIError:
    try:
        error = json.loads(body).get("error") or {}
    except ValueError:
        error = {}
    return OpenAIError(
        error.get("message") or f"OpenAI returned {response.status_code}.",
        response.status_code,
        error.get("code") or error.get("type") or "",
    )


def readable(error: Exception) -> str:
    """What to tell the person, rather than a stack trace."""
    if isinstance(error, OpenAIError):
        if error.code == "insufficient_quota":
            return (
                "The OpenAI account has no credit left, so the model refused the request. "
                "Add credit under Billing; the key in backend/.env is fine."
            )
        if error.status == 401:
            return "The OpenAI API key was rejected. Check OPENAI_API_KEY in backend/.env."
        if error.status == 404 or error.code == "model_not_found":
            return "The OpenAI model is not available to this key. Set OPENAI_MODEL in backend/.env."
        if error.status == 429:
            return "The model is rate limited right now. Try again shortly."
    if isinstance(error, (httpx.ConnectError, httpx.TimeoutException)):
        return "Could not reach OpenAI. Check the server's network."
    return "The assistant could not complete that request."


def _chat_messages(system: str, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{"role": "system", "content": system}, *messages]


async def stream_chat(
    model: str, system: str, messages: list[dict[str, Any]], max_tokens: int
) -> AsyncIterator[str]:
    """Yield the reply's text as it arrives."""
    payload = {
        "model": model,
        "messages": _chat_messages(system, messages),
        "max_completion_tokens": max_tokens,
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream(
            "POST", f"{OPENAI_BASE_URL}/chat/completions", headers=_headers(), json=payload
        ) as response:
            if response.status_code >= 400:
                raise _error_from(response, await response.aread())
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except ValueError:
                    continue
                for choice in chunk.get("choices", []):
                    delta = (choice.get("delta") or {}).get("content")
                    if delta:
                        yield delta


async def complete_chat(
    model: str, system: str, messages: list[dict[str, Any]], max_tokens: int
) -> str:
    """The whole reply at once."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(
            f"{OPENAI_BASE_URL}/chat/completions",
            headers=_headers(),
            json={
                "model": model,
                "messages": _chat_messages(system, messages),
                "max_completion_tokens": max_tokens,
            },
        )
    if response.status_code >= 400:
        raise _error_from(response, response.content)
    choices = response.json().get("choices") or [{}]
    return (choices[0].get("message") or {}).get("content") or ""


def file_part(media_type: str, data_b64: str, filename: str) -> dict[str, Any]:
    """One receipt as a message part: an image, or a PDF as a file."""
    url = f"data:{media_type};base64,{data_b64}"
    if media_type == "application/pdf":
        return {"type": "file", "file": {"filename": filename, "file_data": url}}
    return {"type": "image_url", "image_url": {"url": url}}


def call_function(
    model: str,
    system: str,
    parts: list[dict[str, Any]],
    tool: dict[str, Any],
    max_tokens: int = 2048,
) -> Optional[dict[str, Any]]:
    """Force one call of `tool` and return its arguments, or None if there were none.

    `tool` is in Anthropic's shape (name, description, input_schema); it is
    translated here so the extractor keeps one definition of the receipt.
    """
    function = {
        "name": tool["name"],
        "description": tool.get("description", ""),
        "parameters": tool["input_schema"],
    }
    response = httpx.post(
        f"{OPENAI_BASE_URL}/chat/completions",
        headers=_headers(),
        timeout=TIMEOUT,
        json={
            "model": model,
            "messages": _chat_messages(system, [{"role": "user", "content": parts}]),
            "tools": [{"type": "function", "function": function}],
            "tool_choice": {"type": "function", "function": {"name": tool["name"]}},
            "max_completion_tokens": max_tokens,
        },
    )
    if response.status_code >= 400:
        raise _error_from(response, response.content)
    message = ((response.json().get("choices") or [{}])[0]).get("message") or {}
    for call in message.get("tool_calls") or []:
        arguments = (call.get("function") or {}).get("arguments")
        if isinstance(arguments, str):
            try:
                arguments = json.loads(arguments)
            except ValueError:
                return None
        if isinstance(arguments, dict):
            return arguments
    return None
