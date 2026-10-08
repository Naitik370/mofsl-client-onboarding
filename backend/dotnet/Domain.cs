using System.Globalization;
using System.Text.RegularExpressions;

namespace Onboarding;

public record Status(string Name, string Stage, string? Start = null, string? End = null, bool Closed = false, bool Exception = false);
public record User(long Id, string Username, string DisplayName, string Role);

public static class Domain
{
    public static readonly string[] Roles = ["admin", "operations", "cse", "mofsl", "viewer"];
    public static readonly string[] EntryTypes = ["New", "Resubmission", "Discrepancy Resolution", "Modification"];
    public static readonly string[] AccountTypes = ["Individual", "HUF", "Corporate", "NRI", "Minor"];
    public static readonly string[] Channels = ["Physical", "Digital"];
    public static readonly string[] Owners = ["Operations", "CSE", "MOFSL"];
    public static readonly string[] Closed = ["Account Opened", "Communication Sent - Case Closed"];
    public static readonly string[] Excluded = ["Rejected", "Cancelled by Client"];
    public static readonly string[] CseStatuses = ["Request Received from CSE", "Under Review by Operations", "Resubmitted by CSE", "Discrepancy Resolution Received", "Resubmitted Form Received - Under Review"];
    public static readonly string[] MofslStatuses = ["Query Raised by MOFSL", "Query Resolved - Resubmitted to MOFSL", "Account Opened", "Communication Sent - Case Closed"];
    public static readonly Status[] Statuses = [
        new("Request Received from CSE", "Stage 1"), new("Under Review by Operations", "Stage 1"),
        new("Query Raised to CSE - Missing Information", "Stage 1", "stage1"), new("Resubmitted by CSE", "Stage 1", End: "stage1"),
        new("Application Form Under Preparation", "Stage 2"), new("Physical Form Submitted to CSE", "Stage 2"), new("Digital Form Sent to Client", "Stage 2"),
        new("Signed Form Received from CSE", "Stage 3"), new("Under Review - Signed Form", "Stage 3"),
        new("Discrepancy Raised to CSE", "Stage 3", "stage3"), new("Form Returned to CSE", "Stage 3", "stage3"),
        new("Discrepancy Resolution Received", "Stage 4", End: "stage3"), new("Resubmitted Form Received - Under Review", "Stage 4", End: "stage3"),
        new("Form Found in Order - Ready for MOFSL Submission", "Stage 4"), new("Submitted to MOFSL", "Stage 5"),
        new("Query Raised by MOFSL", "Stage 5", "stage5"), new("Query Resolved - Resubmitted to MOFSL", "Stage 5", End: "stage5"),
        new("Account Opened", "Stage 6", Closed: true), new("Communication Sent - Case Closed", "Stage 6", Closed: true),
        new("On Hold", "Exception", Exception: true), new("Rejected", "Exception", Exception: true), new("Cancelled by Client", "Exception", Exception: true)
    ];
    public static readonly (string, string)[] Holidays = [
        ("2026-01-26", "Republic Day"), ("2026-03-04", "Holi"), ("2026-03-21", "Eid al-Fitr"), ("2026-04-03", "Good Friday"),
        ("2026-04-14", "Ambedkar Jayanti"), ("2026-05-01", "Maharashtra Day"), ("2026-05-27", "Eid al-Adha"),
        ("2026-08-15", "Independence Day"), ("2026-08-26", "Milad-un-Nabi"), ("2026-10-02", "Gandhi Jayanti"),
        ("2026-10-20", "Dussehra"), ("2026-11-08", "Diwali"), ("2026-12-25", "Christmas")
    ];
    public static readonly (string, string, string, string)[] DemoUsers = [
        ("admin", "System Administrator", "admin", "AdminDemo@123"), ("operations", "Operations Demo", "operations", "OpsDemo@123"),
        ("cse", "CSE Demo", "cse", "CseDemo@123"), ("mofsl", "MOFSL Demo", "mofsl", "MofslDemo@123"), ("viewer", "Management Viewer", "viewer", "ViewDemo@123")
    ];
    public static readonly string[] DateFields = ["inwardDate", "outwardDate", "resubmissionDate", "signedFormDate", "submittedDate", "accountOpeningDate"];
    public static readonly Dictionary<string, string> AutoDates = new()
    {
        ["Request Received from CSE"] = "inwardDate",
        ["Physical Form Submitted to CSE"] = "outwardDate",
        ["Digital Form Sent to Client"] = "outwardDate",
        ["Resubmitted by CSE"] = "resubmissionDate",
        ["Discrepancy Resolution Received"] = "resubmissionDate",
        ["Resubmitted Form Received - Under Review"] = "resubmissionDate",
        ["Signed Form Received from CSE"] = "signedFormDate",
        ["Submitted to MOFSL"] = "submittedDate",
        ["Account Opened"] = "accountOpeningDate"
    };
    public static readonly Dictionary<string, string> ProcessDateFields = new()
    {
        ["Query Raised to CSE - Missing Information"] = "stage1QueryRaisedDate",
        ["Resubmitted by CSE"] = "stage1ResubmissionDate",
        ["Application Form Under Preparation"] = "formPreparedDate",
        ["Physical Form Submitted to CSE"] = "physicalFormSubmittedDate",
        ["Digital Form Sent to Client"] = "digitalFormSentDate",
        ["Signed Form Received from CSE"] = "signedFormReceivedDate",
        ["Discrepancy Raised to CSE"] = "discrepancyRaisedDate",
        ["Form Returned to CSE"] = "formReturnedToCseDate",
        ["Discrepancy Resolution Received"] = "discrepancyResolutionReceivedDate",
        ["Resubmitted Form Received - Under Review"] = "resubmittedFormReceivedDate",
        ["Submitted to MOFSL"] = "submittedToMofslDate",
        ["Query Raised by MOFSL"] = "mofslQueryRaisedDate",
        ["Query Resolved - Resubmitted to MOFSL"] = "mofslQueryResolvedDate",
        ["Account Opened"] = "accountOpeningDate",
        ["Communication Sent - Case Closed"] = "communicationSentDate"
    };
    public static string Text(this IDictionary<string, object?> row, string key) => row.TryGetValue(key, out var value) ? Convert.ToString(value, CultureInfo.InvariantCulture) ?? "" : "";
    public static long Number(this IDictionary<string, object?> row, string key) => Convert.ToInt64(row[key], CultureInfo.InvariantCulture);
    public static DateOnly? Date(string value) => DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ? date : null;
    public static string MaskPan(string pan) => pan.Length >= 5 ? $"{pan[..2]}*****{pan[^3..]}" : "*****";
    public static bool ValidPan(string pan) => Regex.IsMatch(pan, "^[A-Z]{5}[0-9]{4}[A-Z]$");

