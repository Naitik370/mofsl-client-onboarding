import json
import socket
import tempfile
import threading
import time
import unittest
from datetime import date
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

import services as server
import uvicorn
from router import app


class MisLogicTest(unittest.TestCase):
    def setUp(self):
        self.original_db = server.DB_PATH
        self.temp_dir = tempfile.TemporaryDirectory()
        server.DB_PATH = Path(self.temp_dir.name) / "test.db"
        server.init_db()

    def tearDown(self):
        server.DB_PATH = self.original_db
        self.temp_dir.cleanup()

    def test_query_history_drives_nrft_hold_and_report(self):
        base = {
            "referenceId": "REF-1", "requestId": "REQ-1", "entryType": "New",
            "clientName": "Demo Client", "pan": "ABCDE1234F", "accountType": "Individual",
            "channel": "Physical", "location": "Mumbai", "segment": "Retail",
            "cseName": "CSE A", "processorName": "Ops A", "owner": "Operations",
            "inwardDate": "2026-07-01", "status": "Query Raised to CSE - Missing Information",
            "queryDetails": "Missing identity proof",
        }
        status, row = server.save_case(base)
        self.assertEqual(status, 201)
        base.update({
            "status": "Resubmitted by CSE", "entryType": "Resubmission",
            "resubmissionDate": "2026-07-03",
        })
        server.save_case(base, row["id"])
        result = server.report(dimension="cseName")
        case = result["cases"][0]
        self.assertEqual(case["rft"], "NRFT")
        self.assertEqual(case["queryCount"], 1)
        self.assertGreaterEqual(case["queryHoldDays"], 0)
        self.assertEqual(result["groups"][0]["name"], "CSE A")

    def test_working_days_excludes_weekends_and_holidays(self):
        self.assertEqual(server.working_days(date(2026, 1, 23), date(2026, 1, 27), {"2026-01-26"}), 1)

    def test_all_seeded_roles_can_authenticate(self):
        for username, _display, role, password in server.DEMO_USERS:
            user = server.authenticate(username, password)
            self.assertIsNotNone(user)
            self.assertEqual(user["role"], role)

    def test_role_permissions(self):
        base = {
            "referenceId": "REF-RBAC", "requestId": "REQ-RBAC", "entryType": "New",
            "clientName": "Role Test", "pan": "ABCDE1234F", "accountType": "Individual",
            "channel": "Physical", "location": "Mumbai", "segment": "Retail",
            "cseName": "CSE Demo", "processorName": "", "owner": "Operations",
            "inwardDate": "2026-07-01", "status": "Request Received from CSE",
        }
        viewer = {"role": "viewer", "displayName": "Management Viewer"}
        status, body = server.save_case(base, user=viewer)
        self.assertEqual(status, 403)
        self.assertIn("read-only", body["errors"][0])

        cse = {"role": "cse", "displayName": "CSE Demo"}
        status, _ = server.save_case(base, user=cse)
        self.assertEqual(status, 201)
        blocked = dict(base, referenceId="REF-RBAC-2", requestId="REQ-RBAC-2", status="Submitted to MOFSL")
        status, body = server.save_case(blocked, user=cse)
        self.assertEqual(status, 403)
        self.assertIn("CSE users", body["errors"][-1])

        operations = {"role": "operations", "displayName": "Operations Demo"}
        stage_five = dict(base, referenceId="REF-MOFSL", requestId="REQ-MOFSL", cseName="CSE Other",
                          status="Submitted to MOFSL")
        status, _ = server.save_case(stage_five, user=operations)
        self.assertEqual(status, 201)
        mofsl_update = dict(stage_five, requestId="REQ-MOFSL-2", entryType="Modification",
                            status="Query Raised by MOFSL", queryDetails="Signature mismatch")
        status, _ = server.save_case(mofsl_update, user={"role": "mofsl", "displayName": "MOFSL Demo"})
        self.assertEqual(status, 201)

    def test_backend_validates_controlled_values_pan_dates_and_duplicates(self):
        base = {
            "referenceId": "REF-VALID", "requestId": "REQ-VALID", "entryType": "New",
            "clientName": "Validation Test", "pan": "abcde1234f", "accountType": "Individual",
            "channel": "Physical", "location": "Mumbai", "segment": "Retail",
            "cseName": "CSE A", "processorName": "Ops A", "owner": "Operations",
            "inwardDate": "2026-07-01", "status": "Request Received from CSE",
        }
        status, row = server.save_case(base)
        self.assertEqual(status, 201)
        self.assertEqual(row["pan"], "ABCDE1234F")

        status, body = server.save_case(base)
        self.assertEqual(status, 400)
        self.assertTrue(any("Reference ID already exists" in error for error in body["errors"]))

        invalid = dict(base, referenceId="REF-INVALID", requestId="REQ-INVALID",
                       accountType="Trust", owner="Unknown", inwardDate="not-a-date")
        status, body = server.save_case(invalid)
        self.assertEqual(status, 400)
        self.assertIn("Account type is invalid", body["errors"])
        self.assertIn("Current owner is invalid", body["errors"])
        self.assertIn("Inward date is invalid", body["errors"])

    def test_related_entry_preserves_history_and_auto_captures_dates(self):
        base = {
            "referenceId": "REF-HISTORY", "requestId": "REQ-HISTORY-1", "entryType": "New",
            "clientName": "History Test", "pan": "ABCDE1234F", "accountType": "Individual",
            "channel": "Physical", "location": "Mumbai", "segment": "Retail",
            "cseName": "CSE A", "processorName": "Ops A", "owner": "Operations",
            "inwardDate": "2026-07-01", "status": "Request Received from CSE",
        }
        server.save_case(base)
        related = dict(base, requestId="REQ-HISTORY-2", entryType="Modification",
                       status="Submitted to MOFSL", inwardDate="2026-07-02",
                       submittedDate=date.today().isoformat())
        status, row = server.save_case(related)
        self.assertEqual(status, 201)
        self.assertEqual(row["submittedDate"], date.today().isoformat())
        self.assertEqual(
            server.report()["cases"][0]["processDates"]["submittedToMofslDate"],
            date.today().isoformat(),
        )
        with server.database() as db:
            history = db.execute(
                """SELECT old.status_name AS previous, new.status_name AS current
                   FROM status_history h
                   LEFT JOIN status_master old ON old.id=h.old_status_id
                   JOIN status_master new ON new.id=h.new_status_id
                   WHERE h.case_id=? ORDER BY h.id""",
                (row["caseId"],),
            ).fetchall()
        self.assertEqual(history[-1]["previous"], "Request Received from CSE")
        self.assertEqual(history[-1]["current"], "Submitted to MOFSL")

    def test_dates_are_manual_unless_admin_enables_auto_capture(self):
        base = {
            "referenceId": "REF-DATES", "requestId": "REQ-DATES-1", "entryType": "New",
            "clientName": "Date Test", "pan": "ABCDE1234F", "accountType": "Individual",
            "channel": "Physical", "location": "Mumbai", "segment": "Retail",
            "cseName": "CSE A", "processorName": "Ops A", "owner": "Operations",
            "inwardDate": "2026-07-01", "status": "Application Form Under Preparation",
        }
        status, _ = server.save_case(base)
        self.assertEqual(status, 201)

        manual = dict(base, requestId="REQ-DATES-2", entryType="Modification",
                      status="Physical Form Submitted to CSE", outwardDate="")
        status, row = server.save_case(manual, user={"role": "operations", "displayName": "Operations"})
        self.assertEqual(status, 201)
        self.assertEqual(row["outwardDate"], "")

        automatic = dict(manual, requestId="REQ-DATES-3", autoCaptureDates=True)
        status, row = server.save_case(automatic, user={"role": "admin", "displayName": "Admin"})
        self.assertEqual(status, 201)
        self.assertEqual(row["outwardDate"], date.today().isoformat())

    def test_report_never_returns_full_pan(self):
        base = {
            "referenceId": "REF-PAN", "requestId": "REQ-PAN", "entryType": "New",
            "clientName": "PAN Test", "pan": "ABCDE1234F", "accountType": "Individual",
            "channel": "Physical", "location": "Mumbai", "segment": "Retail",
            "cseName": "CSE A", "processorName": "Ops A", "owner": "Operations",
            "inwardDate": "2026-07-01", "status": "Request Received from CSE",
        }
        server.save_case(base)
        case = server.report()["cases"][0]
        self.assertNotIn("pan", case)
        self.assertEqual(case["panMasked"], "AB*****34F")


