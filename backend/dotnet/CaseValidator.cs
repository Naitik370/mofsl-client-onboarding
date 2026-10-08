using Microsoft.Data.Sqlite;
using static Onboarding.Database;
using static Onboarding.Domain;

namespace Onboarding;

public static class CaseValidator
{
    public static List<string> Validate(Dictionary<string, object?> payload, SqliteConnection db, long? entryId)
    {
        var errors = new List<string>();
        if (payload.Text("stageOverride") != "" && !Enumerable.Range(1, 6).Select(i => $"Stage {i}").Contains(payload.Text("stageOverride")))
            errors.Add("Current stage override must be Stage 1 to Stage 6");
        foreach (var (field, label) in new[] { ("referenceId", "Reference ID"), ("requestId", "Request ID"), ("clientName", "Client name"), ("pan", "PAN No"), ("inwardDate", "Inward date") })
            if (payload.Text(field) == "")
                errors.Add($"{label} is required");
        foreach (var (field, table, column, label) in new[] { ("status", "status_master", "status_name", "Latest status"), ("location", "location_master", "location_name", "Location"), ("segment", "segment_master", "segment_name", "Segment") })
            if (Lookup(db, table, column, payload.Text(field)) is null)
                errors.Add($"{label} is not in the {label switch { "Latest status" => "Status", _ => label }} Master");
        foreach (var (field, label, allowed) in new[] { ("entryType", "Entry type", EntryTypes), ("accountType", "Account type", AccountTypes), ("channel", "Channel", Channels), ("owner", "Current owner", Owners) })
            if (!allowed.Contains(payload.Text(field)))
                errors.Add($"{label} is invalid");
        if (payload.Text("pan") != "" && !ValidPan(payload.Text("pan")))
            errors.Add("PAN No must use the standard PAN format");
        var labels = new[] { "Inward date", "Outward date", "Resubmission date", "Signed form received date", "Submitted to MOFSL date", "Account opening date" };
        for (var i = 0; i < DateFields.Length; i++)
            if (payload.Text(DateFields[i]) != "" && Date(payload.Text(DateFields[i])) is null)
                errors.Add($"{labels[i]} is invalid");
        var inward = Date(payload.Text("inwardDate"));
        var opened = Date(payload.Text("accountOpeningDate"));
        var status = payload.Text("status");
        var original = entryId is { } id
            ? Query(db, "SELECT MIN(e.inward_date) AS first FROM case_entries e WHERE e.case_id=(SELECT case_id FROM case_entries WHERE id=$0)", id).FirstOrDefault()
            : Query(db, "SELECT MIN(e.inward_date) AS first FROM case_entries e JOIN cases c ON c.id=e.case_id WHERE c.reference_id=$0 COLLATE NOCASE", payload.Text("referenceId")).FirstOrDefault();
        var firstReceipt = Date(original?.Text("first") ?? "") ?? inward;
        if (inward is { } currentInward && firstReceipt is { } existingInward && currentInward < existingInward)
            firstReceipt = currentInward;
        foreach (var field in EntryFields.Dates.Keys)
        {
            var value = payload.Text(field);
            if (value != "" && Date(value) is null)
                errors.Add($"{field} is invalid");
            else if (Date(value) is { } day && firstReceipt is { } first && day < first)
                errors.Add($"{field} cannot precede original inward date");
        }
        if (payload.Text("discrepancyType") != "" && !EntryFields.DiscrepancyTypes.Contains(payload.Text("discrepancyType")))
            errors.Add("Discrepancy type is invalid");
        if (payload.Text("stage4ReviewOutcome") != "" && !EntryFields.ReviewOutcomes.Contains(payload.Text("stage4ReviewOutcome")))
            errors.Add("Stage 4 review outcome is invalid");
        if (payload.Text("stage4ReviewOutcome") == "Still Pending" && status is "Form Found in Order - Ready for MOFSL Submission" or "Submitted to MOFSL")
            errors.Add("A pending Stage 4 review cannot be marked ready or submitted to MOFSL");
        if (payload.Text("physicalFormSubmittedDate") != "" && payload.Text("channel") != "Physical")
            errors.Add("Physical submission date requires the Physical channel");
        if (payload.Text("digitalFormSentDate") != "" && payload.Text("channel") != "Digital")
            errors.Add("Digital submission date requires the Digital channel");
        if (inward is not null && opened is not null && opened < inward)
            errors.Add("Account opening date cannot precede inward date");
        if (Closed.Contains(status) && (payload.Text("accountNumber") == "" || opened is null))
            errors.Add("A closed case requires account number and account opening date");
        if (Statuses.Any(x => x.Name == status && x.Start is not null) && payload.Text("queryDetails") == "")
            errors.Add("Query / event details are required for query or discrepancy statuses");
        if (status == "Physical Form Submitted to CSE" && payload.Text("channel") != "Physical")
            errors.Add("Physical form submission requires the Physical channel");
        if (status == "Digital Form Sent to Client" && payload.Text("channel") != "Digital")
            errors.Add("Digital form submission requires the Digital channel");
        if (entryId is null && payload.Text("entryType") != "New" && Query(db, "SELECT id FROM cases WHERE reference_id=$0 COLLATE NOCASE", payload.Text("referenceId")).Count == 0)
            errors.Add("Create the original case before adding a related entry");
        return errors;
    }

}
