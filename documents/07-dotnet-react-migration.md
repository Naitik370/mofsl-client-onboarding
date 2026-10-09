# ASP.NET Core and React migration

The active runtime is ASP.NET Core on .NET 10 with a React 19 frontend built by Vite. React uses TypeScript for API types and validation. All MIS calculations run in C# on the server.

## Source map

| File | Responsibility |
| --- | --- |
| `backend/dotnet/Program.cs` | Dependency registration, initialization, static files |
| `backend/dotnet/ApiEndpoints.cs`, `ApiSessionMiddleware.cs` | REST routes, session authorization, cookies, JSON errors |
| `backend/dotnet/AuthenticationService.cs`, `UserService.cs` | Login, sessions, password hashing, user administration |
| `backend/dotnet/CaseService.cs`, `CaseAccessPolicy.cs`, `CaseValidator.cs` | Transactional case writes, role permissions, validation |
| `backend/dotnet/StatusAutomation.cs` | Completed-action status inference and field-derived Current Stage |
| `backend/dotnet/ReportService.cs`, `CaseQueries.cs` | Report aggregation and shared case read queries |
| `backend/dotnet/Domain.cs` | Working days, query holds, normalization, PAN masking, seeds |
| `backend/dotnet/Database.cs`, `DatabaseInitializer.cs` | SQLite connections, parameterized SQL, initialization and migrations |
| `backend/tests/ApiTests.cs` | Business rules and HTTP integration tests with isolated SQLite databases |
| `frontend/app.tsx`, `useWorkspace.ts` | Navigation, session state, API snapshot loading |
| `frontend/navigation.ts` | Hash route parsing and screen/case links |
| `frontend/components/` | Focused screens, local form state, shared display components |
| `frontend/lib.ts` | Typed requests, validation, CSV parsing and templates |
| `frontend/styles.css` | Existing responsive styling |
| `vite.config.ts` | Frontend build and development API proxy |
| `sql/schema.sql` | Existing normalized schema |

The obsolete Python backend, its requirements file, and the vanilla TypeScript frontend have been removed. The application uses only the ASP.NET Core API and React frontend.

## Run and verify

The [interactive flow guide](client-onboarding-flow.html) covers setup, user actions, implementation, and the SOLID design choices. Click a segment to inspect actual source excerpts. `npm run guide` regenerates the standalone HTML; `npm run guide:check` detects stale excerpts. Source formatting is available through `npm run format` and `npm run format:check`.

Services receive `TimeProvider` for dates and session expiry, allowing fixed-clock tests. SQLite remains a concrete dependency; no repository abstraction is introduced merely to wrap its existing operations. The responsibility split preserves existing routes. Additive migrations extend the schema with process fields, business event dates, and automatic touch tracking.

Install Node.js 22.12+ and the .NET 10 SDK, then run:

```powershell
npm install
npm run check
npm run build
npm test
npm start
```

Open `http://127.0.0.1:4173/`. `npm start` serves the built React application and API from the same origin. Run `npm run build` after changing frontend source. For hot reload, run `npm run dev` in another terminal and open `http://127.0.0.1:5173/`.

`scripts/dotnet.mjs` uses an installed SDK, the local Windows SDK at `%LOCALAPPDATA%/mofsl-dotnet`, or the executable specified by `MOFSL_DOTNET`. `npm run check` checks React TypeScript and builds the API. `npm test` runs the C# tests without requiring Python.

