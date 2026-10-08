using System.Security.Cryptography;
using Microsoft.Data.Sqlite;
using static Onboarding.Database;
using static Onboarding.Domain;

namespace Onboarding;

public sealed class CaseService(Database database, TimeProvider clock)
{
    private string Now() => clock.GetLocalNow().ToString("yyyy-MM-ddTHH:mm:ss");
    public object GetMeta()
    {
        using var db = database.Open();
        return new
        {
            statuses = Query(db, "SELECT status_name AS status,stage FROM status_master ORDER BY id"),
            locations = Query(db, "SELECT location_name AS name FROM location_master ORDER BY id").Select(x => x.Text("name")),
            segments = Query(db, "SELECT segment_name AS name FROM segment_master ORDER BY id").Select(x => x.Text("name")),
            slaDays = int.Parse(Query(db, "SELECT setting_value FROM settings WHERE setting_key='sla_days'")[0].Text("setting_value"))
        };
    }

    public object GetCases(User user)
    {
        using var db = database.Open();
        var rows = CaseAccessPolicy.Visible(CaseQueries.CaseRows(db), user);
        if (user.Role == "viewer")
        {
            foreach (var row in rows)
            {
                row["panMasked"] = MaskPan(row.Text("pan"));
                row.Remove("pan");
            }
        }
        return rows;
    }

    public object GetHistory(User user)
    {
        using var db = database.Open();
        return CaseAccessPolicy.Visible(Query(db, """
            SELECT h.id,h.event_timestamp AS timestamp,COALESCE(h.business_date,'') AS businessDate,c.reference_id AS referenceId,COALESCE(os.status_name,'') AS previous,
            ns.status_name AS status,ns.stage,h.changed_by AS changedBy,h.owner,h.event_notes AS notes,c.cse_name AS cseName
            FROM status_history h JOIN cases c ON c.id=h.case_id LEFT JOIN status_master os ON os.id=h.old_status_id
            JOIN status_master ns ON ns.id=h.new_status_id ORDER BY h.event_timestamp DESC,h.id DESC
            """), user);
    }

    public (int Status, object Body) SaveCase(Dictionary<string, object?> input, User user, long? entryId = null)
    {
        var now = Now();
        var payload = PreparePayload(input, user, now);
        using var db = database.Open();
        using var transaction = db.BeginTransaction();

        if (entryId is null && payload.Text("entryType") == "New")
            payload["referenceId"] = GenerateReferenceId(db, now);

        var context = AccessContext(db, payload.Text("referenceId"), entryId);
        var accessErrors = CaseAccessPolicy.AccessErrors(payload, user, context);
        if (accessErrors.Count > 0)
            return (403, new
            {
                errors = accessErrors
            });

        PreserveAdditionalFields(db, payload, entryId);
        var validationErrors = CaseValidator.Validate(payload, db, entryId);
        if (validationErrors.Count > 0)
            return (400, new
            {
                errors = validationErrors
            });

        var target = ResolveCase(db, payload, entryId, now);
        if (target is null)
            return (404, new
            {
                error = "Case entry not found"
            });
        var (caseId, previousStatusId) = target.Value;
        var statusId = Lookup(db, "status_master", "status_name", payload.Text("status"));
        var creating = entryId is null;

        UpdateClientDetails(db, payload, caseId, now);
        var savedEntryId = WriteEntry(db, payload, caseId, entryId, statusId, now);
        WriteAdditionalFields(db, payload, savedEntryId);
        AppendStatusHistory(db, payload, user, caseId, savedEntryId, previousStatusId, statusId, now);
        var saved = CaseQueries.CaseRows(db, savedEntryId)[0];
        transaction.Commit();
        return (creating ? 201 : 200, saved);
    }

