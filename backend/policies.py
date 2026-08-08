"""Role authorization policies, independent of storage and HTTP."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

CSE_STATUSES = {
    "Request Received from CSE", "Resubmitted by CSE",
    "Discrepancy Resolution Received", "Resubmitted Form Received - Under Review",
}
MOFSL_STATUSES = {
    "Query Raised by MOFSL", "Query Resolved - Resubmitted to MOFSL",
    "Account Opened", "Communication Sent - Case Closed",
}


@dataclass(frozen=True)
class CaseAccessContext:
    cse_name: str = ""
    stage: str = ""


def case_write_errors(payload: Mapping, user: Mapping, existing: CaseAccessContext | None = None) -> list[str]:
    role = user["role"]
    if role == "viewer":
        return ["Management Viewer is read-only"]
    if role in {"admin", "operations"}:
        return []
    if role == "cse":
        if payload.get("status") not in CSE_STATUSES:
            return ["CSE users can only record request, resubmission, or discrepancy-resolution statuses"]
        if existing and existing.cse_name.casefold() != str(user["displayName"]).casefold():
            return ["CSE users can only update their own cases"]
        return []
    if role == "mofsl":
        if payload.get("status") not in MOFSL_STATUSES:
            return ["MOFSL users can only record MOFSL query, resolution, or account-opening statuses"]
        if not existing or existing.stage not in {"Stage 5", "Stage 6"}:
            return ["MOFSL users can only update cases that have reached Stage 5"]
    return []
