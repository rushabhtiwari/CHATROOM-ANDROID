"""Automated integration and router test suite for KiranOS backend."""

import io
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.config import has_api_key


class TestKiranOSBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_root(self):
        """`/` answers. It is the console once that is built, the descriptor before."""
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        if res.headers.get("content-type", "").startswith("text/html"):
            self.assertIn("<div id=\"root\"", res.text)
        else:
            self.assertEqual(res.json()["service"], "KiranOS API")

    def test_api_descriptor_does_not_depend_on_the_console_build(self):
        res = self.client.get("/api")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["service"], "KiranOS API")
        self.assertIn("state", data)
        self.assertIn("docs", data)

    def test_an_unknown_api_path_is_a_404_not_the_console(self):
        """The single-page fallback must never swallow a mistyped API route."""
        res = self.client.get("/api/definitely-not-a-route")
        self.assertEqual(res.status_code, 404)

    def test_health(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json().get("ok"))

    def test_openapi_schema(self):
        openapi = app.openapi()
        self.assertEqual(openapi["info"]["title"], "KiranOS API")
        self.assertGreaterEqual(len(openapi["paths"]), 25)

    def test_state_snapshot(self):
        res = self.client.get("/api/state")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        for key in ("version", "currentEmployeeId", "employees", "requests", "payouts", "notifications"):
            self.assertIn(key, data)

    def test_requests_list_and_detail(self):
        res = self.client.get("/api/requests")
        self.assertEqual(res.status_code, 200)
        requests = res.json()
        self.assertIsInstance(requests, list)
        self.assertGreater(len(requests), 0)

        first_id = requests[0]["id"]
        res_detail = self.client.get(f"/api/requests/{first_id}")
        self.assertEqual(res_detail.status_code, 200)
        self.assertEqual(res_detail.json()["id"], first_id)

        # Test non-existent request returns 404
        res_not_found = self.client.get("/api/requests/NON_EXISTENT_ID")
        self.assertEqual(res_not_found.status_code, 404)

    def test_request_headroom(self):
        res = self.client.get("/api/requests")
        requests = res.json()
        first_id = requests[0]["id"]
        res_hr = self.client.get(f"/api/requests/{first_id}/headroom")
        self.assertEqual(res_hr.status_code, 200)
        hr_data = res_hr.json()
        self.assertIn("headroom", hr_data)
        self.assertIn("sufficient", hr_data)

        # Non-existent request headroom returns 404
        res_hr_missing = self.client.get("/api/requests/NON_EXISTENT_ID/headroom")
        self.assertEqual(res_hr_missing.status_code, 404)

    def test_payouts_and_payees(self):
        res_payouts = self.client.get("/api/payouts")
        self.assertEqual(res_payouts.status_code, 200)
        self.assertIsInstance(res_payouts.json(), list)

        res_payees = self.client.get("/api/payees")
        self.assertEqual(res_payees.status_code, 200)
        self.assertIsInstance(res_payees.json(), list)

    def test_notifications_lifecycle(self):
        res = self.client.get("/api/notifications")
        self.assertEqual(res.status_code, 200)
        notifs = res.json()
        self.assertIsInstance(notifs, list)

        res_read_all = self.client.post("/api/notifications/read-all")
        self.assertEqual(res_read_all.status_code, 200)

    def test_receipts_sample(self):
        res_status = self.client.get("/api/receipts/status")
        self.assertEqual(res_status.status_code, 200)
        self.assertIn("configured", res_status.json())

        # Sample extraction test
        res_sample = self.client.post("/api/receipts/extract", data={"use_sample": "true"})
        self.assertEqual(res_sample.status_code, 200)
        data = res_sample.json()
        self.assertIn("receipts", data)
        self.assertIn("extraction", data)

    def test_receipts_file_upload(self):
        # Upload a valid dummy image file and verify clean heuristic fallback
        dummy_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
        files = {"files": ("test_taxi_receipt.png", io.BytesIO(dummy_png), "image/png")}
        res = self.client.post("/api/receipts/extract", files=files)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("receipts", data)
        self.assertEqual(len(data["receipts"]), 1)
        self.assertEqual(data["receipts"][0]["fileName"], "test_taxi_receipt.png")
        self.assertIn("extraction", data)
        self.assertIn(data["receipts"][0]["id"], data["extraction"]["receiptIds"])

    def test_receipts_upload_validation(self):
        # Empty file content should return 400
        empty_files = {"files": ("empty.png", io.BytesIO(b""), "image/png")}
        res_empty = self.client.post("/api/receipts/extract", files=empty_files)
        self.assertEqual(res_empty.status_code, 400)
        self.assertIn("empty", res_empty.json()["detail"].lower())

        # No files provided with use_sample=false should return 400
        res_no_file = self.client.post("/api/receipts/extract", data={"use_sample": "false"})
        self.assertEqual(res_no_file.status_code, 400)
        self.assertIn("no files", res_no_file.json()["detail"].lower())

    def test_agent_fallback(self):
        res_status = self.client.get("/api/agent/status")
        self.assertEqual(res_status.status_code, 200)

        # Agent fallback response when API key is unconfigured or placeholder must be 200 with demo: True
        res_agent = self.client.post(
            "/api/agent",
            json={"prompt": "Summarize recent decisions", "mode": "chat", "stream": False},
        )
        self.assertEqual(res_agent.status_code, 200)
        data = res_agent.json()
        self.assertIn("reply", data)
        self.assertTrue(data.get("demo"))

    def test_agent_streaming_fallback(self):
        # Agent streaming response in offline fallback mode
        res_stream = self.client.post(
            "/api/agent",
            json={"prompt": "Summarize", "mode": "chat", "stream": True},
        )
        self.assertEqual(res_stream.status_code, 200)
        self.assertIn("text/event-stream", res_stream.headers.get("content-type", ""))
        body = res_stream.text
        self.assertIn("data:", body)
        self.assertIn("[DONE]", body)

    def test_has_api_key_validation(self):
        # Verify edge cases for api key evaluation
        with patch("app.config.ANTHROPIC_API_KEY", ""):
            self.assertFalse(has_api_key())
        with patch("app.config.ANTHROPIC_API_KEY", "   "):
            self.assertFalse(has_api_key())
        with patch("app.config.ANTHROPIC_API_KEY", "sk-ant-..."):
            self.assertFalse(has_api_key())
        with patch("app.config.ANTHROPIC_API_KEY", "your-api-key-here-12345678"):
            self.assertFalse(has_api_key())
        with patch("app.config.ANTHROPIC_API_KEY", "sk-ant-placeholder-key-0123456789"):
            self.assertFalse(has_api_key())
        with patch("app.config.ANTHROPIC_API_KEY", "short-key"):
            self.assertFalse(has_api_key())
        with patch("app.config.ANTHROPIC_API_KEY", "sk-ant-api03-abcdef1234567890abcdef1234567890"):
            self.assertTrue(has_api_key())

    def test_calendar_events_and_reset(self):
        res_events = self.client.get("/api/calendar/events")
        self.assertEqual(res_events.status_code, 200)
        self.assertIn("events", res_events.json())
        self.assertIsInstance(res_events.json()["events"], list)

        res_reset = self.client.post("/api/calendar/reset")
        self.assertEqual(res_reset.status_code, 200)


if __name__ == "__main__":
    unittest.main()