    private static Dictionary<string, object?> PreparePayload(Dictionary<string, object?> input, User user, string now)
    {
        var autoCapture = user.Role == "admin" && new[] { "true", "1", "on" }.Contains(input.Text("autoCaptureDates").ToLowerInvariant());
        var payload = Normalize(input, now, autoCapture);
        if (user.Role == "cse")
        {
            payload["cseName"] = user.DisplayName;
            payload["owner"] = "Operations";
        }
        if (user.Role == "mofsl")
            payload["owner"] = "MOFSL";
        return payload;
    }

    private static string GenerateReferenceId(SqliteConnection db, string now)
    {
        string reference;
        do
        {
            var suffix = Convert.ToHexString(RandomNumberGenerator.GetBytes(4));
            reference = $"MOFSL-{now[..10].Replace("-", "")}-{suffix}";
        }
        while (Query(db, "SELECT id FROM cases WHERE reference_id=$0", reference).Count != 0);
        return reference;
    }

    private static void PreserveAdditionalFields(SqliteConnection db, Dictionary<string, object?> payload, long? entryId)
    {
        var existing = entryId is not null ? CaseQueries.CaseRows(db, entryId).FirstOrDefault()
            : CaseQueries.CaseRows(db).FirstOrDefault(row => string.Equals(row.Text("referenceId"), payload.Text("referenceId"), StringComparison.OrdinalIgnoreCase));
        if (existing is null)
            return;
        foreach (var (field, _) in EntryFields.Columns)
            if (!payload.ContainsKey(field) && field != "statusDate")
                payload[field] = existing.GetValueOrDefault(field);
    }

    private static void WriteAdditionalFields(SqliteConnection db, Dictionary<string, object?> payload, long entryId)
    {
        var fields = EntryFields.Columns.ToArray();
        var assignments = fields.Select((pair, index) => $"{pair.Value}=${index}");
        var values = fields.Select(pair => payload.Text(pair.Key) == "" ? null : (object)payload.Text(pair.Key)).ToArray();
        Execute(db, $"UPDATE case_entries SET {string.Join(',', assignments)} WHERE id=${fields.Length}", [.. values, entryId]);
    }

    private static Dictionary<string, object?>? AccessContext(SqliteConnection db, string referenceId, long? entryId)
    {
        const string sql = """
            SELECT c.cse_name AS cseName, sm.stage FROM case_entries e
            JOIN cases c ON c.id=e.case_id JOIN status_master sm ON sm.id=e.latest_status_id
            """;
        var condition = entryId is null
            ? " WHERE c.reference_id=$0 COLLATE NOCASE ORDER BY e.updated_at DESC,e.id DESC LIMIT 1"
            : " WHERE e.id=$0";
        return Query(db, sql + condition, entryId is null ? referenceId : entryId).FirstOrDefault();
    }

    private static (long CaseId, long? PreviousStatusId)? ResolveCase(SqliteConnection db, Dictionary<string, object?> payload, long? entryId, string now)
    {
        long caseId;
        long? previousStatusId = null;
        if (entryId is not null)
        {
            var old = Query(db, "SELECT case_id,latest_status_id FROM case_entries WHERE id=$0", entryId).FirstOrDefault();
            if (old is null)
                return null;
            caseId = old.Number("case_id");
            previousStatusId = old.Number("latest_status_id");
            // Reference IDs are stable even when an edit supplies a different ID.
        }
        else
        {
            var original = Query(db, "SELECT id FROM cases WHERE reference_id=$0 COLLATE NOCASE", payload.Text("referenceId")).FirstOrDefault();
            if (original is null)
                caseId = Execute(db, """
                    INSERT INTO cases(reference_id, client_name, pan, account_type, channel, location_id,
                    segment_id, rm_name, cse_name, created_at, updated_at) VALUES ($0, $1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10)
                    """,
                    payload.Text("referenceId"),
                    payload.Text("clientName"),
                    payload.Text("pan"),
                    payload.Text("accountType"),
                    payload.Text("channel"),
                    Lookup(db, "location_master", "location_name", payload.Text("location")),
                    Lookup(db, "segment_master", "segment_name", payload.Text("segment")),
                    payload.Text("rmName"),
                    payload.Text("cseName"), now, now);
            else
            {
                caseId = original.Number("id");
                previousStatusId = Query(db, "SELECT latest_status_id FROM case_entries WHERE case_id=$0 ORDER BY updated_at DESC,id DESC LIMIT 1", caseId).FirstOrDefault()?.Number("latest_status_id");
            }
        }
        return (caseId, previousStatusId);
    }

