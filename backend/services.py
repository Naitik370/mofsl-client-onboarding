from __future__ import annotations

import hashlib
import hmac
import secrets
import sqlite3
from collections import defaultdict
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from http import HTTPStatus
from pathlib import Path

from domain import (
    ACCOUNT_TYPES, CHANNELS, CLOSED, ENTRY_TYPES, EXCLUDED, OWNERS, PAN_PATTERN,
    QUERY_STATUSES, ROLES,
    hold_and_queries, mask_pan, normalize_payload, parse_date, process_dates,
    working_days,
)
from policies import CaseAccessContext, case_write_errors

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_ROOT = PROJECT_ROOT / "frontend"
SQL_ROOT = PROJECT_ROOT / "sql"
DB_PATH = SQL_ROOT / "onboarding.db"

STATUSES = [
    ("Request Received from CSE", "Stage 1", None, None, 0, 0),
    ("Under Review by Operations", "Stage 1", None, None, 0, 0),
    ("Query Raised to CSE - Missing Information", "Stage 1", "stage1", None, 0, 0),
    ("Resubmitted by CSE", "Stage 1", None, "stage1", 0, 0),
    ("Application Form Under Preparation", "Stage 2", None, None, 0, 0),
    ("Physical Form Submitted to CSE", "Stage 2", None, None, 0, 0),
    ("Digital Form Sent to Client", "Stage 2", None, None, 0, 0),
    ("Signed Form Received from CSE", "Stage 3", None, None, 0, 0),
    ("Under Review - Signed Form", "Stage 3", None, None, 0, 0),
    ("Discrepancy Raised to CSE", "Stage 3", "stage3", None, 0, 0),
    ("Form Returned to CSE", "Stage 3", "stage3", None, 0, 0),
    ("Discrepancy Resolution Received", "Stage 4", None, "stage3", 0, 0),
    ("Resubmitted Form Received - Under Review", "Stage 4", None, "stage3", 0, 0),
    ("Form Found in Order - Ready for MOFSL Submission", "Stage 4", None, None, 0, 0),
    ("Submitted to MOFSL", "Stage 5", None, None, 0, 0),
    ("Query Raised by MOFSL", "Stage 5", "stage5", None, 0, 0),
    ("Query Resolved - Resubmitted to MOFSL", "Stage 5", None, "stage5", 0, 0),
    ("Account Opened", "Stage 6", None, None, 1, 0),
    ("Communication Sent - Case Closed", "Stage 6", None, None, 1, 0),
    ("On Hold", "Exception", None, None, 0, 1),
    ("Rejected", "Exception", None, None, 0, 1),
    ("Cancelled by Client", "Exception", None, None, 0, 1),
]
LOCATIONS = ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Kolkata"]
SEGMENTS = ["Retail", "HNI", "Ultra HNI", "Institutional", "Corporate"]
HOLIDAYS = [
    ("2026-01-26", "Republic Day"), ("2026-03-04", "Holi"),
    ("2026-03-21", "Eid al-Fitr"), ("2026-04-03", "Good Friday"),
    ("2026-04-14", "Ambedkar Jayanti"), ("2026-05-01", "Maharashtra Day"),
    ("2026-05-27", "Eid al-Adha"), ("2026-08-15", "Independence Day"),
    ("2026-08-26", "Milad-un-Nabi"), ("2026-10-02", "Gandhi Jayanti"),
    ("2026-10-20", "Dussehra"), ("2026-11-08", "Diwali"),
    ("2026-12-25", "Christmas"),
]
DEMO_USERS = [
    ("admin", "System Administrator", "admin", "AdminDemo@123"),
    ("operations", "Operations Demo", "operations", "OpsDemo@123"),
    ("cse", "CSE Demo", "cse", "CseDemo@123"),
    ("mofsl", "MOFSL Demo", "mofsl", "MofslDemo@123"),
    ("viewer", "Management Viewer", "viewer", "ViewDemo@123"),
]


def connect() -> sqlite3.Connection:
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


@contextmanager
def database():
    db = connect()
    try:
        yield db
        db.commit()
    finally:
        db.close()


def password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)


