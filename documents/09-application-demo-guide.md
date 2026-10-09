# MOFSL Client Onboarding demo guide

Use this guide as your presenter notes. Allow about 25 minutes for the full walkthrough. All client names, PANs, account numbers, and request IDs below are fictional demo values.

## 1. Opening explanation

Say:

> "This application tracks a client onboarding case from the CSE's request through Operations review, form preparation, MOFSL processing, account opening, and final communication. Each case has one Reference ID. Later submissions stay under that ID, while the application maintains the history and calculates MIS."

Explain the difference before opening the form:

| Term           | What to say                                                             | Example                                                      |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| Case           | One client's onboarding journey, identified by a generated Reference ID | One case can have several related entries                    |
| Entry          | A saved submission or update belonging to that case                     | A CSE resubmission adds an entry under the same Reference ID |
| Stage          | The broad processing phase                                              | Stage 3 is signed-form review                                |
| Latest status  | The current saved business position                                     | `Discrepancy Raised to CSE` within Stage 3                   |
| Status history | The record of status changes, who made them, and when                   | Query raised, response received, then review completed       |

> "The register shows one row per case with its latest status. The details drawer shows the entries and status history behind that row."

## 2. Before the demo

1. Open the application at `http://127.0.0.1:4173/`. If it is stopped, run `npm start` from the project folder.
2. Use the local demo accounts below, or your configured accounts with equivalent roles. Local demo passwords are listed in [README.md](../README.md#demo-logins).
3. Use a desktop browser and keep this guide open alongside the application.
4. Prepare **Case A** before the presentation using section 7. Create **Case B** live using sections 3 through 6.
5. Keep each generated Reference ID in the notes below. Search by that ID when changing roles.
6. For these historical examples, enter the dates exactly as listed. Do not leave the New-entry inward date at today's default. Set **Status business date** at every step so the business timeline remains separate from today's audit timestamps.
7. Keep **Current Stage override** blank. For Admin, leave **Auto-capture related date** off. Use the dates in this guide instead.
8. In MIS Overview, set **Inward from** to `14-09-2026` and **Inward to** to `25-09-2026`, then select **Apply**. These filters use original inward dates, not account-opening dates. Existing cases in this range may also appear.

| Username     | Role to demonstrate | Use during the demo                                               |
| ------------ | ------------------- | ----------------------------------------------------------------- |
| `cse`        | CSE                 | New request and replies to Operations queries                     |
| `operations` | Operations          | Review, form processing, discrepancies, and submission to MOFSL   |
| `mofsl`      | MOFSL               | MOFSL query, query resolution, account opening, and communication |
| `viewer`     | Management Viewer   | Read-only register, audit, and MIS                                |
| `admin`      | Admin               | Optional user administration and SLA Settings                     |

When using the seeded CSE account, the case's **CSE name** must be `CSE Demo`. It is filled automatically on CSE submissions. If you use another CSE account, use its actual display name.

```text
Case A Reference ID: ____________________________________
Case B Reference ID: ____________________________________
```

### How to make each update

- As **Operations**, open **Case Register**, find the Reference ID, and select **Edit**. This updates the latest entry and records any status change in history.
- As **CSE** or **MOFSL**, find the case and select **Add update**. This copies its current data and creates a related entry when saved.
- After each save, return to the register and reopen the case for the next step. Keep copied client details and earlier dates.
- Enable **Show all process dates** when the next stage's fields are hidden. This lets you enter the next process date while retaining the current status until Save.
- For an **automatic** step, leave Latest status at its current value and keep **Update status from newly entered process dates and review outcome** checked.
- For a **manual** step, select the specified Latest status. That selection turns automatic status updating off for that save.
- Replace **Query / event details** with the note for the current event. This keeps an old query description from being reused for a later query.

Say:

> "Opening the form shows the current status. Entering the next completed action can change the status when I save. Queries, review decisions, and exceptions are selected explicitly."

## 3. Sample data for the two cases

Enter these values in the New form. Leave Reference ID blank; it is generated on Save.

| Field                              | Case A: clean digital case                   | Case B: physical case with queries                                                             |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Request ID                         | `DEMO-RFT-001`                               | `DEMO-NRFT-001`                                                                                |
| Entry type                         | `New`                                        | `New`                                                                                          |
| Client name                        | `Aarav Mehta - Demo RFT`                     | `Priya Shah - Demo NRFT`                                                                       |
| PAN No                             | `ABCDE1234F`                                 | `PQRST5678L`                                                                                   |
| Account type                       | `Individual`                                 | `Individual`                                                                                   |
| Channel                            | `Digital`                                    | `Physical`                                                                                     |
| Location                           | `Mumbai`                                     | `Delhi`                                                                                        |
| Vertical / Segment                 | `Retail`                                     | `HNI`                                                                                          |
| RM name                            | `Rohan Demo`                                 | `Neha Demo`                                                                                    |
| CSE name                           | `CSE Demo`                                   | `CSE Demo`                                                                                     |
| Processor name                     | `Operations Demo`                            | `Operations Demo`                                                                              |
| Current owner                      | `Operations`                                 | `Operations`                                                                                   |
| Inward date                        | `21-09-2026`                                 | `14-09-2026`                                                                                   |
| Status business date               | `21-09-2026`                                 | `14-09-2026`                                                                                   |
| Latest status before Save          | `Request Received from CSE`                  | `Request Received from CSE`                                                                    |
| Remarks                            | `Demo: complete digital onboarding request.` | `Demo: physical onboarding with missing information, signature correction, and a MOFSL query.` |
| Account number, entered at Stage 6 | `DEMO-AC-1001`                               | `DEMO-AC-1002`                                                                                 |

Use a fresh Request ID if rehearsing another run, and note the newly generated Reference ID.

## 4. Main live walkthrough: Case B

### Stage 1: request, review, query, and resubmission

**Step 1. CSE creates the request.**

Sign in as `cse`, open **New Entry**, and enter Case B's values from section 3. Select **Save entry**.

Expected result:

- A Reference ID is generated. Copy it into your presenter notes.
- Latest status becomes `Under Review by Operations`, Stage 1.
- The case is assigned to Operations. Query Count is 0 and RFT is `RFT`.

Say:

> "The form displayed Request Received from CSE. Saving the CSE request automatically sends it for Operations review. I did not have to choose the next status."

**Step 2. Operations raises a missing-information query.**

Sign in as `operations`, find Case B, and select **Edit**. Enter:

| Field                            | Value                                                     |
| -------------------------------- | --------------------------------------------------------- |
| Latest status, selected manually | `Query Raised to CSE - Missing Information`               |
| Status business date             | `15-09-2026`                                              |
| Stage 1 query raised date        | `15-09-2026`                                              |
| Stage 1 query details            | `Address proof is missing from the onboarding documents.` |
| Query / event details            | `Address proof is missing. CSE to provide the document.`  |

Save. Expect Stage 1, Query Count **1**, and **NRFT**. Open Details briefly to show the new event and query timing.

Say:

> "A query starts a hold interval and makes the case non-right-first-time. Later resolution closes that interval, but the case remains NRFT because the query occurred."

**Step 3. CSE responds.**

Sign in as `cse`, find Case B, and select **Add update**. The form should show the current missing-information query and select the `Resubmission` entry type. Enter:

| Field                     | Value                                                          |
| ------------------------- | -------------------------------------------------------------- |
| Status business date      | `16-09-2026`                                                   |
| Resubmission date         | `16-09-2026`                                                   |
| Stage 1 resubmission date | `16-09-2026`                                                   |
| Query / event details     | `Address proof received and attached. Stage 1 query answered.` |

Keep the current query status displayed and save. Expect `Resubmitted by CSE`, Stage 1, under the **same Reference ID**. The first hold interval is **1 working day**. The register still has one row for this case; Details now has two entries.

### Stage 2: prepare and send the application form

Sign in as `operations`. Perform these as two separate Edit-and-Save actions. Enable **Show all process dates** where needed.

| Step                                     | Enter                                                                                                                                                                                               | Expected saved status                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 4. Prepare the form, automatic           | Form prepared date `17-09-2026`; Status business date `17-09-2026`; Query / event details `Application form preparation started.`                                                                   | `Application Form Under Preparation`, Stage 2 |
| 5. Dispatch the physical form, automatic | Outward date `17-09-2026`; Physical form submitted to CSE date `17-09-2026`; Status business date `17-09-2026`; Query / event details `Physical application form sent to CSE for client signature.` | `Physical Form Submitted to CSE`, Stage 2     |

Say:

> "These completed process dates drive the saved status. The channel determines whether we use the physical form-to-CSE route or the digital form-to-client route. Case B is physical."

### Stage 3: receive, review, and identify a discrepancy

Continue as `operations`, reopening **Edit** after each save.

| Step                                | Enter                                                                                                                                                                                                                                                                         | Expected saved status                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 6. Receive signed form, automatic   | Signed form received date `18-09-2026`; Status business date `18-09-2026`; Query / event details `Signed physical form received from CSE.`                                                                                                                                    | `Signed Form Received from CSE`, Stage 3 |
| 7. Start signed-form review, manual | Select `Under Review - Signed Form`; Status business date `18-09-2026`; Query / event details `Operations reviewing signatures and documents.`                                                                                                                                | `Under Review - Signed Form`, Stage 3    |
| 8. Raise discrepancy, manual        | Select `Discrepancy Raised to CSE`; Discrepancy type `Signature Mismatch`; Discrepancy raised date `18-09-2026`; Status business date `18-09-2026`; Query / event details `Client signature on the form differs from the submitted specimen. Corrected signed page required.` | `Discrepancy Raised to CSE`, Stage 3     |

After step 8, Query Count is **2**. Explain that this is a new query interval for the signed form, separate from the earlier missing-information query.

For this demonstration, use `Discrepancy Raised to CSE` only. `Form Returned to CSE` is an alternative query-start status; selecting both would create two qualifying query events.

### Stage 4: receive the correction and confirm readiness

**Step 9. CSE supplies the corrected signature.**

Sign in as `cse`, select **Add update** for Case B, and enable **Show all process dates**. The form displays the current discrepancy and selects the `Discrepancy Resolution` entry type. Enter:

| Field                                | Value                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| Status business date                 | `21-09-2026`                                                                      |
| Resubmission date                    | `21-09-2026`                                                                      |
| Discrepancy resolution received date | `21-09-2026`                                                                      |
| Query / event details                | `Corrected signed page received from the client. Signature discrepancy answered.` |

Save without changing the displayed discrepancy status. Expect `Discrepancy Resolution Received`, Stage 4. The Stage 3 hold is **1 working day**, since Saturday and Sunday are excluded.

Sign in as `operations` and perform these separate edits:

| Step                                             | Enter                                                                                                                                                                      | Expected saved status                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 10. Receive corrected form for review, automatic | Resubmitted form received date `21-09-2026`; Status business date `21-09-2026`; Query / event details `Corrected form received for final Operations review.`               | `Resubmitted Form Received - Under Review`, Stage 4         |
| 11. Confirm readiness, automatic                 | Stage 4 review outcome `Found in Order`; Status business date `22-09-2026`; Query / event details `Corrected form checked and found in order. Ready for MOFSL submission.` | `Form Found in Order - Ready for MOFSL Submission`, Stage 4 |

Keep automatic status updating checked for step 11 and leave the current dropdown value unchanged. The new review outcome triggers readiness on Save. NRFT remains unchanged.

Say:

> "Receiving a correction is different from approving it. Stage 4 records the response, the corrected-form review, and the final decision that the form is ready for MOFSL."

### Stage 5: submit to MOFSL and resolve its query

**Step 12. Operations submits the case.**

As `operations`, Edit Case B, enable **Show all process dates**, and enter:

- Submitted to MOFSL date: `23-09-2026`.
- Status business date: `23-09-2026`.
- Current owner: `MOFSL`.
- Query / event details: `Verified onboarding application submitted to MOFSL.`

Leave automatic status updating checked and save. Expect `Submitted to MOFSL`, Stage 5. The case is now available for MOFSL updates.

Sign in as `mofsl`. Use **Add update** separately for each step below:

| Step                                   | Enter                                                                                                                                                                                                                                                  | Expected saved status                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 13. Raise MOFSL query, manual          | Select `Query Raised by MOFSL`; MOFSL query raised date `23-09-2026`; Status business date `23-09-2026`; MOFSL query type `Bank Proof Clarification`; Query / event details `MOFSL requests a clearer cancelled-cheque image to confirm bank details.` | `Query Raised by MOFSL`, Stage 5; Query Count becomes **3** |
| 14. Record query resolution, automatic | MOFSL query resolved date `24-09-2026`; Status business date `24-09-2026`; Query / event details `Clear cancelled-cheque image provided. Response resubmitted to MOFSL.`                                                                               | `Query Resolved - Resubmitted to MOFSL`, Stage 5            |

For step 14, keep the current query status selected and automatic status updating checked. This query closes through its resolution date, rather than the CSE missing-information response rule.

Say:

> "The system separates Operations-side queries from MOFSL queries. This case now has two CSE-side queries and one MOFSL query. Each resolved interval contributes to total hold days."

### Stage 6: open the account and send communication

Continue as `mofsl`. Select **Add update**, enable **Show all process dates**, and enter:

| Step                               | Enter                                                                                                                                                                       | Expected saved status                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 15. Account opening, automatic     | Account number `DEMO-AC-1002`; Account opening date `29-09-2026`; Status business date `29-09-2026`; Query / event details `MOFSL account opened. Account number received.` | `Account Opened`, Stage 6                   |
| 16. Final communication, automatic | Communication sent date `29-09-2026`; Status business date `29-09-2026`; Query / event details `Account-opening confirmation and account details sent to the client.`       | `Communication Sent - Case Closed`, Stage 6 |

For step 16, add another update and preserve the account number and opening date. Keep automatic status updating checked.

Say:

> "Account Opened already counts as closed for MIS and stops account-opening TAT. The final status records that communication has also been sent. Closing the case does not erase its queries or NRFT history."

## 5. Expected results for Case B

Open its register row or **Details** and use this checklist. Values assume the exact dates above, the seeded Holiday Master, and an overall SLA of 7 working days.

| Metric               | Expected value                                                         | Explanation                                              |
| -------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Latest status        | `Communication Sent - Case Closed`                                     | Final communication recorded                             |
| Current Stage        | Stage 6                                                                | Account opening and communication                        |
| Original Inward Date | `14-09-2026`                                                           | Earliest receipt under this Reference ID                 |
| RFT Status           | NRFT                                                                   | Queries occurred during the journey                      |
| Query Count          | 3                                                                      | One query each in Stages 1, 3, and 5                     |
| CSE-side queries     | 2                                                                      | Stage 1 plus Stage 3                                     |
| MOFSL queries        | 1                                                                      | Stage 5                                                  |
| Query Hold Days      | 3 working days                                                         | 15 Sep to 16 Sep, 18 Sep to 21 Sep, and 23 Sep to 24 Sep |
| Gross TAT            | 11 working days                                                        | 14 Sep to 29 Sep                                         |
| Net TAT              | 8 working days                                                         | 11 gross minus 3 query hold days                         |
| Current Aging        | 0                                                                      | The case is closed                                       |
| Overall SLA breach   | Yes                                                                    | Gross TAT of 11 exceeds the default 7                    |
| Stage TAT            | Stage 1: 3; Stage 2: 1; Stage 3: 1; Stage 4: 2; Stage 5: 4; Stage 6: 0 | Gross working-day intervals within each stage            |
| Stage SLA breach     | No, with all stage limits at 7                                         | Each individual stage is within its limit                |

Working-day intervals exclude the start date and include eligible weekdays through the end date. Weekends and Holiday Master dates are excluded.

If every step is saved once using the stated roles and actions, this case has **7 entries**, **Resubmission Count 6**, and **Touch Count 16**. Resubmission Count is the number of related entries, not just replies to missing-information queries. Edits add touches without adding entries. Rehearsal saves will change these counts.

## 6. Show the register, history, and MIS

Sign in as `operations` or `viewer`.

1. **Case Register:** find Case B. Point out the single row, final status, stage, NRFT, queries, and TAT. The same case is not repeated for every entry.
2. **Details:** show the entry history and status history. Explain that entry history shows submissions, while status history preserves transitions, including those made by editing an entry.
3. **Audit History:** show the CSE, Operations, and MOFSL actions. Distinguish the historical business date from the audit timestamp recorded during the demo. Do not expect a separate saved `Request Received from CSE` event for a New CSE submission; its initial saved status is `Under Review by Operations`.
4. **MIS Overview:** show open/closed counts, RFT/NRFT, average TAT, SLA breaches, the stage pipeline, and exception counts. Use the date range from section 2.
5. **Performance MIS:** switch between CSE, Location, and Vertical/Segment. Case A and Case B use different locations and segments so their outcomes can be compared.
6. **Viewer:** show that management has read-only access and PAN is masked. If time allows, copy a Details link to demonstrate a case-specific URL and refresh it.

Say:

> "The reports calculate at case level, so multiple entries do not inflate the case count. We can see where a case is, whether it was right first time, how long processing took, and whether it exceeded SLA."

If the filtered report contains **only these two completed sample cases**, expect Total **2**, Closed **2**, Open **0**, RFT **1**, NRFT **1**, RFT **50%**, Average Gross TAT **7.5**, Average Net TAT **6**, and Overall SLA Breaches **1**. Use individual case Details for these comparisons when other cases are present.

## 7. Case A: clean digital RFT comparison

Prepare this case before the presentation, or use it as a shorter alternative walkthrough. Create it as `cse` using Case A's values in section 3. It saves as `Under Review by Operations`.

Follow the sequence below. For Operations edits, manually select the specified status and enter its dates. This is the manual-status route; Case B demonstrates date-driven automation. Enable **Show all process dates** where needed. Keep the same Reference ID and add a brief event note at every save.

| Role and action   | Latest status to select                            | Dates and other values                                                                    |
| ----------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Operations: Edit  | `Application Form Under Preparation`               | Form prepared date and Status business date `22-09-2026`                                  |
| Operations: Edit  | `Digital Form Sent to Client`                      | Outward date, Digital form sent to client date, and Status business date `22-09-2026`     |
| Operations: Edit  | `Signed Form Received from CSE`                    | Signed form received date and Status business date `23-09-2026`                           |
| Operations: Edit  | `Under Review - Signed Form`                       | Status business date `23-09-2026`                                                         |
| Operations: Edit  | `Form Found in Order - Ready for MOFSL Submission` | Stage 4 review outcome `Found in Order`; Status business date `24-09-2026`                |
| Operations: Edit  | `Submitted to MOFSL`                               | Submitted to MOFSL date and Status business date `24-09-2026`; Current owner `MOFSL`      |
| MOFSL: Add update | `Account Opened`                                   | Account number `DEMO-AC-1001`; Account opening date and Status business date `25-09-2026` |
| MOFSL: Add update | `Communication Sent - Case Closed`                 | Communication sent date and Status business date `25-09-2026`; preserve account details   |

Do not raise any query or discrepancy for Case A. Stage 4 readiness can be recorded even when no correction was required.

| Final comparison             | Case A                           | Case B                           |
| ---------------------------- | -------------------------------- | -------------------------------- |
| Channel                      | Digital                          | Physical                         |
| RFT Status                   | RFT                              | NRFT                             |
| Query Count                  | 0                                | 3                                |
| Query Hold Days              | 0                                | 3                                |
| Gross TAT                    | 4 working days                   | 11 working days                  |
| Net TAT                      | 4 working days                   | 8 working days                   |
| Overall SLA breach at 7 days | No                               | Yes                              |
| Latest status                | Communication Sent - Case Closed | Communication Sent - Case Closed |

Say:

> "Both cases are successfully closed. The clean case needed no queries, so gross and net TAT are equal. The second case remains NRFT, and its net TAT removes the recorded query hold intervals."

## 8. Status master cheat sheet

The dropdown groups these 22 statuses by stage. Status names below match the application. "Automatic" means the stated condition is supplied and saved; a form does not advance just because it was opened.

| Stage     | Status                                           | How to demonstrate it                                                                    |
| --------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Stage 1   | Request Received from CSE                        | Current status displayed on a New CSE form before Save                                   |
| Stage 1   | Under Review by Operations                       | Automatic on saving a New CSE request; Operations can also select it                     |
| Stage 1   | Query Raised to CSE - Missing Information        | Manual query decision; enter details and business/query date                             |
| Stage 1   | Resubmitted by CSE                               | Automatic when CSE saves a response to the current missing-information query             |
| Stage 2   | Application Form Under Preparation               | Automatic from a newly entered Form prepared date                                        |
| Stage 2   | Physical Form Submitted to CSE                   | Automatic from physical dispatch/outward date; Physical channel                          |
| Stage 2   | Digital Form Sent to Client                      | Automatic from digital dispatch/outward date; Digital channel                            |
| Stage 3   | Signed Form Received from CSE                    | Automatic from a newly entered Signed form received date                                 |
| Stage 3   | Under Review - Signed Form                       | Manual review-start decision                                                             |
| Stage 3   | Discrepancy Raised to CSE                        | Manual discrepancy decision; enter details                                               |
| Stage 3   | Form Returned to CSE                             | Manual return decision; enter details                                                    |
| Stage 4   | Discrepancy Resolution Received                  | Automatic CSE response to a discrepancy/return, or a new resolution receipt date         |
| Stage 4   | Resubmitted Form Received - Under Review         | Automatic from a newly entered Resubmitted form received date                            |
| Stage 4   | Form Found in Order - Ready for MOFSL Submission | Automatic from a new `Found in Order` outcome while in Stage 4; also selectable manually |
| Stage 5   | Submitted to MOFSL                               | Automatic from a newly entered Submitted to MOFSL date                                   |
| Stage 5   | Query Raised by MOFSL                            | Manual query decision; enter details                                                     |
| Stage 5   | Query Resolved - Resubmitted to MOFSL            | Automatic from a newly entered MOFSL query resolved date                                 |
| Stage 6   | Account Opened                                   | Automatic from opening date with account number                                          |
| Stage 6   | Communication Sent - Case Closed                 | Automatic from communication date with account number and opening date                   |
| Exception | On Hold                                          | Manual decision; remains open                                                            |
| Exception | Rejected                                         | Manual decision; excluded from final RFT percentage and average TAT                      |
| Exception | Cancelled by Client                              | Manual decision; same reporting exclusions as Rejected                                   |

Status choices and automatic transitions remain subject to the signed-in role's permissions. CSE users handle their own requests and responses; MOFSL users handle cases that have reached Stage 5/6. Operations handles the broader workflow.

## 9. Optional demonstrations and questions

**Exceptions, one minute.** Use a separate demo case as Operations, rather than altering Case A or B. Select `On Hold` and add the remark `Awaiting client confirmation to proceed.` Explain that it remains open and does not create query hold days by itself. Explain `Rejected` and `Cancelled by Client` from the cheat sheet without changing the completed examples.

**Validation, one minute.** In an unsaved New form, enter PAN `ABC123` and attempt Save. Show the error beside PAN, correct it to `ABCDE1234F`, then Clear or leave the form without saving. This demonstrates field-level feedback without adding a case.

**SLA Settings, one minute.** As Admin, show overall and stage thresholds. Explain that the default is 7 working days and a breach means TAT is greater than the threshold. Keep the configured values unchanged during this sample comparison.

| Likely question                                                | Suggested answer                                                                                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does each resubmission get a new Reference ID?                 | No. New cases receive an ID; related entries reuse it.                                                                                                    |
| Why does an NRFT case stay NRFT after resolution?              | NRFT records that a qualifying query occurred anywhere in the case history.                                                                               |
| Can every status be calculated automatically?                  | Completed actions can follow new dates or outcomes. Queries, review starts, and exceptions require a decision.                                            |
| Are dates filled automatically?                                | New inward date defaults to the server date. Other dates are entered manually; Admin has an optional per-save date-capture control.                       |
| Why is the form still showing the old status?                  | It shows the current status until Save applies the completed action or response.                                                                          |
| Does Touch Count mean query count?                             | No. Each successful entry creation or edit adds a touch. Query Count counts qualifying status events.                                                     |
| Does Resubmission Count mean only missing-information replies? | No. It is the number of saved entries under the Reference ID minus one.                                                                                   |
| What happens to a stage with no recorded activity?             | Its stage TAT is shown as not observed rather than assumed to be zero.                                                                                    |
| Is every stage transition enforced?                            | Roles and field validation are enforced. Operations and Admin can select any master status, so the intended business sequence still needs to be followed. |
| What is the difference between Gross and Net TAT?              | Gross is elapsed working days from original receipt to opening, or today for an open case. Net subtracts recorded query/discrepancy hold days.            |

## 10. Closing statement

> "We have followed one case through all six stages, handled queries without losing its identity, and compared it with a clean case. The register gives us the current position, the history explains how we got there, and MIS calculates case-level quality, timing, and SLA performance."

Before ending, leave **MIS Overview** or the two cases' **Case Register** rows visible.
