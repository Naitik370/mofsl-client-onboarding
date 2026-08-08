---
title: Database and Calculations
tags: [client-onboarding, database, mis]
---

# Database and calculations

## Database tables

| Table | One row represents |
| --- | --- |
| `role_master` | One allowed role |
| `users` | One login identity |
| `sessions` | One server-side authenticated session |
| `cases` | One stable Reference ID and its shared client metadata |
| `case_entries` | One New, Resubmission, Discrepancy Resolution, or Modification row |
| `status_history` | One actual status change |
| `status_master` | One status, stage, query mapping, and classification |
| `location_master` | One allowed location |
| `segment_master` | One allowed segment |
| `holiday_master` | One non-working holiday |
| `settings` | One configuration value, currently `sla_days` |

`cases.reference_id` is unique. Many `case_entries` and `status_history` rows can belong to the same case.

## Latest case selection

For MIS, entries are grouped by `caseId`. The row with the greatest `(updatedAt, id)` is considered current. The earliest valid inward date across the group becomes `originalInwardDate`, and entry count minus one becomes `resubmissionCount`.

Date filters compare the requested period with this original inward date.

## Working-day calculation

`working_days(start, end, holidays)`:

- Returns zero when either date is missing or end is not after start.
- Counts dates after the start through the end.
- Counts Monday through Friday only.
- Excludes dates in `holiday_master`.

## Query count and hold

Query Count is the number of query-start history events, not a user-entered field. Starts and ends are paired by key (`stage1`, `stage3`, or `stage5`) in chronological order. Unmatched starts accumulate through today.

## RFT and NRFT

```text
Query Count = 0  -> RFT
Query Count > 0  -> NRFT
```

Therefore a qualifying query at any point permanently makes the reported case NRFT, even after resolution.

## TAT, aging, and SLA

```text
Gross TAT = working days from original inward date
            to account opening date, or today when not opened

Net TAT   = max(0, Gross TAT - Query Hold Days)

SLA breach = Gross TAT > configured SLA days
```

The configured default is seven working days.

> [!important]
> Current SLA breach uses **gross TAT**, not net TAT. Pipeline `aging` also uses gross TAT and becomes zero only for the two closed statuses.

## Report exclusions

Rejected and Cancelled by Client cases:

- remain in total and exception counts;
- are excluded from overall/group RFT denominators;
- are excluded from average gross and net TAT;
- are excluded from SLA breach totals.

On Hold remains in the normal performance population.

## PAN protection

The report service replaces full PAN with `panMasked`, formatted like `AB*****34F`. Viewer register access also removes full PAN. Operational roles receive full PAN from `/api/cases`, while report responses never include it.

## Process dates

The report's `processDates` object is derived from status-history timestamps. These dates describe when the API recorded a status event. They are separate from manually supplied fields such as `outwardDate`, `resubmissionDate`, or `submittedDate` stored on the entry.