def create_user(db: sqlite3.Connection, username: str, display_name: str, role: str, password: str) -> int:
    if role not in ROLES:
        raise ValueError("Invalid role")
    if not username.strip() or not display_name.strip():
        raise ValueError("Username and display name are required")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    salt = secrets.token_bytes(16)
    role_id = lookup_id(db, "role_master", "role_name", role)
    return db.execute(
        """INSERT INTO users(username, display_name, role_id, password_hash, password_salt, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (username.strip(), display_name.strip(), role_id, password_digest(password, salt), salt,
         datetime.now().isoformat(timespec="seconds")),
    ).lastrowid


def init_db() -> None:
    with database() as db:
        db.executescript((SQL_ROOT / "schema.sql").read_text(encoding="utf-8"))
        db.executemany("INSERT OR IGNORE INTO role_master(role_name) VALUES (?)", ((role,) for role in ROLES))
        db.executemany(
            """INSERT OR IGNORE INTO status_master
               (status_name, stage, query_start_key, query_end_key, is_closed, is_exception)
               VALUES (?, ?, ?, ?, ?, ?)""",
            STATUSES,
        )
        db.executemany("INSERT OR IGNORE INTO location_master(location_name) VALUES (?)", ((x,) for x in LOCATIONS))
        db.executemany("INSERT OR IGNORE INTO segment_master(segment_name) VALUES (?)", ((x,) for x in SEGMENTS))
        db.executemany("INSERT OR IGNORE INTO holiday_master VALUES (?, ?)", HOLIDAYS)
        db.execute("INSERT OR IGNORE INTO settings VALUES ('sla_days', '7')")
        for username, display_name, role, password in DEMO_USERS:
            if not db.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone():
                create_user(db, username, display_name, role, password)


def normalize_case_payload(payload: dict, event_timestamp: str, auto_capture_dates: bool = False) -> dict:
    return normalize_payload(payload, event_timestamp, auto_capture_dates)


def lookup_id(db: sqlite3.Connection, table: str, name_column: str, name: str) -> int | None:
    row = db.execute(f"SELECT id FROM {table} WHERE {name_column} = ?", (name,)).fetchone()
    return row["id"] if row else None


def authenticate(username: str, password: str) -> dict | None:
    with database() as db:
        row = db.execute(
            """SELECT u.id, u.username, u.display_name AS displayName, r.role_name AS role,
                      u.password_hash, u.password_salt
               FROM users u JOIN role_master r ON r.id=u.role_id
               WHERE u.username=? COLLATE NOCASE AND u.is_active=1""",
            (username.strip(),),
        ).fetchone()
        if not row or not hmac.compare_digest(row["password_hash"], password_digest(password, row["password_salt"])):
            return None
        token = secrets.token_urlsafe(32)
        db.execute(
            "INSERT INTO sessions VALUES (?, ?, ?, ?)",
            (hashlib.sha256(token.encode()).hexdigest(), row["id"],
             (datetime.now() + timedelta(hours=12)).isoformat(timespec="seconds"),
             datetime.now().isoformat(timespec="seconds")),
        )
        return {"token": token, "id": row["id"], "username": row["username"],
                "displayName": row["displayName"], "role": row["role"]}


def session_user(token: str) -> dict | None:
    if not token:
        return None
    with database() as db:
        db.execute("DELETE FROM sessions WHERE expires_at <= ?", (datetime.now().isoformat(timespec="seconds"),))
        row = db.execute(
            """SELECT u.id, u.username, u.display_name AS displayName, r.role_name AS role
               FROM sessions s JOIN users u ON u.id=s.user_id JOIN role_master r ON r.id=u.role_id
               WHERE s.token_hash=? AND u.is_active=1""",
            (hashlib.sha256(token.encode()).hexdigest(),),
        ).fetchone()
        return dict(row) if row else None


def visible_rows(rows: list[dict], user: dict) -> list[dict]:
    if user["role"] == "cse":
        return [row for row in rows if row["cseName"].casefold() == user["displayName"].casefold()]
    if user["role"] == "mofsl":
        return [row for row in rows if row["owner"] == "MOFSL" or row["stage"] in {"Stage 5", "Stage 6"}]
    return rows


def case_rows_for_user(rows: list[dict], user: dict) -> list[dict]:
    rows = visible_rows(rows, user)
    if user["role"] != "viewer":
        return rows
    protected = []
    for row in rows:
        row = dict(row)
        row["panMasked"] = mask_pan(row.pop("pan", ""))
        protected.append(row)
    return protected


def role_errors(payload: dict, user: dict, db: sqlite3.Connection, entry_id: int | None) -> list[str]:
    existing = db.execute(
        """SELECT c.cse_name AS cseName, sm.stage
           FROM case_entries e JOIN cases c ON c.id=e.case_id
           JOIN status_master sm ON sm.id=e.latest_status_id WHERE e.id=?""",
        (entry_id,),
    ).fetchone() if entry_id else db.execute(
        """SELECT c.cse_name AS cseName, sm.stage
           FROM cases c JOIN case_entries e ON e.case_id=c.id
           JOIN status_master sm ON sm.id=e.latest_status_id
           WHERE c.reference_id=? COLLATE NOCASE ORDER BY e.updated_at DESC, e.id DESC LIMIT 1""",
        (payload.get("referenceId", ""),),
    ).fetchone()
    context = CaseAccessContext(existing["cseName"], existing["stage"]) if existing else None
    return case_write_errors(payload, user, context)


def validate(payload: dict, db: sqlite3.Connection, entry_id: int | None = None) -> list[str]:
    errors = []
    for field, label in (
        ("referenceId", "Reference ID"), ("requestId", "Request ID"),
        ("clientName", "Client name"), ("pan", "PAN No"), ("inwardDate", "Inward date"),
    ):
        if not str(payload.get(field, "")).strip():
            errors.append(f"{label} is required")
    if not lookup_id(db, "status_master", "status_name", str(payload.get("status", ""))):
        errors.append("Latest status is not in the Status Master")
    if not lookup_id(db, "location_master", "location_name", str(payload.get("location", ""))):
        errors.append("Location is not in the Location Master")
    if not lookup_id(db, "segment_master", "segment_name", str(payload.get("segment", ""))):
        errors.append("Segment is not in the Segment Master")
    for field, label, allowed in (
        ("entryType", "Entry type", ENTRY_TYPES),
        ("accountType", "Account type", ACCOUNT_TYPES),
        ("channel", "Channel", CHANNELS),
        ("owner", "Current owner", OWNERS),
    ):
        if payload.get(field) not in allowed:
            errors.append(f"{label} is invalid")
    if payload.get("pan") and not PAN_PATTERN.fullmatch(str(payload["pan"])):
        errors.append("PAN No must use the standard PAN format")
    for field, label in (
        ("inwardDate", "Inward date"),
        ("outwardDate", "Outward date"),
        ("resubmissionDate", "Resubmission date"),
        ("signedFormDate", "Signed form received date"),
        ("submittedDate", "Submitted to MOFSL date"),
        ("accountOpeningDate", "Account opening date"),
    ):
        if payload.get(field) and not parse_date(payload[field]):
            errors.append(f"{label} is invalid")
    inward, opened = parse_date(payload.get("inwardDate")), parse_date(payload.get("accountOpeningDate"))
    if inward and opened and opened < inward:
        errors.append("Account opening date cannot precede inward date")
    if payload.get("status") in CLOSED and (not payload.get("accountNumber") or not opened):
        errors.append("A closed case requires account number and account opening date")
    if payload.get("status") in QUERY_STATUSES and not payload.get("queryDetails"):
        errors.append("Query / event details are required for query or discrepancy statuses")
    if payload.get("status") == "Physical Form Submitted to CSE" and payload.get("channel") != "Physical":
        errors.append("Physical form submission requires the Physical channel")
    if payload.get("status") == "Digital Form Sent to Client" and payload.get("channel") != "Digital":
        errors.append("Digital form submission requires the Digital channel")
    existing = db.execute("SELECT id FROM cases WHERE reference_id = ? COLLATE NOCASE", (payload.get("referenceId", ""),)).fetchone()
    if not entry_id and payload.get("entryType") == "New" and existing:
        errors.append("Reference ID already exists; use a resubmission or modification entry")
    if not entry_id and payload.get("entryType") != "New" and not existing:
        errors.append("Create the original case before adding a related entry")
    return errors


def case_query(where: str = "", params: tuple = ()) -> list[dict]:
    sql = f"""
        SELECT e.id, c.id AS caseId, c.reference_id AS referenceId, e.request_id AS requestId,
               e.entry_type AS entryType, c.client_name AS clientName, c.pan, c.account_type AS accountType,
               c.channel, l.location_name AS location, s.segment_name AS segment, c.rm_name AS rmName,
               c.cse_name AS cseName, e.processor_name AS processorName, e.owner,
               e.inward_date AS inwardDate, COALESCE(e.outward_date, '') AS outwardDate,
               COALESCE(e.resubmission_date, '') AS resubmissionDate,
               COALESCE(e.signed_form_date, '') AS signedFormDate,
               COALESCE(e.submitted_date, '') AS submittedDate,
               COALESCE(e.account_opening_date, '') AS accountOpeningDate,
               e.account_number AS accountNumber, sm.status_name AS status, sm.stage,
               e.query_details AS queryDetails, e.remarks, e.created_at AS createdAt, e.updated_at AS updatedAt
        FROM case_entries e
        JOIN cases c ON c.id = e.case_id
        JOIN status_master sm ON sm.id = e.latest_status_id
        JOIN location_master l ON l.id = c.location_id
        JOIN segment_master s ON s.id = c.segment_id
        {where}
        ORDER BY e.updated_at DESC, e.id DESC
    """
    with database() as db:
        return [dict(row) for row in db.execute(sql, params).fetchall()]


def latest_case_rows(db: sqlite3.Connection, start: str = "", end: str = "") -> list[dict]:
    rows = case_query()
    grouped: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row["caseId"]].append(row)
    latest = []
    for group in grouped.values():
        inward_dates = [parse_date(row["inwardDate"]) for row in group]
        original = min((d for d in inward_dates if d), default=None)
        if start and original and original < parse_date(start):
            continue
        if end and original and original > parse_date(end):
            continue
        current = max(group, key=lambda row: (row["updatedAt"], row["id"]))
        current["originalInwardDate"] = original.isoformat() if original else ""
        current["resubmissionCount"] = len(group) - 1
        latest.append(current)
    return latest


def audit_events(db: sqlite3.Connection, case_id: int) -> list[dict]:
    return [dict(row) for row in db.execute(
        """SELECT h.event_timestamp AS timestamp, ns.status_name AS status,
                  ns.query_start_key AS queryStart, ns.query_end_key AS queryEnd
           FROM status_history h JOIN status_master ns ON ns.id = h.new_status_id
           WHERE h.case_id = ? ORDER BY h.event_timestamp, h.id""",
        (case_id,),
    ).fetchall()]


def report(start: str = "", end: str = "", dimension: str = "cseName", user: dict | None = None) -> dict:
    if dimension not in {"cseName", "location", "segment"}:
        dimension = "cseName"
    today = date.today()
    with database() as db:
        holidays = {row[0] for row in db.execute("SELECT holiday_date FROM holiday_master")}
        sla_days = int(db.execute("SELECT setting_value FROM settings WHERE setting_key = 'sla_days'").fetchone()[0])
        cases = latest_case_rows(db, start, end)
        if user:
            cases = visible_rows(cases, user)
        for case in cases:
            events = audit_events(db, case["caseId"])
            hold, queries = hold_and_queries(events, today, holidays)
            gross = working_days(parse_date(case["originalInwardDate"]), parse_date(case["accountOpeningDate"]) or today, holidays)
            case.update(
                queryCount=queries, queryHoldDays=hold, rft="NRFT" if queries else "RFT",
                grossTat=gross, netTat=max(0, gross - hold),
                aging=0 if case["status"] in CLOSED else gross,
                slaBreach=gross > sla_days, panMasked=mask_pan(case["pan"]),
                processDates=process_dates(events),
            )
            case.pop("pan", None)
    normal = [case for case in cases if case["status"] not in EXCLUDED]

    def avg(items: list[dict], field: str) -> float:
        return round(sum(item[field] for item in items) / len(items), 1) if items else 0

    pipeline = []
    for stage in [f"Stage {n}" for n in range(1, 7)] + ["Exception"]:
        items = [case for case in cases if case["stage"] == stage]
        pipeline.append({"stage": stage, "count": len(items), "averageAging": avg(items, "aging")})

    grouped: dict[str, list[dict]] = defaultdict(list)
    for case in cases:
        grouped[str(case.get(dimension) or "Unassigned")].append(case)
    groups = []
    for name, items in sorted(grouped.items()):
        eligible = [item for item in items if item["status"] not in EXCLUDED]
        rft_count = sum(item["rft"] == "RFT" for item in eligible)
        groups.append({
            "name": name, "total": len(items),
            "open": sum(item["status"] not in CLOSED | EXCLUDED for item in items),
            "closed": sum(item["status"] in CLOSED for item in items),
            "rft": rft_count, "nrft": len(eligible) - rft_count,
            "rftPercent": round(rft_count * 100 / len(eligible), 1) if eligible else 0,
            "averageNetTat": avg(eligible, "netTat"),
            "slaBreaches": sum(item["slaBreach"] for item in eligible),
            "exceptions": sum(item["status"] in EXCLUDED for item in items),
        })
    rft_count = sum(case["rft"] == "RFT" for case in normal)
    return {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "summary": {
            "total": len(cases),
            "open": sum(case["status"] not in CLOSED | EXCLUDED for case in cases),
            "closed": sum(case["status"] in CLOSED for case in cases),
            "rft": rft_count, "nrft": len(normal) - rft_count,
            "rftPercent": round(rft_count * 100 / len(normal), 1) if normal else 0,
            "nrftPercent": round((len(normal) - rft_count) * 100 / len(normal), 1) if normal else 0,
            "averageGrossTat": avg(normal, "grossTat"), "averageNetTat": avg(normal, "netTat"),
            "slaBreaches": sum(case["slaBreach"] for case in normal),
            "onHold": sum(case["status"] == "On Hold" for case in cases),
            "rejected": sum(case["status"] == "Rejected" for case in cases),
            "cancelled": sum(case["status"] == "Cancelled by Client" for case in cases),
        },
        "pipeline": pipeline, "groups": groups, "cases": cases,
    }


def save_case(payload: dict, entry_id: int | None = None, user: dict | None = None) -> tuple[int, dict]:
    now = datetime.now().isoformat(timespec="seconds")
    user = user or {"role": "operations", "displayName": "Operations"}
    auto_capture_dates = user["role"] == "admin" and str(payload.get("autoCaptureDates", "")).lower() in {"true", "1", "on"}
    payload = normalize_case_payload(payload, now, auto_capture_dates)
    creating_entry = entry_id is None
    if user["role"] == "cse":
        payload["cseName"] = user["displayName"]
        payload["owner"] = "Operations"
    elif user["role"] == "mofsl":
        payload["owner"] = "MOFSL"
    with database() as db:
        access_errors = role_errors(payload, user, db, entry_id)
        if access_errors:
            return HTTPStatus.FORBIDDEN, {"errors": access_errors}
        errors = validate(payload, db, entry_id)
        if errors:
            return HTTPStatus.BAD_REQUEST, {"errors": errors}
        location_id = lookup_id(db, "location_master", "location_name", payload["location"])
        segment_id = lookup_id(db, "segment_master", "segment_name", payload["segment"])
        status_id = lookup_id(db, "status_master", "status_name", payload["status"])
        previous_status_id = None
        if entry_id:
            old = db.execute(
                """SELECT e.*, c.id AS case_id FROM case_entries e JOIN cases c ON c.id = e.case_id
                   WHERE e.id = ?""", (entry_id,),
            ).fetchone()
            if not old:
                return HTTPStatus.NOT_FOUND, {"error": "Case entry not found"}
            case_id, previous_status_id = old["case_id"], old["latest_status_id"]
            db.execute(
                """UPDATE cases SET client_name=?, pan=?, account_type=?, channel=?, location_id=?,
                   segment_id=?, rm_name=?, cse_name=?, updated_at=? WHERE id=?""",
                (payload["clientName"], payload["pan"], payload["accountType"], payload["channel"],
                 location_id, segment_id, payload.get("rmName", ""), payload.get("cseName", ""), now, case_id),
            )
            db.execute(
                """UPDATE case_entries SET request_id=?, entry_type=?, processor_name=?, owner=?,
                   inward_date=?, outward_date=?, resubmission_date=?, signed_form_date=?, submitted_date=?,
                   account_opening_date=?, account_number=?, latest_status_id=?, query_details=?, remarks=?,
                   updated_at=? WHERE id=?""",
                (payload["requestId"], payload["entryType"], payload.get("processorName", ""), payload["owner"],
                 payload["inwardDate"], payload.get("outwardDate") or None, payload.get("resubmissionDate") or None,
                 payload.get("signedFormDate") or None, payload.get("submittedDate") or None,
                 payload.get("accountOpeningDate") or None, payload.get("accountNumber", ""), status_id,
                 payload.get("queryDetails", ""), payload.get("remarks", ""), now, entry_id),
            )
        else:
            existing = db.execute("SELECT id FROM cases WHERE reference_id = ? COLLATE NOCASE", (payload["referenceId"],)).fetchone()
            if existing:
                case_id = existing["id"]
                previous = db.execute(
                    """SELECT latest_status_id FROM case_entries
                       WHERE case_id=? ORDER BY updated_at DESC, id DESC LIMIT 1""",
                    (case_id,),
                ).fetchone()
                previous_status_id = previous["latest_status_id"] if previous else None
                db.execute(
                    """UPDATE cases SET client_name=?, pan=?, account_type=?, channel=?, location_id=?,
                       segment_id=?, rm_name=?, cse_name=?, updated_at=? WHERE id=?""",
                    (payload["clientName"], payload["pan"], payload["accountType"], payload["channel"],
                     location_id, segment_id, payload.get("rmName", ""), payload.get("cseName", ""), now, case_id),
                )
            else:
                case_id = db.execute(
                    """INSERT INTO cases(reference_id, client_name, pan, account_type, channel, location_id,
                       segment_id, rm_name, cse_name, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (payload["referenceId"], payload["clientName"], payload["pan"], payload["accountType"],
                     payload["channel"], location_id, segment_id, payload.get("rmName", ""),
                     payload.get("cseName", ""), now, now),
                ).lastrowid
            entry_id = db.execute(
                """INSERT INTO case_entries(case_id, request_id, entry_type, processor_name, owner, inward_date,
                   outward_date, resubmission_date, signed_form_date, submitted_date, account_opening_date,
                   account_number, latest_status_id, query_details, remarks, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (case_id, payload["requestId"], payload["entryType"], payload.get("processorName", ""),
                 payload["owner"], payload["inwardDate"], payload.get("outwardDate") or None,
                 payload.get("resubmissionDate") or None, payload.get("signedFormDate") or None,
                 payload.get("submittedDate") or None, payload.get("accountOpeningDate") or None,
                 payload.get("accountNumber", ""), status_id, payload.get("queryDetails", ""),
                 payload.get("remarks", ""), now, now),
            ).lastrowid
        if previous_status_id != status_id:
            db.execute(
                """INSERT INTO status_history(case_id, entry_id, event_timestamp, old_status_id, new_status_id,
                   changed_by, owner, event_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (case_id, entry_id, now, previous_status_id, status_id,
                 user["displayName"], payload["owner"],
                 payload.get("remarks") or payload.get("queryDetails", "")),
            )
    return HTTPStatus.CREATED if creating_entry else HTTPStatus.OK, case_query("WHERE e.id = ?", (entry_id,))[0]


def get_meta() -> dict:
    with database() as db:
        return {
            "statuses": [dict(row) for row in db.execute(
                "SELECT status_name AS status, stage FROM status_master ORDER BY id"
            )],
            "locations": [row[0] for row in db.execute(
                "SELECT location_name FROM location_master ORDER BY id"
            )],
            "segments": [row[0] for row in db.execute(
                "SELECT segment_name FROM segment_master ORDER BY id"
            )],
            "slaDays": int(db.execute(
                "SELECT setting_value FROM settings WHERE setting_key='sla_days'"
            ).fetchone()[0]),
        }


def get_cases(user: dict) -> list[dict]:
    return case_rows_for_user(case_query(), user)


def get_users() -> list[dict]:
    with database() as db:
        rows = db.execute(
            """SELECT u.id, u.username, u.display_name AS displayName, r.role_name AS role,
               u.is_active AS isActive, u.created_at AS createdAt
               FROM users u JOIN role_master r ON r.id=u.role_id ORDER BY u.id"""
        ).fetchall()
        return [dict(row) for row in rows]


def get_history(user: dict) -> list[dict]:
    with database() as db:
        rows = db.execute(
            """SELECT h.id, h.event_timestamp AS timestamp, c.reference_id AS referenceId,
               COALESCE(os.status_name, '') AS previous, ns.status_name AS status, ns.stage,
               h.changed_by AS changedBy, h.owner, h.event_notes AS notes, c.cse_name AS cseName
               FROM status_history h JOIN cases c ON c.id=h.case_id
               LEFT JOIN status_master os ON os.id=h.old_status_id
               JOIN status_master ns ON ns.id=h.new_status_id
               ORDER BY h.event_timestamp DESC, h.id DESC"""
        ).fetchall()
        return visible_rows([dict(row) for row in rows], user)


def logout(token: str) -> None:
    with database() as db:
        db.execute(
            "DELETE FROM sessions WHERE token_hash=?",
            (hashlib.sha256(token.encode()).hexdigest(),),
        )


def add_user(payload: dict) -> tuple[HTTPStatus, dict]:
    try:
        with database() as db:
            user_id = create_user(
                db,
                str(payload.get("username", "")),
                str(payload.get("displayName", "")),
                str(payload.get("role", "")),
                str(payload.get("password", "")),
            )
        return HTTPStatus.CREATED, {"id": user_id}
    except (ValueError, sqlite3.IntegrityError) as error:
        return HTTPStatus.BAD_REQUEST, {"error": str(error)}
