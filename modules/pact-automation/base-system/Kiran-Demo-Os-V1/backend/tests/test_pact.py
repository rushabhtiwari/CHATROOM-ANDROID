"""Comprehensive test suite for PACT Automation integration in KiranOS."""

import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.pact_client import PactServiceError


class MockHttpxResponse:
    """Mock for httpx response objects."""

    def __init__(self, status_code: int, json_data: any = None, text: str = ""):
        self.status_code = status_code
        self._json_data = json_data if json_data is not None else {}
        self.text = text or json.dumps(self._json_data)
        self.reason_phrase = "OK" if status_code == 200 else "Error"

    def json(self):
        return self._json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("POST", "http://127.0.0.1:8765/mock")
            response = httpx.Response(self.status_code, text=self.text, request=request)
            raise httpx.HTTPStatusError(
                f"HTTP {self.status_code} Error: {self.text}",
                request=request,
                response=response,
            )


class TestPactAutomation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        from app.routers import agent
        agent._hits.clear()

    # 1. PACT status success
    @patch("httpx.AsyncClient.request")
    def test_pact_status_success(self, mock_request):
        mock_payload = {
            "worker_alive": True,
            "busy": False,
            "current": None,
            "settings": {"profile": "default", "dry_run": False, "auto_save": True},
        }
        mock_request.return_value = MockHttpxResponse(200, mock_payload)

        res = self.client.get("/api/pact/status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("worker_alive"))
        self.assertFalse(data.get("busy"))
        self.assertEqual(data.get("settings", {}).get("profile"), "default")

    # 2. PACT service unavailable (503)
    @patch("httpx.AsyncClient.request", side_effect=httpx.ConnectError("Connection refused"))
    def test_pact_service_unavailable_503(self, _mock_request):
        res = self.client.get("/api/pact/status")
        self.assertEqual(res.status_code, 503)
        self.assertIn("Could not reach PACT Automation", res.json().get("detail", ""))

    # 3. PACT timeout (503)
    @patch("httpx.AsyncClient.request", side_effect=httpx.TimeoutException("Operation timed out"))
    def test_pact_timeout_503(self, _mock_request):
        res = self.client.get("/api/pact/status")
        self.assertEqual(res.status_code, 503)
        self.assertIn("Could not reach PACT Automation", res.json().get("detail", ""))

    # 4. Create entry (200)
    @patch("httpx.AsyncClient.request")
    def test_create_entry_success(self, mock_request):
        created_entry = {
            "id": 101,
            "status": "pending",
            "source": "kiranos-chat",
            "record": {"Customer": "Acme Corp", "City": "Mumbai", "Phone": "9820123456"},
        }
        mock_request.return_value = MockHttpxResponse(200, created_entry)

        res = self.client.post(
            "/api/pact/entries",
            json={"record": {"Customer": "Acme Corp", "City": "Mumbai", "Phone": "9820123456"}, "source": "kiranos-chat"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("id"), 101)
        self.assertEqual(data.get("status"), "pending")

    # 5. Approve entry (200)
    @patch("httpx.AsyncClient.request")
    def test_approve_entry_success(self, mock_request):
        mock_request.return_value = MockHttpxResponse(200, {"id": 101, "status": "approved"})

        res = self.client.post("/api/pact/entries/101/approve")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("id"), 101)
        self.assertEqual(data.get("status"), "approved")

    # 6. Reject entry (200)
    @patch("httpx.AsyncClient.request")
    def test_reject_entry_success(self, mock_request):
        mock_request.return_value = MockHttpxResponse(200, {"id": 101, "status": "rejected"})

        res = self.client.post("/api/pact/entries/101/reject")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("id"), 101)
        self.assertEqual(data.get("status"), "rejected")

    # 7. Invalid payload (empty record returns 422)
    def test_invalid_payload_empty_record(self):
        # Empty dictionary for record
        res_empty_dict = self.client.post("/api/pact/entries", json={"record": {}})
        self.assertEqual(res_empty_dict.status_code, 422)

        # Missing record entirely
        res_missing = self.client.post("/api/pact/entries", json={"source": "test"})
        self.assertEqual(res_missing.status_code, 422)

    # 8. PACT error response (e.g. 409 converted to 503)
    @patch("httpx.AsyncClient.request")
    def test_pact_error_response_409_converted_to_503(self, mock_request):
        mock_request.return_value = MockHttpxResponse(409, text="Entry #101 is already approved or busy")

        res = self.client.post("/api/pact/entries/101/approve")
        self.assertEqual(res.status_code, 503)
        self.assertIn("HTTP 409", res.json().get("detail", ""))

    # 9. Entry log retrieval
    @patch("httpx.AsyncClient.request")
    def test_entry_log_retrieval(self, mock_request):
        sample_log = "[10:27:10] Approved by operator\n[10:27:12] Saved to ERP successfully"
        mock_entries = [
            {"id": 42, "status": "saved", "log": sample_log},
            {"id": 43, "status": "pending", "log": ""},
        ]
        mock_request.return_value = MockHttpxResponse(200, mock_entries)

        res = self.client.get("/api/pact/entries/42/log")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("id"), 42)
        self.assertIsInstance(data.get("log"), str)
        self.assertEqual(data.get("log"), sample_log)

    # 10. Safety test: ensure tokens and keys are never returned
    @patch("app.routers.agent.PACT_AUTOMATION_TOKEN", "super-secret-pact-token-xyz789")
    @patch("app.routers.agent.ANTHROPIC_API_KEY", "sk-ant-super-secret-anthropic-key-abc123")
    @patch("app.pact_client.status", new_callable=AsyncMock)
    def test_safety_secrets_never_returned(self, mock_status):
        mock_status.return_value = {
            "worker_alive": True,
            "busy": False,
            "settings": {"profile": "default", "token_hint": "super-secret-pact-token-xyz789"},
        }

        # Check agent response
        res = self.client.post("/api/agent", json={"prompt": "Check PACT status", "stream": False})
        self.assertEqual(res.status_code, 200)
        reply = res.json().get("reply", "")
        self.assertNotIn("super-secret-pact-token-xyz789", reply)
        self.assertNotIn("sk-ant-super-secret-anthropic-key-abc123", reply)

    # 11. Agent conversational natural language flows
    @patch("app.pact_client.status", new_callable=AsyncMock)
    def test_agent_check_pact_status(self, mock_status):
        mock_status.return_value = {
            "worker_alive": True,
            "busy": False,
            "current": None,
            "settings": {"profile": "production", "dry_run": False, "auto_save": True},
        }

        res = self.client.post("/api/agent", json={"prompt": "Check PACT status", "stream": False})
        self.assertEqual(res.status_code, 200)
        reply = res.json().get("reply", "")
        self.assertIn("PACT Automation Status", reply)
        self.assertIn("production", reply)

    @patch("app.pact_client.status", new_callable=AsyncMock)
    def test_agent_is_pact_busy(self, mock_status):
        mock_status.return_value = {
            "worker_alive": True,
            "busy": True,
            "current": 99,
            "settings": {"profile": "production"},
        }

        res = self.client.post("/api/agent", json={"prompt": "Is PACT currently busy?", "stream": False})
        self.assertEqual(res.status_code, 200)
        reply = res.json().get("reply", "")
        self.assertIn("busy with entry #99", reply)

    @patch("app.pact_client.entries", new_callable=AsyncMock)
    def test_agent_list_pending_entries(self, mock_entries):
        mock_entries.return_value = [
            {"id": 1, "status": "pending", "record": {"Customer": "Acme Industries", "City": "Pune"}},
            {"id": 2, "status": "saved", "record": {"Customer": "Beta Corp", "City": "Delhi"}},
        ]

        res = self.client.post("/api/agent", json={"prompt": "Show pending PACT entries", "stream": False})
        self.assertEqual(res.status_code, 200)
        reply = res.json().get("reply", "")
        self.assertIn("Acme Industries", reply)
        self.assertNotIn("Beta Corp", reply)  # Beta Corp is saved, not pending

    def test_agent_add_customer_request_and_confirmation(self):
        # Step 1: User asks to add customer -> Assistant formats record and asks confirmation
        res1 = self.client.post(
            "/api/agent",
            json={"prompt": "Add Acme Industries in Pune with phone 9820000000 to PACT", "stream": False},
        )
        self.assertEqual(res1.status_code, 200)
        reply1 = res1.json().get("reply", "")
        self.assertIn("Acme Industries", reply1)
        self.assertIn("Pune", reply1)
        self.assertIn("9820000000", reply1)
        self.assertIn("Should I send it to PACT?", reply1)

        # Step 2: User confirms -> Assistant creates entry
        with patch("app.pact_client.create_entry", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = {"id": 88, "status": "pending"}
            res2 = self.client.post(
                "/api/agent",
                json={
                    "prompt": "yes",
                    "history": [{"role": "assistant", "content": reply1}],
                    "stream": False,
                },
            )
            self.assertEqual(res2.status_code, 200)
            reply2 = res2.json().get("reply", "")
            self.assertIn("Created entry #88", reply2)
            mock_create.assert_awaited_once_with(
                {"Customer": "Acme Industries", "City": "Pune", "Phone": "9820000000"},
                source="kiranos-chat",
            )

    @patch("app.pact_client.approve_entry", new_callable=AsyncMock)
    def test_agent_approve_entry_flow(self, mock_approve):
        mock_approve.return_value = {"id": 15, "status": "approved"}

        # Direct prompt asks for confirmation first
        res1 = self.client.post("/api/agent", json={"prompt": "Approve PACT entry 15", "stream": False})
        self.assertEqual(res1.status_code, 200)
        self.assertIn("Are you sure you want to approve PACT entry #15?", res1.json().get("reply", ""))

        # Confirmation turn executes approval
        res2 = self.client.post(
            "/api/agent",
            json={
                "prompt": "yes, confirm",
                "history": [{"role": "assistant", "content": "Are you sure you want to approve PACT entry #15?"}],
                "stream": False,
            },
        )
        self.assertEqual(res2.status_code, 200)
        self.assertIn("PACT entry #15 has been approved", res2.json().get("reply", ""))
        mock_approve.assert_awaited_once_with(15)

    @patch("app.pact_client.entries", new_callable=AsyncMock)
    @patch("app.pact_client.entry_log", new_callable=AsyncMock)
    def test_agent_why_did_entry_fail(self, mock_log, mock_entries):
        mock_entries.return_value = [
            {
                "id": 22,
                "status": "failed",
                "error": "GSTIN verification mismatch",
                "result": {"verifier": {"mismatches": [{"field": "GSTIN", "expected": "27AA", "seen": "29AA"}]}},
            }
        ]
        mock_log.return_value = "[11:00:01] Verification failed on field GSTIN"

        res = self.client.post("/api/agent", json={"prompt": "Why did PACT entry 22 fail?", "stream": False})
        self.assertEqual(res.status_code, 200)
        reply = res.json().get("reply", "")
        self.assertIn("GSTIN verification mismatch", reply)
        self.assertIn("expected `27AA`, saw `29AA`", reply)
        self.assertIn("Verification failed on field GSTIN", reply)

    # 12. Direct API token redaction test
    @patch("app.routers.pact.PACT_AUTOMATION_TOKEN", "leak-secret-pact-token-999")
    @patch("app.routers.pact.ANTHROPIC_API_KEY", "sk-ant-leak-secret-anthropic-key-888")
    @patch("httpx.AsyncClient.request")
    def test_direct_api_sanitization(self, mock_request):
        mock_request.return_value = MockHttpxResponse(
            200,
            {
                "worker_alive": True,
                "token": "leak-secret-pact-token-999",
                "auth_header": "Bearer leak-secret-pact-token-999",
                "settings": {
                    "api_key": "sk-ant-leak-secret-anthropic-key-888",
                    "profile": "default",
                    "note": "configured with leak-secret-pact-token-999",
                },
            },
        )
        res = self.client.get("/api/pact/status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertNotIn("token", data)
        self.assertNotIn("auth_header", data)
        self.assertNotIn("api_key", data.get("settings", {}))
        self.assertNotIn("leak-secret-pact-token-999", json.dumps(data))
        self.assertNotIn("sk-ant-leak-secret-anthropic-key-888", json.dumps(data))

    # 13. Multiline context confirmation test
    @patch("app.pact_client.create_entry", new_callable=AsyncMock)
    def test_agent_multiline_context_confirmation(self, mock_create):
        mock_create.return_value = {"id": 77, "status": "pending"}
        context = (
            "Meera Nair: Add Acme Industries in Pune with phone 9820000000 to PACT\n"
            "Kiran Assistant: I found this record:\n"
            "Customer: Acme Industries\n"
            "City: Pune\n"
            "Phone: 9820000000\n\n"
            "Should I send it to PACT? (Reply 'yes' or 'confirm' to proceed)"
        )
        res = self.client.post(
            "/api/agent",
            json={"prompt": "yes", "context": context, "history": [], "stream": False},
        )
        self.assertEqual(res.status_code, 200)
        reply = res.json().get("reply", "")
        self.assertIn("Created entry #77", reply)
        mock_create.assert_awaited_once_with(
            {"Customer": "Acme Industries", "City": "Pune", "Phone": "9820000000"},
            source="kiranos-chat",
        )

    # 14. Cancellation test
    def test_agent_user_cancellation(self):
        context = (
            "Meera Nair: Add Acme Industries in Pune with phone 9820000000 to PACT\n"
            "Kiran Assistant: I found this record:\n"
            "Customer: Acme Industries\n"
            "City: Pune\n"
            "Phone: 9820000000\n\n"
            "Should I send it to PACT? (Reply 'yes' or 'confirm' to proceed)"
        )
        res = self.client.post(
            "/api/agent",
            json={"prompt": "no, cancel", "context": context, "history": [], "stream": False},
        )
        self.assertEqual(res.status_code, 200)
        reply = res.json().get("reply", "")
        self.assertIn("Operation cancelled", reply)

    # 15. Natural language approve variations test
    def test_agent_approve_variations(self):
        variations = ["approve pact 12", "approve pact #12", "approve #12", "approve entry 12"]
        for var in variations:
            res = self.client.post("/api/agent", json={"prompt": var, "stream": False})
            self.assertEqual(res.status_code, 200)
            self.assertIn("Are you sure you want to approve PACT entry #12?", res.json().get("reply", ""))

    # 16. Natural language reject variations test
    def test_agent_reject_variations(self):
        variations = ["reject pact 12", "reject pact #12", "reject #12", "reject entry 12"]
        for var in variations:
            res = self.client.post("/api/agent", json={"prompt": var, "stream": False})
            self.assertEqual(res.status_code, 200)
            self.assertIn("Are you sure you want to reject PACT entry #12?", res.json().get("reply", ""))

    # 17. Natural language log query variations test
    @patch("app.pact_client.entry_log", new_callable=AsyncMock)
    def test_agent_log_variations(self, mock_log):
        mock_log.return_value = "[12:00:00] Worker started task"
        variations = [
            "Show the log for PACT entry 12",
            "Show log for #12",
            "PACT log for 12",
            "Log for PACT entry 12",
        ]
        for var in variations:
            res = self.client.post("/api/agent", json={"prompt": var, "stream": False})
            self.assertEqual(res.status_code, 200)
            self.assertIn("Log for PACT Entry #12", res.json().get("reply", ""))

    # 18. Natural language why fail variations test
    @patch("app.pact_client.entries", new_callable=AsyncMock)
    @patch("app.pact_client.entry_log", new_callable=AsyncMock)
    def test_agent_why_fail_variations(self, mock_log, mock_entries):
        mock_entries.return_value = [{"id": 12, "status": "failed", "error": "Timeout on field submit"}]
        mock_log.return_value = "Log trace"
        variations = [
            "Why did PACT entry 12 fail?",
            "Why has PACT entry 12 failed?",
            "Why did #12 fail?",
            "Why did entry 12 fail?",
        ]
        for var in variations:
            res = self.client.post("/api/agent", json={"prompt": var, "stream": False})
            self.assertEqual(res.status_code, 200)
            self.assertIn("PACT Entry #12 Failure Explanation", res.json().get("reply", ""))


if __name__ == "__main__":
    unittest.main()
