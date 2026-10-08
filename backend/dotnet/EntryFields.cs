namespace Onboarding;

/// <summary>Trusted field/column names shared by migrations, reads, and writes.</summary>
public static class EntryFields
{
    public static readonly Dictionary<string, string> Dates = new()
    {
        ["statusDate"] = "status_date",
        ["stage1QueryRaisedDate"] = "stage1_query_raised_date",
        ["stage1ResubmissionDate"] = "stage1_resubmission_date",
        ["formPreparedDate"] = "form_prepared_date",
        ["physicalFormSubmittedDate"] = "physical_form_submitted_date",
        ["digitalFormSentDate"] = "digital_form_sent_date",
        ["discrepancyRaisedDate"] = "discrepancy_raised_date",
        ["formReturnedToCseDate"] = "form_returned_to_cse_date",
        ["discrepancyResolutionReceivedDate"] = "discrepancy_resolution_received_date",
        ["resubmittedFormReceivedDate"] = "resubmitted_form_received_date",
        ["mofslQueryRaisedDate"] = "mofsl_query_raised_date",
        ["mofslQueryResolvedDate"] = "mofsl_query_resolved_date",
        ["communicationSentDate"] = "communication_sent_date"
    };
    public static readonly Dictionary<string, string> Text = new()
    {
        ["stageOverride"] = "stage_override",
        ["stage1QueryDetails"] = "stage1_query_details",
        ["discrepancyType"] = "discrepancy_type",
        ["stage4ReviewOutcome"] = "stage4_review_outcome",
        ["mofslQueryType"] = "mofsl_query_type"
    };
    public static IEnumerable<KeyValuePair<string, string>> Columns =>
        Dates.Concat(Text);
    public static readonly string[] DiscrepancyTypes = ["Document Missing", "Signature Mismatch", "Incomplete Details", "Other"];
    public static readonly string[] ReviewOutcomes = ["Found in Order", "Still Pending"];
}
