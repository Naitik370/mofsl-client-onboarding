using static Onboarding.Domain;

namespace Onboarding;

public static class StatusAutomation
{
    // Only dated, completed actions imply a status. Queries and exceptions require a decision.
    public static readonly (string Field, string Status)[] Actions = [
        ("formPreparedDate", "Application Form Under Preparation"),
        ("outwardDate", "Physical Form Submitted to CSE"),
        ("physicalFormSubmittedDate", "Physical Form Submitted to CSE"),
        ("digitalFormSentDate", "Digital Form Sent to Client"),
        ("signedFormDate", "Signed Form Received from CSE"),
        ("discrepancyResolutionReceivedDate", "Discrepancy Resolution Received"),
        ("resubmittedFormReceivedDate", "Resubmitted Form Received - Under Review"),
        ("submittedDate", "Submitted to MOFSL"),
        ("mofslQueryResolvedDate", "Query Resolved - Resubmitted to MOFSL"),
        ("accountOpeningDate", "Account Opened"),
        ("communicationSentDate", "Communication Sent - Case Closed")
    ];

    public static void Apply(Dictionary<string, object?> payload, Dictionary<string, object?>? previous)
    {
        var status = payload.Text("status");
        // The mandatory CSE query-response routing takes precedence over optional date inference.
        if (status == "Resubmitted by CSE" && previous?.Text("status") == "Query Raised to CSE - Missing Information")
            return;
        if (status == "Discrepancy Resolution Received" && previous?.Text("status") is "Discrepancy Raised to CSE" or "Form Returned to CSE")
            return;
        if (payload.Text("autoStatus").Equals("false", StringComparison.OrdinalIgnoreCase)
            || Statuses.Any(item => item.Name == status && item.Exception)
            || (!payload.Text("autoStatus").Equals("true", StringComparison.OrdinalIgnoreCase) && (previous is not null ? status != previous.Text("status")
                : status is not ("Request Received from CSE" or "Under Review by Operations"))))
            return;

        var previousDate = Date(previous?.Text("statusDate") ?? "");
        var actions = Actions.Where(action => Date(payload.Text(action.Field)) is not null
            && (!Closed.Contains(status) || status == "Account Opened" && action.Status == "Communication Sent - Case Closed")
            && (action.Status is not ("Account Opened" or "Communication Sent - Case Closed")
                || payload.Text("accountNumber") != "" && Date(payload.Text("accountOpeningDate")) is not null)
            && (payload.Text(action.Field) != previous?.Text(action.Field)
                || action.Status == "Account Opened" && payload.Text("accountNumber") != "" && previous?.Text("accountNumber") == ""))
            .Select(action => (Day: Date(payload.Text(action.Field))!.Value,
                Status: action.Field == "outwardDate" && payload.Text("channel") == "Digital"
                    ? "Digital Form Sent to Client" : action.Status))
            .Where(action => previousDate is null || action.Day >= previousDate)
            .OrderBy(action => action.Day)
            .ThenBy(action => Array.FindIndex(Statuses, item => item.Name == action.Status)).ToList();
        if (actions.Count > 0)
        {
            var action = actions[^1];
            payload["status"] = action.Status;
            payload["statusDate"] = action.Day.ToString("yyyy-MM-dd");
        }
        if (payload.Text("stage4ReviewOutcome") == "Found in Order"
            && previous?.Text("stage4ReviewOutcome") != "Found in Order"
            && Statuses.FirstOrDefault(item => item.Name == payload.Text("status"))?.Stage == "Stage 4")
            payload["status"] = "Form Found in Order - Ready for MOFSL Submission";
    }

    public static string DerivedStage(Dictionary<string, object?> row)
    {
        var statusStage = row.Text("statusStage");
        if (statusStage == "Exception")
            return statusStage;
        var stage = statusStage;
        foreach (var (field, status) in Actions.Concat(ProcessDateFields.Select(pair => (pair.Value, pair.Key))))
        {
            var candidate = Statuses.First(item => item.Name == status).Stage;
            if (Date(row.Text(field)) is not null && string.CompareOrdinal(candidate, stage) > 0)
                stage = candidate;
        }
        if (row.Text("stage4ReviewOutcome") != "" && string.CompareOrdinal("Stage 4", stage) > 0)
            stage = "Stage 4";
        return stage;
    }
}
