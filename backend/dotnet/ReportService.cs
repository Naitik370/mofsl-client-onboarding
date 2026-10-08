using Microsoft.Data.Sqlite;
using static Onboarding.Database;
using static Onboarding.Domain;

namespace Onboarding;

public sealed class ReportService(Database database, TimeProvider clock)
{
    private string Now() => clock.GetLocalNow().ToString("yyyy-MM-ddTHH:mm:ss");
    private static double Average(IEnumerable<Dictionary<string, object?>> items, string field)
    {
        var rows = items.ToList();
        return rows.Count == 0 ? 0 : Math.Round(rows.Average(x => Convert.ToDouble(x[field])), 1, MidpointRounding.ToEven);
    }
    private static double Percent(int count, int total) => total == 0 ? 0 : Math.Round(count * 100.0 / total, 1, MidpointRounding.ToEven);
    private static bool Eligible(Dictionary<string, object?> row) => !Excluded.Contains(row.Text("status"));
    private static bool IsOpen(Dictionary<string, object?> row) => !Closed.Contains(row.Text("status")) && Eligible(row);
    private static double? AverageStage(IEnumerable<Dictionary<string, object?>> cases, string stage)
    {
        var values = cases.Select(row => ((Dictionary<string, int?>)row["stageTat"]!).GetValueOrDefault(stage)).Where(value => value.HasValue).ToArray();
        return values.Length == 0 ? null : Math.Round(values.Average(value => value!.Value), 1);
    }
    public object Report(string start, string end, string dimension, User user)
    {
        if (!new[] { "cseName", "location", "segment" }.Contains(dimension))
            dimension = "cseName";
        var today = DateOnly.FromDateTime(clock.GetLocalNow().DateTime);
        using var db = database.Open();
        using var transaction = db.BeginTransaction(deferred: true);
        var holidays = Query(db, "SELECT holiday_date FROM holiday_master").Select(x => x.Text("holiday_date")).ToHashSet();
        var sla = int.Parse(Query(db, "SELECT setting_value FROM settings WHERE setting_key='sla_days'")[0].Text("setting_value"));
        var stageSlas = Enumerable.Range(1, 6).ToDictionary(i => $"Stage {i}", i =>
            int.TryParse(Query(db, "SELECT setting_value FROM settings WHERE setting_key=$0", $"sla_stage{i}_days").FirstOrDefault()?.Text("setting_value"), out var days) ? days : sla);
        var latest = LatestCases(db, start, end);
        var cases = CaseAccessPolicy.Visible(latest, user);
        foreach (var row in cases)
            AddMetrics(db, row, today, holidays, sla, stageSlas);
        transaction.Commit();
        var normal = cases.Where(Eligible).ToList();
        var rft = normal.Count(x => x.Text("rft") == "RFT");
        return new
        {
            generatedAt = Now(),
            slaDays = sla,
            stageSlaDays = stageSlas,
            summary = new
            {
                total = cases.Count,
                open = cases.Count(IsOpen),
                closed = cases.Count(x => Closed.Contains(x.Text("status"))),
                rft,
                nrft = normal.Count - rft,
                rftPercent = Percent(rft, normal.Count),
                nrftPercent = Percent(normal.Count - rft, normal.Count),
                averageGrossTat = Average(normal, "grossTat"),
                averageNetTat = Average(normal, "netTat"),
                slaBreaches = normal.Count(x => (bool)x["slaBreach"]!),
                onHold = cases.Count(x => x.Text("status") == "On Hold"),
                rejected = cases.Count(x => x.Text("status") == "Rejected"),
                cancelled = cases.Count(x => x.Text("status") == "Cancelled by Client")
                ,
                stage1Queries = cases.Sum(x => x.Number("stage1Queries"))
                ,
                stage3Queries = cases.Sum(x => x.Number("stage3Queries"))
                ,
                stage5Queries = cases.Sum(x => x.Number("stage5Queries"))
                ,
                cseQueries = cases.Sum(x => x.Number("cseQueries"))
                ,
                mofslQueries = cases.Sum(x => x.Number("mofslQueries"))
                ,
                stageSlaBreaches = normal.Count(x => (bool)x["stageSlaBreach"]!)
            },
            pipeline = Enumerable.Range(1, 6)
                .Select(x => $"Stage {x}")
                .Append("Exception")
                .Select(stage => new
                {
                    stage,
                    count = cases.Count(x => x.Text("stage") == stage),
                    averageAging = Average(cases.Where(x => x.Text("stage") == stage), "aging"),
                    averageStageTat = AverageStage(cases.Where(x => x.Text("stage") == stage), stage)
                }),
            groups = cases.GroupBy(x => x.Text(dimension) == "" ? "Unassigned" : x.Text(dimension)).OrderBy(x => x.Key, StringComparer.Ordinal).Select(group =>
            {
                var eligible = group.Where(Eligible).ToList();
                var count = eligible.Count(x => x.Text("rft") == "RFT");
                return new
                {
                    name = group.Key,
                    total = group.Count(),
                    open = group.Count(IsOpen),
                    closed = group.Count(x => Closed.Contains(x.Text("status"))),
                    rft = count,
                    nrft = eligible.Count - count,
                    rftPercent = Percent(count, eligible.Count),
                    averageNetTat = Average(eligible, "netTat"),
                    slaBreaches = eligible.Count(x => (bool)x["slaBreach"]!),
                    exceptions = group.Count(x => !Eligible(x)),
                    stage1Queries = group.Sum(x => x.Number("stage1Queries")),
                    stage3Queries = group.Sum(x => x.Number("stage3Queries")),
                    stage5Queries = group.Sum(x => x.Number("stage5Queries")),
                    cseQueries = group.Sum(x => x.Number("cseQueries")),
                    mofslQueries = group.Sum(x => x.Number("mofslQueries")),
                    stageSlaBreaches = eligible.Count(x => (bool)x["stageSlaBreach"]!)
                };
            }),
            cases
        };
    }

