# API onboarding simulation, 2026-10-09

All client details and PANs in this simulation are fictional.

Cleared 57 previous cases, 70 entries and 72 history events after a SQLite backup.
Backup: `C:\Users\Naitik\AppData\Local\mofsl-client-onboarding\backups\onboarding-before-api-simulation-20261009-014054.db`

Only the initial cleanup used SQL writes. All user creation, case creation, edits, related entries and stage changes used authenticated REST APIs at `http://127.0.0.1:4173`.
Existing users, masters, holiday dates and SLA settings were preserved. Six named local simulation users were added with the existing demo credential for their respective role.

Created **18 cases, 32 entries and 115 status-history events** with 116 successful case saves. Exercised all 22 statuses.
Passed **658 assertions**, including seven rejected-write checks proving no database changes.

| Client | Current stage | Latest status | RFT | Queries | Hold days | Gross / net TAT | Touches |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| Aarav Mehta | Stage 6 | Communication Sent - Case Closed | RFT | 0 | 0 | 6 / 6 | 9 |
| Saanvi Rao | Stage 6 | Communication Sent - Case Closed | NRFT | 1 | 2 | 10 / 8 | 11 |
| Rohan Shah HUF | Stage 6 | Communication Sent - Case Closed | NRFT | 2 | 5 | 17 / 12 | 15 |
| Meridian Precision Components Private Limited | Stage 6 | Account Opened | NRFT | 1 | 3 | 11 / 8 | 10 |
| Ishita Banerjee | Stage 1 | Under Review by Operations | RFT | 0 | 0 | 0 / 0 | 2 |
| Kabir Khanna | Stage 1 | Query Raised to CSE - Missing Information | NRFT | 1 | 3 | 4 / 1 | 2 |
| Nandini Iyer | Stage 2 | Application Form Under Preparation | RFT | 0 | 0 | 2 / 2 | 2 |
| Vivaan Desai | Stage 2 | Physical Form Submitted to CSE | RFT | 0 | 0 | 5 / 5 | 3 |
| Anika Reddy | Stage 3 | Under Review - Signed Form | RFT | 0 | 0 | 6 / 6 | 5 |
| Devansh Kapoor | Stage 3 | Discrepancy Raised to CSE | NRFT | 1 | 3 | 7 / 4 | 6 |
| Prisha Nair | Stage 4 | Resubmitted Form Received - Under Review | NRFT | 1 | 3 | 9 / 6 | 8 |
| Arnav Patel HUF | Stage 4 | Form Found in Order - Ready for MOFSL Submission | RFT | 0 | 0 | 6 / 6 | 6 |
| Zenith Industrial Supplies Limited | Stage 5 | Submitted to MOFSL | RFT | 0 | 0 | 8 / 8 | 7 |
| Myra Sharma | Stage 5 | Query Raised by MOFSL | NRFT | 1 | 4 | 10 / 6 | 8 |
| Reyansh Gupta | Exception | On Hold | RFT | 0 | 0 | 8 / 8 | 4 |
| Aster Trading Private Limited | Exception | Rejected | RFT | 0 | 0 | 9 / 9 | 6 |
| Diya Mukherjee | Exception | Cancelled by Client | RFT | 0 | 0 | 5 / 5 | 4 |
| Orion Capital Advisors LLP | Stage 5 | Submitted to MOFSL | RFT | 0 | 0 | 23 / 23 | 8 |

MIS: 12 open, 4 closed, 1 on hold, 1 rejected and 1 cancelled. On-hold cases are included in open.
RFT: 56.2%. Average gross/net TAT: 8.2 / 6.8 working days. Rejected and cancelled cases are excluded from those metrics.

Verified every saved entry field directly using read-only SQLite, including process dates, discrepancy types, query details, review outcomes, owners, notes and account details. Checked exact status-history actors and business dates, stable references, touch counts, PAN masking, role visibility, query counts/holds and gross/net TAT. SQLite integrity and foreign-key checks passed.

The generated references use the server creation date. Historical receipts and process dates are supplied separately; audit recording timestamps retain the actual save date.

Scenario timelines and assertion results are in `artifacts/api-simulation/evidence.json`. The local runner is `artifacts/api-simulation/run.py`; rerunning it with `--reset` clears operational records again after another backup.

Repository checks passed: `npm run check`, `npm run build`, `npm test` with 17 frontend and 23 backend tests, and `npm run guide:check`.

Independent interval checks also verified every stage TAT. The repeated Stage 3/4 case accumulated 6 and 5 gross working days across both visits. Every old/new status link forms a continuous audit chain. The pre-reset backup was reopened and its integrity and original counts verified.

UI verification also passed in the collaborative browser at desktop and mobile widths. All 18 register rows, 18 case-detail drawers, 18 edit forms including all process dates, all 115 audit rows, every CSE/location/segment MIS cell, dashboard KPIs, pipeline figures, SLA settings and 11 user rows matched the API. Search, status filters and receipt-date filtering passed; an active MIS date filter preserved the register's full case metrics.

CSE showed its six owned cases; MOFSL showed seven Stage 5/6 cases; Operations and Viewer showed all 18. Role navigation, write controls and masked PAN matched permissions. The mobile overview and register contained horizontal scrolling within the relevant navigation/table, and the case drawer fitted the viewport. No application source changes were needed. A direct before/after database comparison confirmed every case, entry, touch count and history record remained unchanged. Detailed browser assertions are in `artifacts/api-simulation/ui-evidence.json`.
