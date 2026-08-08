"""Pure onboarding rules.

This module has no HTTP, SQLite, or filesystem dependencies.  Keeping policy
here makes the business rules independently testable and lets persistence and
delivery code depend on them, rather than the other way around.
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Iterable, Mapping

ROLES = ("admin", "operations", "cse", "mofsl", "viewer")
ENTRY_TYPES = {"New", "Resubmission", "Discrepancy Resolution", "Modification"}
ACCOUNT_TYPES = {"Individual", "HUF", "Corporate", "NRI", "Minor"}
CHANNELS = {"Physical", "Digital"}
OWNERS = {"Operations", "CSE", "MOFSL"}
CLOSED = {"Account Opened", "Communication Sent - Case Closed"}
EXCLUDED = {"Rejected", "Cancelled by Client"}
QUERY_STATUSES = {
    "Query Raised to CSE - Missing Information", "Discrepancy Raised to CSE",
    "Form Returned to CSE", "Query Raised by MOFSL",
}
AUTO_DATE_FIELDS = {
    "Request Received from CSE": "inwardDate",
    "Physical Form Submitted to CSE": "outwardDate",
    "Digital Form Sent to Client": "outwardDate",
    "Resubmitted by CSE": "resubmissionDate",
    "Discrepancy Resolution Received": "resubmissionDate",
    "Resubmitted Form Received - Under Review": "resubmissionDate",
    "Signed Form Received from CSE": "signedFormDate",
    "Submitted to MOFSL": "submittedDate",
    "Account Opened": "accountOpeningDate",
}
PROCESS_DATE_FIELDS = {
    "Query Raised to CSE - Missing Information": "stage1QueryRaisedDate",
    "Resubmitted by CSE": "stage1ResubmissionDate",
    "Application Form Under Preparation": "formPreparedDate",
    "Physical Form Submitted to CSE": "physicalFormSubmittedDate",
    "Digital Form Sent to Client": "digitalFormSentDate",
    "Signed Form Received from CSE": "signedFormReceivedDate",
    "Discrepancy Raised to CSE": "discrepancyRaisedDate",
    "Form Returned to CSE": "formReturnedToCseDate",
    "Discrepancy Resolution Received": "discrepancyResolutionReceivedDate",
    "Resubmitted Form Received - Under Review": "resubmittedFormReceivedDate",
    "Submitted to MOFSL": "submittedToMofslDate",
    "Query Raised by MOFSL": "mofslQueryRaisedDate",
    "Query Resolved - Resubmitted to MOFSL": "mofslQueryResolvedDate",
    "Account Opened": "accountOpeningDate",
    "Communication Sent - Case Closed": "communicationSentDate",
}
PAN_PATTERN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")


def parse_date(value: str | None) -> date | None:
    try:
        return date.fromisoformat(value or "")
    except ValueError:
        return None


def normalize_payload(payload: Mapping, event_timestamp: str, auto_capture_dates: bool = False) -> dict:
    normalized = {key: value.strip() if isinstance(value, str) else value for key, value in payload.items()}
    normalized["pan"] = str(normalized.get("pan", "")).upper()
    if auto_capture_dates:
        field = AUTO_DATE_FIELDS.get(str(normalized.get("status", "")))
        if field:
            normalized[field] = normalized.get(field) or event_timestamp[:10]
    normalized.pop("autoCaptureDates", None)
    return normalized


def working_days(start: date | None, end: date | None, holidays: set[str] | None = None) -> int:
    if not start or not end or end <= start:
        return 0
    holidays = holidays or set()
    count, current = 0, start
    while current < end:
        current += timedelta(days=1)
        if current.weekday() < 5 and current.isoformat() not in holidays:
            count += 1
    return count


def hold_and_queries(events: Iterable[Mapping], today: date, holidays: set[str]) -> tuple[int, int]:
    starts: dict[str, list[date]] = defaultdict(list)
    hold = queries = 0
    for event in events:
        event_date = datetime.fromisoformat(str(event["timestamp"])).date()
        if event["queryStart"]:
            starts[str(event["queryStart"])].append(event_date)
            queries += 1
        if event["queryEnd"] and starts[str(event["queryEnd"])]:
            hold += working_days(starts[str(event["queryEnd"])].pop(0), event_date, holidays)
    hold += sum(working_days(start, today, holidays) for pending in starts.values() for start in pending)
    return hold, queries


def process_dates(events: Iterable[Mapping]) -> dict[str, str]:
    dates: dict[str, str] = {}
    for event in events:
        field = PROCESS_DATE_FIELDS.get(str(event["status"]))
        if field:
            dates[field] = str(event["timestamp"])[:10]
    return dates


def mask_pan(pan: str) -> str:
    return f"{pan[:2]}*****{pan[-3:]}" if len(pan) >= 5 else "*****"