    public static Dictionary<string, object?> Normalize(Dictionary<string, object?> payload, string now, bool auto)
    {
        var result = payload.ToDictionary(x => x.Key, x => x.Value is string s ? s.Trim() : x.Value);
        result["pan"] = result.Text("pan").ToUpperInvariant();
        foreach (var field in DateFields.Concat(EntryFields.Dates.Keys))
            if (DateOnly.TryParseExact(result.Text(field), "dd-MM-yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                result[field] = date.ToString("yyyy-MM-dd");
        if (auto && AutoDates.TryGetValue(result.Text("status"), out var target) && result.Text(target) == "")
            result[target] = now[..10];
        if (auto && ProcessDateFields.TryGetValue(result.Text("status"), out var processField) && result.Text(processField) == "")
            result[processField] = now[..10];
        result.Remove("autoCaptureDates");
        if (result.Text("queryDetails") == "")
        {
            if (result.Text("status") == "Query Raised to CSE - Missing Information")
                result["queryDetails"] = result.Text("stage1QueryDetails");
            if (result.Text("status") == "Query Raised by MOFSL")
                result["queryDetails"] = result.Text("mofslQueryType");
        }
        return result;
    }

    public static int WorkingDays(DateOnly? start, DateOnly? end, HashSet<string> holidays)
    {
        if (start is null || end is null || end <= start)
            return 0;
        var count = 0;
        for (var day = start.Value.AddDays(1); day <= end; day = day.AddDays(1))
            if (day.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday && !holidays.Contains(day.ToString("yyyy-MM-dd")))
                count++;
        return count;
    }

    public static (int Hold, int Queries) HoldAndQueries(IEnumerable<Dictionary<string, object?>> events, DateOnly today, HashSet<string> holidays)
    {
        var starts = new Dictionary<string, Queue<DateOnly>>();
        var hold = 0;
        var queries = 0;
        foreach (var e in events)
        {
            var day = Date(e.Text("businessDate")) ?? Date(e.Text("timestamp")[..10])!.Value;
            var start = e.Text("queryStart");
            var end = e.Text("queryEnd");
            if (start != "")
            {
                if (!starts.ContainsKey(start))
                    starts[start] = new();
                starts[start].Enqueue(day);
                queries++;
            }
            if (end != "" && starts.TryGetValue(end, out var queue) && queue.Count > 0)
                hold += WorkingDays(queue.Dequeue(), day, holidays);
        }
        return (hold + starts.Values.SelectMany(x => x).Sum(day => WorkingDays(day, today, holidays)), queries);
    }
}
