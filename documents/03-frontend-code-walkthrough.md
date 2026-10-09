# React frontend walkthrough

The active frontend uses React JSX in typed TSX components. Vite builds it; generated frontend/dist files must not be edited directly.

| Source | Responsibility |
| --- | --- |
| app.tsx | Navigation and screen orchestration |
| useWorkspace.ts | Session state, metadata, cases, audit, report snapshots |
| lib.ts | Typed requests, validation, date labels, CSV parser/template |
| components/LoginScreen.tsx | Sign-in form |
| components/CaseEntry.tsx | Editable case fields and dedicated stage dates |
| components/ReportingViews.tsx | Overview, performance groups, register, audit |
| components/CaseDetails.tsx | Read-only process dates, touches, timing, attribution |
| components/BulkUpload.tsx | CSV preview and sequential import |
| components/UserAdministration.tsx | Admin user creation/list |
| components/SlaSettings.tsx | Admin overall and stage SLA thresholds |
| components/shared.tsx | Tables, panels, statuses, errors |

CaseEntry owns form state. Admin/Operations can edit entries. CSE/MOFSL updates create related entries. Status selections reflect roles, with the API enforcing the same permissions.

The Stage dates disclosure includes the dedicated date inputs. Discrepancy type and Stage 4 review outcome use controlled values. Touch Count is read-only because the API calculates it.

Case Details is available to reporting users and displays original inward date, resubmissions, automatic touches, gross/net TAT, stage timings, SLA flags, and query source breakdowns. Reports show masked PAN.

CSV uses the same field names/date labels and validation as entry. Touch Count is not accepted as input. Imported rows use the ordinary save endpoint; each success counts one touch. Bulk import remains non-atomic.

[Interactive code guide](client-onboarding-flow.html)
