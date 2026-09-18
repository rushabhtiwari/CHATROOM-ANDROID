"""OpenClaw transport for the KiranOS assistant contract."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from .config import OPENCLAW_API_KEY, OPENCLAW_API_URL, OPENCLAW_MODEL


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if OPENCLAW_API_KEY:
        headers["Authorization"] = f"Bearer {OPENCLAW_API_KEY}"
    return headers


def _content(data: dict[str, Any]) -> str:
    choices = data.get("choices") or []
    if choices:
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, str):
            return content

    for key in ("reply", "response", "text", "output"):
        value = data.get(key)
        if isinstance(value, str):
            return value
    raise ValueError("OpenClaw returned no assistant text")


def _delta(data: dict[str, Any]) -> str:
    choices = data.get("choices") or []
    if choices:
        choice = choices[0]
        delta = choice.get("delta") or {}
        content = delta.get("content")
        if isinstance(content, str):
            return content
    return data.get("delta", "") if isinstance(data.get("delta", ""), str) else ""


def _payload(messages: list[dict[str, str]], stream: bool) -> dict[str, Any]:
    return {
        "model": OPENCLAW_MODEL,
        "messages": messages,
        "stream": stream,
    }


async def complete(messages: list[dict[str, str]]) -> str:
    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            OPENCLAW_API_URL,
            headers=_headers(),
            json=_payload(messages, stream=False),
        )
        response.raise_for_status()
        return _content(response.json())


async def stream(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    async with httpx.AsyncClient(timeout=90.0) as client:
        async with client.stream(
            "POST",
            OPENCLAW_API_URL,
            headers=_headers(),
            json=_payload(messages, stream=True),
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if not payload or payload == "[DONE]":
                    continue
                try:
                    value = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                if isinstance(value, dict):
                    text = _delta(value)
                    if text:
                        yield text