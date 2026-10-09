# Architecture and request flow

React renders the application. ASP.NET Core owns validation, permissions, persistence, and MIS. SQLite stores normalized records. The repository contains no separate Python backend or vanilla TypeScript UI.

1. Vite builds frontend/app.tsx and its components into frontend/dist.
2. Program.cs registers Database, TimeProvider, and focused services, runs idempotent migrations, and serves the React build.
3. Login creates a server-side session with a protected cookie. useWorkspace restores it and loads metadata, case entries, audit events, and reports.
4. CaseEntry submits POST /api/cases for a new/related entry or PUT /api/cases/{entryId} for an edit.
5. CaseAccessPolicy and CaseValidator enforce access and business rules before a transaction changes data.
6. CaseService writes fields, increments automatic touches, and appends status history when status changes. The business date is independent of the audit timestamp.
7. ReportService calculates overall and per-stage metrics. React displays the results and never calculates MIS independently.

The stable Reference ID groups cases, operational entries, and history. Audit history is append-only through the API. An unchanged status still counts a successful save as a touch, but does not create another status event.

[Interactive flow and source blocks](client-onboarding-flow.html)