    private static List<Dictionary<string, object?>> LatestCases(SqliteConnection db, string start, string end)
    {
        var latest = new List<Dictionary<string, object?>>();
        foreach (var group in CaseQueries.CaseRows(db).GroupBy(x => x.Number("caseId")))
        {
            var original = group.Select(x => Date(x.Text("inwardDate"))).Where(x => x.HasValue).Min();
            if (Date(start) is { } from && original < from || Date(end) is { } to && original > to)
                continue;
            var current = group.First();
            current["originalInwardDate"] = original?.ToString("yyyy-MM-dd") ?? "";
            current["resubmissionCount"] = group.Count() - 1;
            var suppliedDates = new Dictionary<string, string>();
            foreach (var entry in group.Reverse())
            {
                foreach (var field in EntryFields.Dates.Keys)
                    if (entry.Text(field) != "" && field != "statusDate")
                        suppliedDates[field] = entry.Text(field);
                foreach (var (source, target) in new[] { ("signedFormDate", "signedFormReceivedDate"), ("submittedDate", "submittedToMofslDate"), ("accountOpeningDate", "accountOpeningDate") })
                    if (entry.Text(source) != "")
                        suppliedDates[target] = entry.Text(source);
            }
            current["suppliedProcessDates"] = suppliedDates;
            latest.Add(current);
        }
        return latest;
    }

    private static void AddMetrics(SqliteConnection db, Dictionary<string, object?> row, DateOnly today, HashSet<string> holidays, int sla, Dictionary<string, int> stageSlas)
    {
        var events = Query(db, """
                SELECT h.id, h.event_timestamp AS timestamp, h.business_date AS businessDate, ns.stage,
                ns.status_name AS status, ns.query_start_key AS queryStart, ns.query_end_key AS queryEnd FROM status_history h JOIN status_master ns ON
                ns.id=h.new_status_id WHERE h.case_id=$0 ORDER BY h.event_timestamp, h.id
                """, row.Number("caseId"));
        events = events.OrderBy(e => e.Text("businessDate") == "" ? e.Text("timestamp")[..10] : e.Text("businessDate")).ThenBy(e => e.Number("id")).ToList();
        var (hold, queries) = HoldAndQueries(events, today, holidays);
        var isClosed = Closed.Contains(row.Text("status"));
        var ending = isClosed ? Date(row.Text("accountOpeningDate")) ?? today : today;
        var inward = Date(row.Text("originalInwardDate"));
        var gross = WorkingDays(inward, ending, holidays);
        row["queryCount"] = queries;
        row["queryHoldDays"] = hold;
        row["rft"] = queries > 0 ? "NRFT" : "RFT";
        row["grossTat"] = gross;
        row["netTat"] = Math.Max(0, gross - hold);
        row["aging"] = isClosed ? 0 : WorkingDays(inward, today, holidays);
        row["slaBreach"] = gross > sla;
        row["panMasked"] = MaskPan(row.Text("pan"));
        row.Remove("pan");
        var dates = new Dictionary<string, string>();
        foreach (var e in events)
            if (ProcessDateFields.TryGetValue(e.Text("status"), out var field))
                dates[field] = e.Text("businessDate") == "" ? e.Text("timestamp")[..10] : e.Text("businessDate");
        var suppliedDates = (Dictionary<string, string>)row["suppliedProcessDates"]!;
        foreach (var (field, date) in suppliedDates)
            dates[field] = date;
        row.Remove("suppliedProcessDates");
        row["processDates"] = dates;
        row["timingUsesAuditDates"] = events.Any(e => e.Text("businessDate") == "");
        var stageEnd = isClosed ? Date(row.Text("communicationSentDate")) ?? ending : today;
        var timingDates = isClosed ? suppliedDates : suppliedDates.Where(pair => pair.Key != "accountOpeningDate").ToDictionary();
        var stageTat = StageMetrics.Calculate(events, timingDates, inward, stageEnd, holidays);
        row["stageTat"] = stageTat;
        var stageBreaches = stageTat.ToDictionary(pair => pair.Key, pair => pair.Value is null ? (bool?)null : pair.Value > stageSlas[pair.Key]);
        row["stageSlaBreaches"] = stageBreaches;
        row["stageSlaBreach"] = stageBreaches.Values.Any(value => value == true);
        row["stage1Queries"] = events.Count(e => e.Text("queryStart") == "stage1");
        row["stage3Queries"] = events.Count(e => e.Text("queryStart") == "stage3");
        row["stage5Queries"] = events.Count(e => e.Text("queryStart") == "stage5");
        row["cseQueries"] = row.Number("stage1Queries") + row.Number("stage3Queries");
        row["mofslQueries"] = row.Number("stage5Queries");
    }
}
