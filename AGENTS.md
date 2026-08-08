# MOFSL Client Onboarding

## Purpose

This project is the multi-user client-onboarding register and MIS application derived from:

`C:\Users\Naitik\Downloads\Inward and outward register for client onboarding requests.docx`

Detailed decisions and requirements are maintained in:

`C:\Users\Naitik\personal-vault\Projects\Client Onboarding Register`

Do not move MIS calculations back into Excel or Google Sheets. The TypeScript UI collects and displays data; Python APIs persist records and calculate reports.

## Run And Verify

```powershell
npm install
python -m pip install -r requirements.txt
npm run build
npm start
```

Open `http://127.0.0.1:4173/`.

Before completing changes, run:

```powershell
npm run check
npm run build
npm test
```

## Architecture

- `frontend/index.html`: application shell, login, data entry, MIS, audit, and user administration.
- `frontend/app.ts`: TypeScript UI, frontend validation, API calls, and role-aware controls.
- `frontend/dist/app.js`: generated browser bundle. Do not edit it manually.
- `backend/server.py`: Uvicorn server startup.
- `backend/router.py`: FastAPI routes, cookies, authentication dependencies, and static frontend serving.
- `backend/services.py`: authentication, authorization, persistence, validation, and MIS calculations.
- `sql/schema.sql`: normalized SQLite schema with primary and foreign keys.
- `sql/onboarding.db`: local application database.
- `backend/test_server.py`: backend business-rule and role-permission tests.

The normalized tables are `role_master`, `users`, `sessions`, `cases`, `case_entries`, `status_history`, `status_master`, `location_master`, `segment_master`, `holiday_master`, and `settings`. API report responses are intentionally denormalized for the UI.

## Business Rules

- `Reference ID` is the stable case key.
- New, resubmission, discrepancy-resolution, and modification entries may share a Reference ID.
- Every status change creates an append-only Status History event.
- Process dates are entered manually by default; admins may opt into per-entry status-based auto-date capture without overwriting supplied dates.
- Current stage is derived from Status Master.
- Query Count is derived from qualifying status events.
- RFT becomes NRFT when a Stage 1 query, Stage 3 discrepancy/return, or Stage 5 MOFSL query occurs.
- Query Hold Days are derived from query-start and resolution events.
- TAT uses Monday-Friday working days excluding Holiday Master dates.
- The default SLA is 7 working days.
- Rejected and cancelled cases are excluded from final RFT percentage and average TAT, but remain exception counts.
- PAN must be masked in MIS and reporting views.

## Roles

- `admin`: full access and user administration.
- `operations`: full case entry/edit, bulk upload, audit, and MIS.
- `cse`: own cases and CSE request/resubmission/resolution statuses.
- `mofsl`: Stage 5/6 cases and MOFSL query/resolution/account-opening statuses.
- `viewer`: read-only management reporting, register, and audit.

RM is case metadata, not an application role. API authorization is authoritative; hiding a UI control is not sufficient protection.

## Security

- Passwords are salted PBKDF2 hashes.
- Sessions are server-side and sent through HttpOnly, SameSite cookies.
- Never store plaintext passwords or trust client-supplied user identity.
- Status History `changed_by` must come from the authenticated session.
- Replace local demo credentials before shared or production deployment.

## Change Discipline

- Keep backend dependencies minimal; FastAPI and Uvicorn provide the HTTP layer.
- Preserve the source-document fields and six-stage workflow.
- Update `sql/schema.sql`, migrations in `init_db()`, tests, and this file together when the data model changes.
- Add backend checks for every permission or calculation change; frontend checks alone are insufficient.
- Do not commit generated caches, temporary recordings, or local server logs.
