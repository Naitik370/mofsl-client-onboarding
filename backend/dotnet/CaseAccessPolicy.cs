using static Onboarding.Domain;

namespace Onboarding;

public static class CaseAccessPolicy
{
    public static List<Dictionary<string, object?>> Visible(IEnumerable<Dictionary<string, object?>> rows, User user) => rows.Where(row => user.Role switch
    {
        "cse" => string.Equals(row.Text("cseName"), user.DisplayName, StringComparison.OrdinalIgnoreCase),
        "mofsl" => row.Text("owner") == "MOFSL" || (row.ContainsKey("statusStage") ? row.Text("statusStage") : row.Text("stage")) is "Stage 5" or "Stage 6",
        _ => true
    }).ToList();

    public static List<string> AccessErrors(Dictionary<string, object?> payload, User user, Dictionary<string, object?>? existing)
    {
        if (user.Role == "viewer")
            return ["Management Viewer is read-only"];
        if (user.Role is "admin" or "operations")
            return [];
        if (user.Role == "cse")
        {
            if (!CseStatuses.Contains(payload.Text("status")))
                return ["CSE users can only record request, resubmission, or discrepancy-resolution statuses"];
            if (existing is not null && !string.Equals(existing.Text("cseName"), user.DisplayName, StringComparison.OrdinalIgnoreCase))
                return ["CSE users can only update their own cases"];
            return [];
        }
        if (user.Role == "mofsl")
        {
            if (!MofslStatuses.Contains(payload.Text("status")))
                return ["MOFSL users can only record MOFSL query, resolution, or account-opening statuses"];
            if (existing is null || existing.Text("stage") is not ("Stage 5" or "Stage 6"))
                return ["MOFSL users can only update cases that have reached Stage 5"];
            return [];
        }
        return ["Invalid role"];
    }

}
