# Document alignment and final sanity check

Reviewed on 8 October 2026 against Inward and outward register for client onboarding requests (1).docx received in this conversation.

The received document has the same ordered paragraph and table-cell text as the original in Downloads: all 339 paragraph nodes match. This compares content, not Word formatting or package metadata. Its SHA-256 is 0846a1e26c4462107fddc5fd48910e3b328f8f0c6fd92e63ecfde01966c9cad0.

The previously identified field and reporting gaps are now implemented in the ASP.NET Core API and React frontend. The application uses .NET 10 and React with typed TSX components. The Python backend, requirements file, and vanilla TypeScript frontend have been removed.

## Requirement traceability

| Requirement | Current implementation |
| --- | --- |
| Identity and organization | Reference/Request IDs, entry type, client, PAN, account type, Physical/Digital channel, location, segment, RM, CSE, processor, and current owner. |
| Six stages and Status Master | All 22 status/stage pairs match the document after normalizing dash punctuation. |
| Generic dates | Inward, outward, resubmission, signed form receipt, MOFSL submission, and account opening remain manually enterable. |
| Dedicated stage dates | Stage 1 query/resubmission, form preparation, physical/digital submission, discrepancy/return, Stage 4 resolution/form receipt, and MOFSL query/resolution are persisted and available under Stage dates. Communication date is also available. |
| Stage-specific detail | Stage 1 Query Details, Discrepancy Type, Stage 4 Review Outcome, and MOFSL Query Type are persisted and exposed in React and CSV. |
| Discrepancy dropdown | Document Missing, Signature Mismatch, Incomplete Details, Other. Blank is allowed when no discrepancy applies. |
| Review dropdown | Found in Order, Still Pending. A pending outcome cannot be marked ready or submitted to MOFSL. |
| Touch Count | API increments once per successful new entry or edit, including unchanged-status saves. Viewing and failed saves do not count. The form is read-only and CSV cannot set it. |
| Original inward/resubmissions | Earliest inward date per Reference ID and entry count minus one, shown in Case Details. |
| RFT/query count | Qualifying Stage 1/3/5 status-change events determine query count and RFT/NRFT. |
| Query holds | FIFO start/resolution intervals use business dates when available, with working-day holiday exclusions. |
| Overall TAT/aging | Gross/net TAT and open-case aging are calculated on the server. Open aging uses today even if an opening date was entered before closure. |
| Stage TAT | Gross working-day intervals are accumulated across repeated stage visits. Skipped stages remain unknown. |
| Overall/stage SLA | Gross TAT above each configured threshold produces a breach. Default is seven working days. Admin can change all seven thresholds through SLA Settings. |
| MIS attribution | CSE, Location, and Segment groups include Stage 1/3/5 counts and CSE-side/MOFSL-side totals, plus stage SLA case counts. |
| Pipeline/dashboard | Current stage counts, case aging, time within the stage, overall quality, exception counts, and attention list. |
| Reporting detail | Case Details shows original inward, resubmissions, touches, overall/stage TAT, SLA flags, process dates, and query attribution. |
| Audit | Append-only status history keeps the authenticated actor, recording timestamp, and business date separately. |
| Permissions/privacy | API role checks are authoritative; settings are Admin-only and PAN is masked in reporting. |
| Existing data | Additive migrations preserve cases, references, entries, users, and history. Tests use isolated databases. |

## Agreed interpretations

The Word document still describes an Excel workbook, manually entered Query Hold Days, and an optional stage override. Current user instructions and recorded project decisions select the .NET/React application, automatic query holds, and status-derived stages instead.

Touch Count is automatic following the user's latest correction. It measures recorded saves, not time spent viewing a case. Query Count and Resubmission Count remain separate metrics.

Stage SLA uses gross working days, including query waiting time, with a seven-day default as confirmed by the user. Stage timing attributes each interval to the starting stage; revisits accumulate. Opening and communication can delimit Stage 6.

## Historical data and operational limits

- Earlier cases have a minimum Touch Count baseline from saved entry count. Old edits were not tracked and cannot be reconstructed reliably. Case Details labels this baseline.
- Undated historical events retain audit-date fallback and are marked in Case Details. New status changes can specify Status business date or a dedicated process date. Audit timestamps are not rewritten to fabricate historical dates.
- Same-status saves increment touches but do not append a status-change event or increment query count.
- The application maps all stages but does not enforce a strict sequential transition graph. Skipped stages are reported as unknown rather than zero.
- Bulk import remains sequential and non-atomic; successful rows remain saved if a later row fails.
- Holiday exclusions use Holiday Master. The seed supplies 2026 dates; there is no holiday-maintenance screen.

## Verification

- TypeScript checks and .NET builds pass with zero warnings/errors.
- Production React build passes.
- All 22 tests pass: 16 backend and 6 frontend.
- Tests cover automatic touch counting, forged counts, same-status saves, failed-save rollback, migration preservation/idempotency, backdated stage timing, repeated stage visits, holidays, SLA permissions, query attribution, categorical validation, CSV fields, all roles, authentication, and existing workflow rules.
- Browser checks use a copied database and cover entry creation/editing, read-only touches, stage date inputs, Case Details, and SLA Settings.
- The interactive guide has 39 segments and source excerpts verified by npm run guide:check.

Relevant sources: [schema](../sql/schema.sql), [case saves](../backend/dotnet/CaseService.cs), [stage metrics](../backend/dotnet/StageMetrics.cs), [reports](../backend/dotnet/ReportService.cs), [case entry](../frontend/components/CaseEntry.tsx), [case details](../frontend/components/CaseDetails.tsx), and [tests](../backend/tests/ApiTests.cs).
