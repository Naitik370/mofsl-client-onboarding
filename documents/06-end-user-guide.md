---
title: MOFSL Client Onboarding End-User Guide
tags: [client-onboarding, user-guide, operations]
---

# MOFSL Client Onboarding end-user guide

## Purpose

Use this application to record each onboarding request once, add later activity under the same Reference ID, preserve an audit trail, and view automatically calculated MIS.

## Before you begin

Open `http://127.0.0.1:4173/` and sign in with your assigned account. Keep your sign-in details private.

## What each role can do

| Role | Register visibility | Case actions | Other access |
| --- | --- | --- | --- |
| Admin | All cases | Create and edit any entry/status | Bulk upload and create users; optional automatic date capture |
| Operations | All cases | Create and edit any entry/status | Bulk upload, audit, and all MIS |
| CSE | Cases where CSE Name matches the signed-in display name | Add request, resubmission, or discrepancy-resolution updates | Own-case audit and MIS |
| MOFSL | MOFSL-owned cases and cases at Stage 5/6 | Add MOFSL query, resolution, opening, or closure updates | Relevant audit and MIS |
| Management Viewer | All cases, with protected PAN | No changes | Read-only register, audit, and MIS |

## Create a new case

1. Open **New Entry**.
2. Enter a **Request ID**. The application generates the stable **Reference ID** when the case is saved.
3. Keep **Entry Type** as `New`.
4. Enter client, PAN, account type, channel, location, segment, RM, CSE, processor, and owner details.
5. Review Inward date, which defaults to today. Correct it if Operations received the request earlier.
6. Select the current status from the controlled list.
7. Add query details whenever the selected status represents a query, discrepancy, or returned form.
8. Select **Save entry**.

The application validates the request, generates a Reference ID in the format `MOFSL-YYYYMMDD-XXXXXXXX`, creates the case and its first entry, and adds the initial status-history event.

For CSE users, saving a New entry automatically sets the status to `Under Review by Operations` and assigns it to Operations.

## Add activity to an existing case

The Reference ID must remain unchanged throughout the journey.

Case Register shows one row per Reference ID with the latest saved status and case-level metrics. Select a row or **Details** to open its saved entry history and append-only status history. **Edit** updates the latest entry; **Add update** creates a related entry for CSE/MOFSL. Actions stay pinned on the left when the table scrolls.

The form groups fields into **Client**, **Assignment**, **Status & dates**, and **Notes**. Latest Status options are grouped by stage. Fields follow the selected stage; hidden values remain saved. Errors appear below their fields, and keyboard focus moves to the first invalid field. **Cancel** returns an existing entry to the register; **Clear** resets a new form. Leaving a changed form asks before discarding it.

Navigation uses URLs such as `#/cases` and `#/cases/MOFSL-20260808-06B20049`. Copy a case's **Details** link to share it with another authorized user. Refresh preserves the screen and case, and browser Back moves through the app's visited screens. Refreshing a changed form uses the browser's unsaved-change warning; drafts are not saved automatically.

- Admin or Operations can select **Edit** to change the existing operational entry, or create a new related entry using `Resubmission`, `Discrepancy Resolution`, or `Modification`.
- CSE and MOFSL select **Add update**. The form copies the current case data but saves a new related entry rather than overwriting the old one.
- When Operations has selected `Query Raised to CSE - Missing Information`, the CSE update automatically selects `Resubmission` and `Resubmitted by CSE`. Saving keeps the existing Reference ID and closes the query hold interval.
- A non-`New` entry is rejected when its Reference ID does not already exist.
- Users cannot supply the Reference ID for a `New` entry; the application generates it when you save.

## Handle the normal case journey

The entry form enables **Update status from newly entered process dates and review outcome** by default. On save, the API selects the latest newly entered action date: form preparation, physical/digital form submission, signed-form receipt, discrepancy resolution/resubmitted-form receipt, MOFSL submission/query resolution, account opening, or communication sent. **Found in Order** in Stage 4 selects readiness for MOFSL. Copied dates do not trigger another transition. Account opening and closure require both the opening date and account number.

Selecting **Latest status** manually switches automatic selection off. Use that dropdown for query creation, review initiation, On Hold, Rejected, and Cancelled. Query statuses require event details. CSE replies to a missing-information query automatically use Resubmission; replies to a discrepancy/returned form automatically use Discrepancy Resolution.

**Current Stage** is calculated from the furthest populated process field and the status's mapped stage. Admin and Operations can set **Current Stage override**, or clear it to restore automatic calculation. This changes stage filtering and the pipeline, while audit history and access permissions continue to follow the actual status. Stage TAT uses dated events and process dates; changing the stage override does not rewrite elapsed time.

