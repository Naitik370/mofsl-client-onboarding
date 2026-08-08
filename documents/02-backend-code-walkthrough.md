---
title: Backend Code Walkthrough
tags: [client-onboarding, backend, python]
---

# Backend code walkthrough

## `backend/server.py`

This is the executable entry point. `main()` reads an optional port argument, defaults to `4173`, and starts Uvicorn on localhost.

## `backend/router.py`

The router owns HTTP concerns only:

| Code | Responsibility |
| --- | --- |
| `lifespan()` | Initialize the database at application startup |
| `http_error()` | Return FastAPI errors as `{ "error": ... }` JSON |
| `require_user()` | Resolve and require a valid session cookie |
| `require_admin()` | Require the authenticated role to be `admin` |
| `/api/auth/*` | Login, current user, and logout |
| `/api/meta` | Status/location/segment/SLA masters |
| `/api/cases` | Visible entries and create/update operations |
| `/api/users` | Admin-only list and creation |
| `/api/history` | Role-filtered audit history |
| `/api/reports` | Role-filtered MIS calculations |

The final `app.mount()` serves frontend files and `index.html`.

## `backend/domain.py`

This module contains rules that do not know about FastAPI or SQLite:

- Controlled role, entry, account, channel, owner, and status sets.
- Status-to-date mappings.
- `parse_date()` for ISO dates.
- `normalize_payload()` for trimming, PAN capitalization, and optional admin date capture.
- `working_days()` for Monday–Friday calculations excluding Holiday Master dates.
- `hold_and_queries()` for pairing query starts with resolutions.
- `process_dates()` for audit-event-derived milestone dates.
- `mask_pan()` for report-safe PAN display.

## `backend/policies.py`

This module handles authorization decisions without querying the database.

- `CaseAccessContext` carries only the existing CSE name and stage.
- `case_write_errors()` applies role policy.
- Admin and Operations can write all statuses.
- Viewer cannot write.
- CSE can write four CSE-side statuses and only to its own cases.
- MOFSL can write four MOFSL-side statuses after the case has reached Stage 5.

## `backend/services.py`

This is the application and persistence layer.

### Database lifecycle

- `connect()` opens SQLite, enables foreign keys, and returns named rows.
- `database()` commits work and always closes the connection.
- `init_db()` applies `schema.sql` and seeds controlled records.

### Authentication

- `password_digest()` uses PBKDF2-HMAC-SHA256 with 200,000 iterations.
- `create_user()` validates and stores salted hashes.
- `authenticate()` verifies credentials and creates a session.
- `session_user()` removes expired sessions and resolves the current identity.
- `logout()` deletes the hashed session token.

### Visibility and authorization

- `visible_rows()` restricts CSE users to matching `cseName`; MOFSL users see MOFSL-owned or Stage 5/6 rows.
- `case_rows_for_user()` additionally removes full PAN for viewers.
- `role_errors()` loads the minimum existing-case context and delegates the decision to `policies.py`.

### Validation

The API generates a unique `MOFSL-YYYYMMDD-XXXXXXXX` Reference ID for each New case before `validate()` checks required fields, master membership, controlled values, PAN format, ISO dates, date order, closure data, query details, channel-specific statuses, and Reference ID/entry-type consistency.

### Persistence

- `case_query()` joins normalized tables into UI-friendly rows.
- `save_case()` updates or creates the stable `cases` record, writes a `case_entries` row, and appends `status_history` when the status differs from the previous status.
- A related entry reuses the case identified by `Reference ID`.
- CSE writes force `cseName` to the signed-in display name and owner to Operations.
- MOFSL writes force owner to MOFSL.

### Reporting

- `latest_case_rows()` groups entries by case and selects the latest row.
- `audit_events()` loads the entire status event stream.
- `report()` calculates case metrics and aggregates summary, pipeline, and grouped MIS.
- `get_meta()`, `get_cases()`, `get_users()`, and `get_history()` provide query endpoints.

## `backend/test_server.py`

Tests use temporary SQLite databases. They cover authentication, permissions, validation, duplicates, manual/automatic dates, query-derived NRFT and hold time, PAN masking, holidays, related-entry history, and an HTTP end-to-end flow.
