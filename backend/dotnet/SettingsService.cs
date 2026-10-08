using static Onboarding.Database;
using static Onboarding.Domain;

namespace Onboarding;

public sealed class SettingsService(Database database)
{
    public object Get()
    {
        using var db = database.Open();
        var overall = int.Parse(Query(db, "SELECT setting_value FROM settings WHERE setting_key='sla_days'")[0].Text("setting_value"));
        return new
        {
            slaDays = overall,
            stageSlaDays = Enumerable.Range(1, 6).ToDictionary(i => $"stage{i}", i =>
                int.TryParse(Query(db, "SELECT setting_value FROM settings WHERE setting_key=$0", $"sla_stage{i}_days").FirstOrDefault()?.Text("setting_value"), out var value) ? value : overall)
        };
    }

    public (int Status, object Body) Save(Dictionary<string, object?> payload)
    {
        var keys = new[] { "slaDays", "stage1", "stage2", "stage3", "stage4", "stage5", "stage6" };
        var values = new Dictionary<string, int>();
        foreach (var key in keys)
        {
            if (!int.TryParse(payload.Text(key), out var days) || days < 1 || days > 3650)
                return (400, new
                {
                    errors = new[] { $"{key} must be a whole number from 1 to 3650 working days" }
                });
            values[key] = days;
        }
        using var db = database.Open();
        using var transaction = db.BeginTransaction();
        foreach (var (key, days) in values)
            Execute(db, "INSERT INTO settings(setting_key,setting_value) VALUES ($0,$1) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value",
                key == "slaDays" ? "sla_days" : $"sla_{key}_days", days.ToString());
        transaction.Commit();
        return (200, Get());
    }
}
