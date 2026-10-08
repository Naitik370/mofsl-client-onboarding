# Database and calculations

SQLite stores role_master, users, sessions, cases, case_entries, status_history, status_master, location_master, segment_master, holiday_master, and settings. sql/schema.sql defines new databases; DatabaseInitializer applies additive migrations to older databases.

cases stores shared identity and automatic Touch Count. case_entries stores operational rows, the generic dates, dedicated stage dates, discrepancy type, Stage 4 review outcome, and separate Stage 1/MOFSL query details. status_history stores each status transition with its actor, recording timestamp, and optional business date.

| Metric | Rule |
| --- | --- |
| Original inward | Earliest inward date under the Reference ID |
| Resubmission count | Operational entry count minus one |
| Touch Count | Successful creates and edits; reads and failed saves excluded |
| Current stage | Latest Status mapped through Status Master |
| Query count | Qualifying Stage 1/3/5 status-change events |
| RFT | Zero qualifying events; any qualifying event produces NRFT |
| Query hold | FIFO matched query/resolution intervals, using business dates when recorded |
| Gross TAT | Original inward to opening for closed cases, otherwise today |
| Net TAT | max(0, gross TAT minus query hold) |
| Open aging | Original inward to today, independently of a prematurely entered opening date |
| Stage TAT | Gross working days between stage changes, accumulated over repeat visits |
| Overall/stage SLA | Gross TAT greater than configured threshold; default 7 working days |

Working days exclude the start date, include the end date, and omit weekends and Holiday Master dates. A skipped stage remains unknown. Stage 6 can run from opening to a recorded communication date. Stage timing uses business-date events and supplied milestone dates; undated historical events fall back to audit dates.

Query attribution separates Stage 1 missing-information queries, Stage 3 discrepancies/returns, and Stage 5 MOFSL queries, plus CSE-side and MOFSL-side totals. CSE-side means the query source classification, not proof of personal fault.

Rejected/cancelled cases leave final RFT percentage and average-TAT denominators but remain exception counts. PAN is masked in reporting. SLA Settings is protected by Admin permissions.

Legacy Touch Count is initialized once from saved entry count as a minimum baseline. Earlier edits cannot be reconstructed. Database migrations preserve old history without inventing business dates.
