using static Onboarding.Database;
using static Onboarding.Domain;

namespace Onboarding;

public static class DatabaseInitializer
{
    public static void Initialize(this Database database)
    {
        using var db = database.Open();
        using var transaction = db.BeginTransaction();
        Execute(db, File.ReadAllText(database.SchemaPath));
        var entryColumns = Query(db, "PRAGMA table_info(case_entries)").Select(row => row.Text("name")).ToHashSet();
        foreach (var (_, column) in EntryFields.Columns)
            // Includes optional Current Stage overrides; existing entries remain automatically derived.
            if (!entryColumns.Contains(column))
                Execute(db, $"ALTER TABLE case_entries ADD COLUMN {column} TEXT");
        var caseColumns = Query(db, "PRAGMA table_info(cases)").Select(row => row.Text("name")).ToHashSet();
        if (!caseColumns.Contains("touch_count"))
        {
            Execute(db, "ALTER TABLE cases ADD COLUMN touch_count INTEGER NOT NULL DEFAULT 0 CHECK(touch_count >= 0)");
            Execute(db, "ALTER TABLE cases ADD COLUMN touch_count_baseline INTEGER NOT NULL DEFAULT 0 CHECK(touch_count_baseline >= 0)");
            Execute(db, "UPDATE cases SET touch_count=(SELECT COUNT(*) FROM case_entries WHERE case_id=cases.id), touch_count_baseline=(SELECT COUNT(*) FROM case_entries WHERE case_id=cases.id)");
        }
        if (!Query(db, "PRAGMA table_info(status_history)").Any(row => row.Text("name") == "business_date"))
            Execute(db, "ALTER TABLE status_history ADD COLUMN business_date TEXT");
        foreach (var role in Domain.Roles)
            Execute(db, "INSERT OR IGNORE INTO role_master(role_name) VALUES ($0)", role);
        foreach (var status in Domain.Statuses)
            Execute(db, """
                INSERT OR IGNORE INTO status_master(status_name, stage, query_start_key, query_end_key,
                is_closed, is_exception) VALUES ($0, $1, $2, $3, $4, $5)
                """,
                status.Name, status.Stage, status.Start, status.End, status.Closed ? 1 : 0, status.Exception ? 1 : 0);
        foreach (var location in new[] { "Mumbai", "Delhi", "Bengaluru", "Chennai", "Kolkata" })
            Execute(db, "INSERT OR IGNORE INTO location_master(location_name) VALUES ($0)", location);
        foreach (var segment in new[] { "Retail", "HNI", "Ultra HNI", "Institutional", "Corporate" })
            Execute(db, "INSERT OR IGNORE INTO segment_master(segment_name) VALUES ($0)", segment);
        foreach (var (date, name) in Domain.Holidays)
            Execute(db, "INSERT OR IGNORE INTO holiday_master VALUES ($0,$1)", date, name);
        Execute(db, "INSERT OR IGNORE INTO settings VALUES ('sla_days','7')");
        foreach (var (username, display, role, password) in Domain.DemoUsers)
            if (Query(db, "SELECT id FROM users WHERE username=$0", username).Count == 0)
                UserService.CreateUser(db, username, display, role, password);
        transaction.Commit();
    }

}
