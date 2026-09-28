"""OpenAI as the provider: the assistant's stream and receipt reading.

OpenAI itself is replaced by httpx.MockTransport, answering the way the
Chat Completions API does, so these run offline and cost nothing.
"""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from app import config, extraction, openai_client
from app.routers import agent


@pytest.fixture
def openai_on(monkeypatch):
    monkeypatch.setattr(config, "AI_PROVIDER", "openai")
    monkeypatch.setattr(config, "OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(openai_client, "OPENAI_API_KEY", "sk-test")
    return monkeypatch


def route(monkeypatch, handler):
    """Send every httpx request, sync or async, to `handler`."""
    transport = httpx.MockTransport(handler)
    real_async, real_sync = httpx.AsyncClient, httpx.Client

    monkeypatch.setattr(
        httpx, "AsyncClient", lambda **kw: real_async(transport=transport, **kw)
    )

    def post(url, **kw):
        with real_sync(transport=transport) as client:
            return client.post(url, **kw)

    monkeypatch.setattr(httpx, "post", post)


def test_the_provider_follows_the_key(openai_on):
    assert config.use_openai()
    assert config.has_api_key()
    assert config.ai_key_name() == "OPENAI_API_KEY"


def test_the_assistant_streams_openai_deltas(openai_on):
    seen = {}

    def handler(request: httpx.Request):
        seen["body"] = json.loads(request.content)
        seen["auth"] = request.headers["authorization"]
        chunks = [
            {"choices": [{"delta": {"content": "Two quotes, "}}]},
            {"choices": [{"delta": {"content": "Battenfeld leads."}}]},
        ]
        text = "".join(f"data: {json.dumps(c)}\n\n" for c in chunks) + "data: [DONE]\n\n"
        return httpx.Response(200, text=text, headers={"content-type": "text/event-stream"})

    route(openai_on, handler)
    body = agent.AgentRequest(prompt="What was decided?", context="u1: hi", stream=True)

    async def collect():
        return [frame async for frame in agent._stream_model(body)]

    frames = asyncio.run(collect())
    deltas = [json.loads(f[6:])["delta"] for f in frames if '"delta"' in f]
    assert "".join(deltas) == "Two quotes, Battenfeld leads."
    assert seen["auth"] == "Bearer sk-test"
    assert seen["body"]["stream"] is True
    assert seen["body"]["messages"][0]["role"] == "system"
    assert "What was decided?" in seen["body"]["messages"][-1]["content"]


def test_an_account_without_credit_says_so(openai_on):
    def handler(request):
        return httpx.Response(
            429, json={"error": {"message": "quota", "code": "insufficient_quota"}}
        )

    route(openai_on, handler)
    body = agent.AgentRequest(prompt="hi", stream=True)

    async def collect():
        return [frame async for frame in agent._stream_model(body)]

    frames = asyncio.run(collect())
    assert any("no credit" in f for f in frames)


def test_receipts_are_read_through_a_forced_function_call(openai_on, tmp_path):
    receipt = tmp_path / "cab.png"
    receipt.write_bytes(b"\x89PNG\r\n\x1a\nfake")
    seen = {}

    def handler(request: httpx.Request):
        seen["body"] = json.loads(request.content)
        arguments = {"title": "Cab to Plant 2", "category": "TRAVEL", "amount": 640}
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "tool_calls": [
                                {
                                    "type": "function",
                                    "function": {
                                        "name": "record_receipt",
                                        "arguments": json.dumps(arguments),
                                    },
                                }
                            ]
                        }
                    }
                ]
            },
        )

    route(openai_on, handler)
    result = extraction.extract([receipt], caps=[], names=["cab.png"])

    assert result["source"] == "openai"
    assert result["amount"] == 640
    assert result["title"] == "Cab to Plant 2"
    body = seen["body"]
    assert body["tool_choice"]["function"]["name"] == "record_receipt"
    image = body["messages"][1]["content"][0]
    assert image["type"] == "image_url"
    assert image["image_url"]["url"].startswith("data:image/png;base64,")