    private static void UpdateClientDetails(SqliteConnection db, Dictionary<string, object?> payload, long caseId, string now)
    {
        Execute(db, """
            UPDATE cases SET client_name=$0, pan=$1, account_type=$2, channel=$3, location_id=$4,
            segment_id=$5, rm_name=$6, cse_name=$7, updated_at=$8, touch_count=touch_count+1 WHERE id=$9
            """,
            payload.Text("clientName"),
            payload.Text("pan"),
            payload.Text("accountType"),
            payload.Text("channel"),
            Lookup(db, "location_master", "location_name", payload.Text("location")),
            Lookup(db, "segment_master", "segment_name", payload.Text("segment")),
            payload.Text("rmName"),
            payload.Text("cseName"), now, caseId);
    }

    private static long WriteEntry(SqliteConnection db, Dictionary<string, object?> payload, long caseId, long? entryId, long? statusId, string now)
    {
        object? OptionalDate(string field) => payload.Text(field) == "" ? null : payload.Text(field);
        object?[] values =
        [
            payload.Text("requestId"),
            payload.Text("entryType"),
            payload.Text("processorName"),
            payload.Text("owner"),
            payload.Text("inwardDate"),
            OptionalDate("outwardDate"),
            OptionalDate("resubmissionDate"),
            OptionalDate("signedFormDate"),
            OptionalDate("submittedDate"),
            OptionalDate("accountOpeningDate"),
            payload.Text("accountNumber"),
            statusId,
            payload.Text("queryDetails"),
            payload.Text("remarks"),
            now
            ];
        if (entryId is null)
            entryId = Execute(db, """
            INSERT INTO case_entries(request_id, entry_type, processor_name, owner, inward_date,
            outward_date, resubmission_date, signed_form_date, submitted_date, account_opening_date,
            account_number, latest_status_id, query_details, remarks, updated_at, created_at, case_id)
            VALUES ($0, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            """, [.. values, now, caseId]);
        else
            Execute(db, """
                UPDATE case_entries SET request_id=$0, entry_type=$1, processor_name=$2, owner=$3,
                inward_date=$4, outward_date=$5, resubmission_date=$6, signed_form_date=$7, submitted_date=$8,
                account_opening_date=$9, account_number=$10, latest_status_id=$11, query_details=$12,
                remarks=$13, updated_at=$14 WHERE id=$15
                """, [.. values, entryId]);
        return entryId!.Value;
    }

    private static void AppendStatusHistory(SqliteConnection db, Dictionary<string, object?> payload, User user, long caseId, long entryId, long? previousStatusId, long? statusId, string now)
    {
        if (previousStatusId != statusId)
            Execute(db, """
                INSERT INTO status_history(case_id, entry_id, event_timestamp, old_status_id, new_status_id,
                changed_by, owner, event_notes, business_date) VALUES ($0, $1, $2, $3, $4, $5, $6, $7, $8)
                """,
                caseId, entryId, now, previousStatusId, statusId, user.DisplayName, payload.Text("owner"), payload.Text("remarks") != "" ? payload.Text("remarks") : payload.Text("queryDetails"), BusinessDate(payload));
    }

    private static object? BusinessDate(Dictionary<string, object?> payload)
    {
        if (payload.Text("statusDate") != "")
            return payload.Text("statusDate");
        if (payload.Text("status") == "Request Received from CSE")
            return payload.Text("inwardDate");
        if (ProcessDateFields.TryGetValue(payload.Text("status"), out var field) && payload.Text(field) != "")
            return payload.Text(field);
        return null; // Legacy/undated events retain audit-date fallback, visibly marked in reports.
    }
}
