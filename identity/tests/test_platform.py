from app.ratelimit import FixedWindowLimiter


def test_fixed_window_limiter():
    now = [0.0]
    limiter = FixedWindowLimiter(limit=2, window_seconds=60, clock=lambda: now[0])
    assert limiter.allow("ip") and limiter.allow("ip")
    assert not limiter.allow("ip")
    assert limiter.allow("other-ip")
    now[0] = 61.0
    assert limiter.allow("ip")


def test_health_and_readiness(client):
    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.get("/readyz").status_code == 200


def test_request_id_is_echoed_or_generated(client):
    echoed = client.get("/healthz", headers={"X-Request-ID": "abc-123"})
    assert echoed.headers["x-request-id"] == "abc-123"
    generated = client.get("/healthz", headers={"X-Request-ID": "bad id!"}).headers["x-request-id"]
    assert generated != "bad id!" and len(generated) == 32