```text
Request received
→ Operations review
→ Form preparation
→ Physical form to CSE OR digital form to client
→ Signed form received and reviewed
→ Discrepancy resolution when required
→ Submitted to MOFSL
→ MOFSL query resolution when required
→ Account opened
→ Communication sent / case closed
```

The system currently allows Admin and Operations to select any master status; users must follow the business sequence because the application does not yet block skipped or reversed transitions.

## Handle a query or discrepancy

1. Select the relevant query-start status.
2. Enter Query / Event Details; saving without details is rejected.
3. Save the event. Query Count increases and the case becomes NRFT.
4. When the response arrives, add the matching resolution status.
5. The system calculates working-day hold time between the start and resolution events.

| Start | Resolution |
| --- | --- |
| Query Raised to CSE - Missing Information | Resubmitted by CSE |
| Discrepancy Raised to CSE or Form Returned to CSE | Discrepancy Resolution Received or Resubmitted Form Received - Under Review |
| Query Raised by MOFSL | Query Resolved - Resubmitted to MOFSL |

An unresolved query continues accumulating hold days through today.

## Close a case

For `Account Opened` or `Communication Sent - Case Closed`, provide both:

- Account number
- Account opening date

The account-opening date cannot be earlier than the inward date. Closed-case TAT ends at the opening date.

## Handle exceptions

- **On Hold** remains an open case and appears in the attention view. Selecting it alone does not create query hold days.
- **Rejected** remains visible as an exception but is excluded from final RFT percentage, average TAT, and SLA-breach totals.
- **Cancelled by Client** follows the same reporting exclusions as Rejected.

Add a clear remark because rejection and cancellation reasons are not currently mandatory fields.

## Automatic dates

Inward date defaults to the server's current local date for New cases. It remains editable for earlier receipts. The API also fills a missing inward date when creating a New case. Supplied dates are preserved, and edits or related updates do not automatically receive a new inward date. Case-level TAT continues to use the earliest inward date under the Reference ID.

Other process dates are manual by default. Admin may select **Auto-capture related date** for one save. The server fills the relevant blank date with today and never overwrites a supplied date. Operations, CSE, and MOFSL cannot enable this option.

## Bulk upload

1. Open **Bulk Upload** as Admin or Operations.
2. Download the template or select a compatible CSV.
3. Review the validation preview.
4. Correct invalid rows in the CSV and upload again.
5. Import valid rows.

Valid rows are submitted individually. Earlier rows remain saved if a later row fails.
CSV date columns accept `DD-MM-YYYY` or `YYYY-MM-DD`.

## Use the reports

- **MIS Overview** shows workload, closures, RFT, TAT, SLA, exceptions, pipeline, and attention cases.
- **Performance MIS** groups results by CSE, Location, or Vertical/Segment.
- Date filters use the earliest inward date for each Reference ID.
- **Case Register** shows each case once, with its latest status and case-level derived metrics. Details contains entry and status history.
- **Audit History** shows timestamp, old/new status, stage, authenticated changer, owner, and notes.

PAN is masked in reports. Management Viewer also receives masked PAN in the register.

## Common validation messages

| Message | What to do |
| --- | --- |
| Reference ID is required for related entries | Select the existing case or enter its generated Reference ID |
| Create the original case first | Save a `New` entry, then use its generated Reference ID for the related entry |
| PAN format invalid | Use five letters, four digits, and one letter, for example `ABCDE1234F` |
| Query/event details required | Explain the query, discrepancy, or return |
| Closed case requires account details | Enter account number and opening date |
| Physical/Digital submission mismatch | Match the selected status to the case channel |
| CSE users can only update their own cases | Confirm the case's CSE Name matches your display name |
| MOFSL users can only update Stage 5 cases | Operations must first move the case to Stage 5 |

## Business dates, case details, and SLA

Date fields follow the stage derived from Latest status. Stage 2 dispatch dates also follow the Physical/Digital channel; the form-return date appears for Physical cases. Inward date and Status business date remain available in every stage. When editing or adding activity to an existing case, select Show all process dates to inspect or correct dates from other stages. The checkbox is hidden for new cases. Switching stage or hiding a date does not clear its value. Exception statuses show the common dates unless Show all process dates is selected. Dates are optional unless required by the selected status; they are not automatically filled by switching stages.

Status business date records when the selected status happened, independently of the audit recording time. Discrepancy type and Stage 4 review outcome have controlled dropdown values.

Touch Count is automatic: each successful new entry or edit counts once, including unchanged-status edits. Viewing and rejected saves do not count. Old records show a minimum baseline from saved entries.

Choose Details in Case Register to open a right sidebar showing dates, touches, original inward, resubmissions, overall and stage timing, SLA, and query attribution. Close it with Close details, Escape, or a click outside the sidebar. Skipped stages show Not observed. Admin can configure SLA Settings; all thresholds use gross working days and default to seven.