## API compatibility

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/health` | Public |
| POST | `/api/auth/login` | Public, validates active credentials |
| GET | `/api/auth/me` | Authenticated |
| POST | `/api/auth/logout` | Authenticated |
| GET | `/api/meta` | Authenticated |
| GET, POST | `/api/cases` | Role-filtered reads and authorized writes |
| PUT | `/api/cases/{entryId}` | Authorized entry edits |
| GET | `/api/history` | Role-filtered audit |
| GET | `/api/reports?start=&end=&dimension=cseName` | Role-filtered MIS |
| GET, POST | `/api/users` | Admin |
| GET, PUT | `/api/settings` | Admin |

The routes and camelCase response fields match the former API. Saves return 201 for new entries and 200 for edits. Validation returns 400 with `errors`; denied case writes return 403 with `errors`. Authentication failures return 401 with `error`. Report dimensions remain `cseName`, `location`, and `segment`. Invalid report date ranges now return a clear 400 response.

`GET /api/meta` includes a `requiredFields` object with field labels for each status. React uses these rules to mark required controls and validate forms and CSV imports. The API validates the final status after CSE response routing and automatic status inference. Dated actions require their process date; readiness requires a `Found in Order` Stage 4 review outcome. Opening and closure still require account details, and queries require event details. Historical reads remain available even when a record lacks a newly required field; subsequent saves must supply the required fields for the resulting status.

Enter the channel-specific sending date once. The API copies it into a blank Outward Date, and also accepts legacy Outward Date-only submissions by filling the channel-specific date. Supplied dates are preserved. Outward Date remains available under Show all process dates.

Status Business Date defaults to the server date when a status is selected and follows changes to that status's process date. A manual business-date edit is preserved until another status is selected. When API callers omit it, the API uses a newly supplied matching process date, the original inward date for an initial receipt/review, or the server's local date. Same-status edits preserve the existing business date. Historical undated audit events still use their recorded date in reports.

The six-stage status mappings, Reference ID generation, append-only history, query counting, FIFO query resolution, holiday exclusion, gross-TAT SLA comparison, and rejected/cancelled exclusions are retained. An admin can opt into filling a blank status-related date using the server date. React does not calculate MIS or replace this server date with the browser date.

React uses component state and JSX. CSE/MOFSL updates create related entries; Admin/Operations can edit existing entries. Register metrics come from an unfiltered report even when the MIS period is filtered. CSV supports quoted multiline fields and DD-MM-YYYY dates. Each imported row uses the ordinary case endpoint; successful rows remain marked imported, and later failures remain visible. Bulk import is not atomic.

The register groups API entries by Reference ID and selects the latest `updatedAt`, with entry ID breaking ties, matching the server's latest-case selection. It displays one row per case; the details drawer retains all entry and status history. Hash routes preserve screen/case navigation across refresh and Back. Stage-specific form fields preserve hidden values, and selecting a manual status continues to disable status inference. Errors retain the API's message array for field-level display. The form's edit target is fixed when opened so a concurrent refresh cannot change which entry receives a save.

## Process dates, touches, and stage reporting

Dedicated stage dates, discrepancy type, Stage 4 review outcome, and query detail fields are saved with entries. Status history stores business dates separately from recording timestamps. Touch Count is incremented by each successful save, including same-status edits; earlier saved entries form a minimum legacy baseline. Reports expose six stage TAT values, per-stage SLA flags, and Stage 1/3/5 and CSE/MOFSL query attribution. Case Details displays the metrics and dates. Admin can configure overall and stage SLA in SLA Settings.

New process dates can infer completed-action statuses, subject to ordinary role permissions and validation. An explicit status selection disables inference. The request-only `autoStatus` flag enables or disables inference for that save; it is not a persisted calculation field. Current Stage derives from the furthest populated process field and the status stage, with an optional `stage_override` on each entry. The existing EntryFields migration adds this nullable column to older databases. Status-stage authorization and event-based TAT remain independent of this display/MIS override. CSE query and discrepancy replies automatically select the corresponding related-entry type and resolution status.

## Existing data and authentication

Schema upgrades are additive and run once at startup. The API opens the existing `sql/onboarding.db` and seeds only missing masters/users. Existing Reference IDs and records are preserved. Passwords use the same UTF-8 PBKDF2-HMAC-SHA256 format, 200,000 iterations, 16-byte salt and 32-byte hash. Session tokens remain SHA-256 hashes in `sessions`, with a 12-hour expiry. Cookies are HttpOnly and SameSite Strict, with Secure enabled on HTTPS requests. The session supplies the audit actor.

Use `DatabasePath` to select a different database and `ProjectRoot` to override the repository root. For example:

```powershell
$env:DatabasePath = 'C:/data/onboarding.db'
npm start
```

Tests use temporary databases. Browser verification should also use a copied database so it does not change business records.

## Publish

Build the frontend before publishing so the generated files are included:

```powershell
npm run build
node scripts/dotnet.mjs publish backend/dotnet/Onboarding.Api.csproj -c Release -o artifacts/api
$env:DatabasePath = 'C:/data/onboarding.db'
node scripts/dotnet.mjs artifacts/api/Onboarding.Api.dll --urls http://127.0.0.1:4173
```

The publish directory includes the schema and React files. It excludes the local database. Set `DatabasePath` explicitly for published deployments. Back up the database before switching deployments and replace the documented demo credentials before shared use.

## Verification

C# tests cover all role logins, authorization, masked PAN, generated references, manual/admin dates, invalid fields, ownership, audit actor, query holds, report exclusions, session expiry, inactive users, logout and invalid JSON. The migration was also compared with Python using a copy of the existing database across all five roles and all three MIS dimensions, excluding only the report generation timestamp.
