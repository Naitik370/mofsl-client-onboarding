# MOFSL Client Onboarding

A multi-user onboarding register and MIS for tracking client requests through a six-stage workflow. The application provides API-generated Reference IDs, role-controlled updates, append-only audit history, bulk upload, and Python-calculated RFT, query hold, TAT, SLA, and exception reporting.

## Run locally

```powershell
git clone git@github.com:Naitik370/mofsl-client-onboarding.git
cd mofsl-client-onboarding
python -m pip install -r requirements.txt
npm install
npm run build
npm start
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). For later runs, use `npm start`; press `Ctrl+C` to stop the server.

## Demo data

The committed `sql/onboarding.db` contains 56 demonstration cases and loads automatically when the server starts. Application and API changes are saved to this file. Removing it creates a fresh database with master data and demo users, but without the demonstration cases.

## Project guides

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

Demo credentials are for local use only. Replace them before a shared deployment.

## Verify

```powershell
npm run check
npm run build
npm test
```
