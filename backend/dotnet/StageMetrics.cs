using static Onboarding.Domain;

namespace Onboarding;

public static class StageMetrics
{
    // Each interval belongs to its starting stage. Repeated visits accumulate; skipped stages stay unknown.
    public static Dictionary<string, int?> Calculate(
        IEnumerable<Dictionary<string, object?>> events, Dictionary<string, string> dates,
        DateOnly? inward, DateOnly end, HashSet<string> holidays)
    {
        var timeline = new List<(DateOnly Day, string Stage, long Order)>();
        if (inward is { } first)
            timeline.Add((first, "Stage 1", -1));
        foreach (var e in events)
        {
            var day = Date(e.Text("businessDate")) ?? Date(e.Text("timestamp")[..10]);
            if (day is { } date && date <= end && (inward is null || date >= inward) && e.Text("stage").StartsWith("Stage "))
                timeline.Add((date, e.Text("stage"), e.Number("id")));
        }
        foreach (var (field, stage) in new[] {
            ("formPreparedDate", "Stage 2"), ("outwardDate", "Stage 2"),
            ("physicalFormSubmittedDate", "Stage 2"), ("digitalFormSentDate", "Stage 2"),
            ("signedFormReceivedDate", "Stage 3"),
            ("discrepancyResolutionReceivedDate", "Stage 4"), ("resubmittedFormReceivedDate", "Stage 4"),
            ("submittedToMofslDate", "Stage 5"), ("accountOpeningDate", "Stage 6") })
            if (dates.TryGetValue(field, out var value) && Date(value) is { } day && day <= end && (inward is null || day >= inward))
                timeline.Add((day, stage, -1));

        var ordered = timeline.OrderBy(x => x.Day).ThenBy(x => x.Order).ToArray();
        var result = Enumerable.Range(1, 6).ToDictionary(i => $"Stage {i}", _ => (int?)null);
        for (var i = 0; i < ordered.Length; i++)
        {
            var current = ordered[i];
            var until = i + 1 < ordered.Length ? ordered[i + 1].Day : end;
            result[current.Stage] = (result[current.Stage] ?? 0) + WorkingDays(current.Day, until, holidays);
        }
        return result;
    }
}