class HttpEndToEndTest(unittest.TestCase):
    def setUp(self):
        self.original_db = server.DB_PATH
        self.temp_dir = tempfile.TemporaryDirectory()
        server.DB_PATH = Path(self.temp_dir.name) / "http-test.db"
        server.init_db()
        self.socket = socket.socket()
        self.socket.bind(("127.0.0.1", 0))
        self.config = uvicorn.Config(app, log_level="warning", lifespan="on")
        self.httpd = uvicorn.Server(self.config)
        self.thread = threading.Thread(
            target=self.httpd.run, kwargs={"sockets": [self.socket]}, daemon=True
        )
        self.thread.start()
        while not self.httpd.started:
            time.sleep(0.01)
        self.base_url = f"http://127.0.0.1:{self.socket.getsockname()[1]}"
        self.client = build_opener(HTTPCookieProcessor(CookieJar()))

    def tearDown(self):
        self.httpd.should_exit = True
        self.thread.join(timeout=2)
        self.socket.close()
        server.DB_PATH = self.original_db
        self.temp_dir.cleanup()

    def request(self, path, method="GET", payload=None):
        data = json.dumps(payload).encode() if payload is not None else None
        request = Request(
            self.base_url + path,
            data=data,
            method=method,
            headers={"Content-Type": "application/json"},
        )
        try:
            response = self.client.open(request)
            return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def test_login_create_duplicate_report_and_history_over_http(self):
        status, user = self.request(
            "/api/auth/login", "POST",
            {"username": "operations", "password": "OpsDemo@123"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(user["role"], "operations")

        case = {
            "referenceId": "REF-HTTP", "requestId": "REQ-HTTP", "entryType": "New",
            "clientName": "HTTP Test", "pan": "ABCDE1234F", "accountType": "Individual",
            "channel": "Physical", "location": "Mumbai", "segment": "Retail",
            "cseName": "CSE A", "processorName": "Ops A", "owner": "Operations",
            "inwardDate": "2026-07-01", "status": "Request Received from CSE",
        }
        status, _ = self.request("/api/cases", "POST", case)
        self.assertEqual(status, 201)
        status, duplicate = self.request("/api/cases", "POST", case)
        self.assertEqual(status, 400)
        self.assertIn("Reference ID already exists", duplicate["errors"][0])

        status, report = self.request("/api/reports")
        self.assertEqual(status, 200)
        self.assertEqual(report["summary"]["total"], 1)
        self.assertNotIn("pan", report["cases"][0])
        status, history = self.request("/api/history")
        self.assertEqual(status, 200)
        self.assertEqual(history[0]["changedBy"], "Operations Demo")
        self.assertTrue(history[0]["timestamp"])


if __name__ == "__main__":
    unittest.main()
