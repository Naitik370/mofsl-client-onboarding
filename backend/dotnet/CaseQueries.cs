using Microsoft.Data.Sqlite;
using static Onboarding.Database;

namespace Onboarding;

public static class CaseQueries
{
    private const string CaseSql = """
        SELECT e.id,c.id AS caseId,c.reference_id AS referenceId,e.request_id AS requestId,
        e.entry_type AS entryType,c.client_name AS clientName,c.pan,c.account_type AS accountType,c.channel,
        l.location_name AS location,s.segment_name AS segment,c.rm_name AS rmName,c.cse_name AS cseName,
        e.processor_name AS processorName,e.owner,e.inward_date AS inwardDate,COALESCE(e.outward_date,'') AS outwardDate,
        COALESCE(e.resubmission_date,'') AS resubmissionDate,COALESCE(e.signed_form_date,'') AS signedFormDate,
        COALESCE(e.submitted_date,'') AS submittedDate,COALESCE(e.account_opening_date,'') AS accountOpeningDate,
        e.account_number AS accountNumber,sm.status_name AS status,sm.stage AS statusStage,e.query_details AS queryDetails,e.remarks,
        e.created_at AS createdAt,e.updated_at AS updatedAt,c.touch_count AS touchCount,
        c.touch_count_baseline AS touchCountBaseline {EXTRA_COLUMNS}
        FROM case_entries e JOIN cases c ON c.id=e.case_id JOIN status_master sm ON sm.id=e.latest_status_id
        JOIN location_master l ON l.id=c.location_id JOIN segment_master s ON s.id=c.segment_id
        """;
    public static List<Dictionary<string, object?>> CaseRows(SqliteConnection db, long? entryId = null)
    {
        var rows = Query(db,
        CaseSql.Replace("{EXTRA_COLUMNS}", string.Concat(EntryFields.Columns.Select(pair =>
            $",COALESCE(e.{pair.Value},'') AS {pair.Key}")))
        + (entryId is null ? "" : " WHERE e.id=$0") + " ORDER BY e.updated_at DESC,e.id DESC", entryId is null ? [] : [entryId]);
        foreach (var row in rows)
        {
            row["derivedStage"] = StatusAutomation.DerivedStage(row);
            row["stage"] = row.Text("stageOverride") != "" ? row.Text("stageOverride") : row["derivedStage"];
        }
        return rows;
    }

}
