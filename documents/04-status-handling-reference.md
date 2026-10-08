---
title: Status Handling Reference
tags: [client-onboarding, workflow, status-master]
---

# Status handling reference

## Rules common to every status

1. The value must exist in `status_master`.
2. Stage is derived from that master row; users do not send a stage.
3. The latest status is stored on `case_entries.latest_status_id`.
4. A history row is appended only when the status ID changes.
5. History uses server time and the authenticated user's display name.
6. Reports use history events to derive process dates, query count, hold time, and RFT/NRFT.
7. Admin and Operations may select any status. CSE and MOFSL are restricted as shown below.

> [!warning] Transition enforcement
> The order below is the intended business journey. The backend currently has no allowed-transition matrix and does not require the previous status to be a particular value.

## Stage 1 — CSE request to Operations

| Status | Intended meaning | Special handling |
| --- | --- | --- |
| Request Received from CSE | Operations receives the request | CSE may record it. New cases default `inwardDate` to the server's current local date, with supplied dates preserved. Users can correct it for an earlier receipt. |
| Under Review by Operations | Operations checks completeness | No special validation or date field. |
| Query Raised to CSE - Missing Information | Information is missing | `queryDetails` required. Starts the `stage1` query clock, adds one Query Count, and makes the case NRFT. |
| Resubmitted by CSE | CSE supplies missing information | CSE may record it. Ends the oldest open `stage1` query clock. Admin auto-date can fill `resubmissionDate`. |

## Stage 2 — Form preparation and submission

| Status | Intended meaning | Special handling |
| --- | --- | --- |
| Application Form Under Preparation | Operations prepares the application | Audit timestamp becomes `formPreparedDate` in report `processDates`. |
| Physical Form Submitted to CSE | Physical form sent to CSE for signature | Requires `channel = Physical`. Admin auto-date can fill `outwardDate`. |
| Digital Form Sent to Client | Digital form sent directly to client | Requires `channel = Digital`. Admin auto-date can fill `outwardDate`. |

## Stage 3 — Signed form review

| Status | Intended meaning | Special handling |
| --- | --- | --- |
| Signed Form Received from CSE | Signed documents return to Operations | Admin auto-date can fill `signedFormDate`. |
| Under Review - Signed Form | Operations reviews signed documents | No special validation or date field. |
| Discrepancy Raised to CSE | A signed-form problem is found | `queryDetails` required. Starts the shared `stage3` clock, increments Query Count, and makes the case NRFT. |
| Form Returned to CSE | Physical form is returned for correction | `queryDetails` required. Also starts `stage3`, increments Query Count, and makes the case NRFT. |

## Stage 4 — Resolution and readiness

| Status | Intended meaning | Special handling |
| --- | --- | --- |
| Discrepancy Resolution Received | CSE supplies a resolution | CSE may record it. Ends the oldest open `stage3` clock. Admin auto-date can fill `resubmissionDate`. |
| Resubmitted Form Received - Under Review | Corrected form is received and reviewed | CSE may record it. Ends the oldest open `stage3` clock. Admin auto-date can fill `resubmissionDate`. |
| Form Found in Order - Ready for MOFSL Submission | Operations confirms readiness | No special validation or input date. |

Both Stage 4 resolution statuses use the same `stage3` query-end key. A resolution with no open Stage 3 query does not add hold days.

## Stage 5 — MOFSL processing

| Status | Intended meaning | Special handling |
| --- | --- | --- |
| Submitted to MOFSL | Case sent for account opening | Admin auto-date can fill `submittedDate`. Reaching this stage allows later MOFSL updates. |
| Query Raised by MOFSL | MOFSL requests correction/information | MOFSL may record it. `queryDetails` required. Starts `stage5`, increments Query Count, and makes the case NRFT. |
| Query Resolved - Resubmitted to MOFSL | Query response sent back | MOFSL may record it. Ends the oldest open `stage5` clock. |

## Stage 6 — Account opening and closure

| Status | Intended meaning | Special handling |
| --- | --- | --- |
| Account Opened | MOFSL has opened the account | MOFSL may record it. Requires both `accountNumber` and valid `accountOpeningDate`. Admin auto-date may fill a blank opening date. Marks the case closed. |
| Communication Sent - Case Closed | Opening communication completed | MOFSL may record it. Also requires `accountNumber` and `accountOpeningDate`. Marks the case closed. |

Closed cases have pipeline aging set to zero. Their TAT ends on `accountOpeningDate`.

## Exception statuses

| Status | Reporting behavior | Current limitation |
| --- | --- | --- |
| On Hold | Counts as open and as `onHold`; appears in attention list | It does not start a query-hold clock by itself. |
| Rejected | Counts as an exception and is excluded from RFT percentage and average TAT | No rejection reason is mandatory. |
| Cancelled by Client | Counts as an exception and is excluded from RFT percentage and average TAT | No cancellation reason is mandatory. |

Exception statuses map to `Exception`, outside Stages 1–6. Rejected and cancelled are treated as terminal for dashboard attention logic, but the database does not prevent later updates.

## Role matrix

| Role | Status authority |
| --- | --- |
| Admin | Any status; may enable per-entry automatic date capture |
| Operations | Any status; New-case inward date defaults to today, other dates remain manual |
| CSE | Request Received, Resubmitted by CSE, Discrepancy Resolution Received, Resubmitted Form Received; own cases only |
| MOFSL | Query Raised by MOFSL, Query Resolved, Account Opened, Communication Sent; existing case must currently be Stage 5 or 6 |
| Viewer | No writes |

## Query pairing example

```text
Query Raised to CSE          -> start stage1, Query Count +1, NRFT
Resubmitted by CSE           -> close oldest stage1 hold
Discrepancy Raised to CSE    -> start stage3, Query Count +1
Resolution Received          -> close oldest stage3 hold
Query Raised by MOFSL        -> start stage5, Query Count +1
Query Resolved               -> close oldest stage5 hold
```

An unresolved query continues accumulating working-day hold time through today.
