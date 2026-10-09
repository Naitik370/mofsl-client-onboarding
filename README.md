# MOFSL Client Onboarding

A multi-user onboarding register and MIS built with React and an ASP.NET Core REST API. The API persists records in SQLite and calculates RFT, query hold, working-day TAT, SLA, and exception reports across the six-stage workflow.

## Run locally

```powershell
git clone git@github.com:Naitik370/mofsl-client-onboarding.git
cd mofsl-client-onboarding
npm install
npm run build
npm start
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). For later runs, use `npm start`; press `Ctrl+C` to stop the server.

Prerequisites: Node.js 22.12+ and the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0). The npm scripts detect a normal SDK installation or the local Windows installation at `%LOCALAPPDATA%/mofsl-dotnet`. Set `MOFSL_DOTNET` to use a different dotnet executable.

For frontend hot reload, keep `npm start` running and run `npm run dev` in another terminal. Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/); Vite proxies `/api` to ASP.NET Core.

## Demo data

The committed `sql/onboarding.db` contains 56 demonstration cases and loads automatically when the server starts. Application and API changes are saved to this file. Removing it creates a fresh database with master data and demo users, but without the demonstration cases.

## Project guides

[Document alignment and final sanity check](documents/08-specification-audit.md) records the supported fields, calculations, and remaining limitations.

[PDF application and code walkthrough](output/pdf/client-onboarding-walkthrough.pdf) is a 25-page reading copy covering setup, roles, the six stages, save flow, MIS, and source references. It reflects the verified `final-demo` working tree on 8 October 2026.

[Interactive code and user-flow guide](documents/client-onboarding-flow.html) explains the application from startup through the six stages, saves, audit, and MIS. Click any segment to open a sidebar with its user actions and the exact source blocks, file names, and line numbers. It works offline; regenerate it with `npm run guide` after editing code.

[Migration, API contracts, and deployment](documents/07-dotnet-react-migration.md) describes the active React/.NET implementation and compatibility with existing data.

These relative links open the standalone HTML documentation stored in this repository:

- [Workflow, user stories, and case handling](documents/user-stories-and-case-handling.html)
- [Admin login guide](documents/role-guides/admin-login-guide.html)
- [Operations login guide](documents/role-guides/operations-login-guide.html)
- [CSE login guide](documents/role-guides/cse-login-guide.html)
- [MOFSL login guide](documents/role-guides/mofsl-login-guide.html)
- [Management Viewer login guide](documents/role-guides/viewer-login-guide.html)

## Demo logins

| Username | Password | Access |
| --- | --- | --- |
| `admin` | `AdminDemo@123` | Full access and user administration |
| `operations` | `OpsDemo@123` | Case entry, editing, bulk upload, audit, and MIS |
| `cse` | `CseDemo@123` | Assigned cases and CSE-side updates |
| `mofsl` | `MofslDemo@123` | Stage 5/6 cases and MOFSL-side updates |
| `viewer` | `ViewDemo@123` | Read-only register, audit, and MIS |
| `sim.aditi` | `SimAditi@123` | CSE: Aditi Deshmukh (simulation user) |
| `sim.rohit` | `SimRohit@123` | CSE: Rohit Kapoor (simulation user) |
| `sim.priya` | `SimPriya@123` | CSE: Priya Menon (simulation user) |

Demo credentials are for local use only. Replace them before a shared deployment.

## Verify

```powershell
npm run check
npm run build
npm test
```
