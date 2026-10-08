using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Onboarding;
using Xunit;
using static Onboarding.Database;
using static Onboarding.Domain;

namespace Onboarding.Tests;

public sealed class ApiTests : IDisposable
{
    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
    }

    [Fact]
    public void NewInwardDateUsesServerClockAndPreservesExplicitAndExistingDates()
    {
        var service = new CaseService(database, new FixedClock(new DateTimeOffset(2026, 7, 10, 10, 0, 0, TimeSpan.Zero)));
        Assert.Equal("2026-07-10", Json(service.GetMeta()).GetProperty("today").GetString());
        foreach (var role in new[] { Admin, Operations, new User(3, "cse", "CSE Demo", "cse") })
        {
            var payload = Base();
            payload.Remove("inwardDate");
            var result = service.SaveCase(payload, role);
            Assert.Equal(201, result.Status);
            Assert.Equal("2026-07-10", Json(result.Body).GetProperty("inwardDate").GetString());
        }
        var blank = Base();
        blank["inwardDate"] = "  ";
        Assert.Equal("2026-07-10", Json(service.SaveCase(blank, Operations).Body).GetProperty("inwardDate").GetString());
        var explicitDate = Base();
        var saved = Json(service.SaveCase(explicitDate, Operations).Body);
        Assert.Equal("2026-07-01", saved.GetProperty("inwardDate").GetString());
        var later = new CaseService(database, new FixedClock(new DateTimeOffset(2026, 7, 11, 10, 0, 0, TimeSpan.Zero)));
        var id = saved.GetProperty("id").GetInt64();
        Assert.Equal("2026-07-01", Json(later.SaveCase(explicitDate, Operations, id).Body).GetProperty("inwardDate").GetString());
        explicitDate["inwardDate"] = "";
        Assert.Equal(400, later.SaveCase(explicitDate, Operations, id).Status);
        explicitDate["entryType"] = "Resubmission";
        explicitDate["referenceId"] = saved.GetProperty("referenceId").GetString();
        explicitDate["status"] = "Resubmitted by CSE";
        Assert.Equal(400, later.SaveCase(explicitDate, Operations).Status);
        explicitDate["inwardDate"] = "2026-07-01";
        Assert.Equal("2026-07-01", Json(later.SaveCase(explicitDate, Operations).Body).GetProperty("inwardDate").GetString());
    }

    [Fact]
    public void LegacySchemaMigrationPreservesRecordsAndInitializesTouchBaselineOnce()
    {
        var saved = Json(cases.SaveCase(Base(), Operations).Body);
        var reference = saved.GetProperty("referenceId").GetString();
        using (var db = database.Open())
        {
            foreach (var (_, column) in EntryFields.Columns)
                Execute(db, $"ALTER TABLE case_entries DROP COLUMN {column}");
            Execute(db, "ALTER TABLE status_history DROP COLUMN business_date");
            Execute(db, "ALTER TABLE cases DROP COLUMN touch_count");
            Execute(db, "ALTER TABLE cases DROP COLUMN touch_count_baseline");
        }
        database.Initialize();
        var row = Json(cases.GetCases(Operations))[0];
        Assert.Equal(reference, row.GetProperty("referenceId").GetString());
        Assert.Equal(1, row.GetProperty("touchCount").GetInt32());
        Assert.Equal(1, row.GetProperty("touchCountBaseline").GetInt32());
        Assert.Equal("", row.GetProperty("formPreparedDate").GetString());
        Assert.Single(Json(cases.GetHistory(Operations)).EnumerateArray());
        cases.SaveCase(Base(), Operations, saved.GetProperty("id").GetInt64());
        database.Initialize();
        Assert.Equal(2, Json(cases.GetCases(Operations))[0].GetProperty("touchCount").GetInt32());
    }

    [Fact]
    public void StageTatAccumulatesRevisitsAndExcludesHolidays()
    {
        var events = new List<Dictionary<string, object?>> {
            new() { ["id"] = 1L, ["stage"] = "Stage 2", ["businessDate"] = "2026-01-27" },
            new() { ["id"] = 2L, ["stage"] = "Stage 1", ["businessDate"] = "2026-01-28" },
            new() { ["id"] = 3L, ["stage"] = "Stage 2", ["businessDate"] = "2026-01-29" }
        };
        var result = StageMetrics.Calculate(events, new(), Date("2026-01-23"), Date("2026-01-30")!.Value, ["2026-01-26"]);
        Assert.Equal(2, result["Stage 1"]);
        Assert.Equal(2, result["Stage 2"]);
        Assert.Null(result["Stage 3"]);
    }

    [Fact]
    public void TouchCountIsAutomaticAtomicAndCountsSameStatusSaves()
    {
        var payload = Base();
        payload["touchCount"] = 999;
        var created = Json(cases.SaveCase(payload, Operations).Body);
        var id = created.GetProperty("id").GetInt64();
        Assert.Equal(1, created.GetProperty("touchCount").GetInt32());
        var edited = Json(cases.SaveCase(payload, Operations, id).Body);
        Assert.Equal(2, edited.GetProperty("touchCount").GetInt32());
        Assert.Single(Json(cases.GetHistory(Operations)).EnumerateArray());
        payload["pan"] = "bad";
        Assert.Equal(400, cases.SaveCase(payload, Operations, id).Status);
        Assert.Equal(403, cases.SaveCase(Base(), new User(5, "viewer", "Viewer", "viewer"), id).Status);
        Assert.Equal(2, Json(cases.GetCases(Operations))[0].GetProperty("touchCount").GetInt32());
        payload = Base();
        payload["entryType"] = "Modification";
        payload["referenceId"] = created.GetProperty("referenceId").GetString();
        Assert.Equal(3, Json(cases.SaveCase(payload, Operations).Body).GetProperty("touchCount").GetInt32());
    }

    [Fact]
    public void BusinessDatesDriveStageTatHoldsAttributionAndSla()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 7, 17, 12, 0, 0, TimeSpan.Zero));
        var service = new CaseService(database, clock);
        var payload = Base();
        var created = Json(service.SaveCase(payload, Operations).Body);
        payload["referenceId"] = created.GetProperty("referenceId").GetString();
        payload["entryType"] = "Modification";
        var journey = new[] {
            ("Query Raised to CSE - Missing Information", "2026-07-02"), ("Resubmitted by CSE", "2026-07-03"),
            ("Application Form Under Preparation", "2026-07-06"), ("Physical Form Submitted to CSE", "2026-07-07"),
            ("Signed Form Received from CSE", "2026-07-08"), ("Discrepancy Raised to CSE", "2026-07-09"),
            ("Discrepancy Resolution Received", "2026-07-10"), ("Form Found in Order - Ready for MOFSL Submission", "2026-07-10"),
            ("Submitted to MOFSL", "2026-07-13"), ("Query Raised by MOFSL", "2026-07-14"),
            ("Query Resolved - Resubmitted to MOFSL", "2026-07-15"), ("Account Opened", "2026-07-16"),
            ("Communication Sent - Case Closed", "2026-07-17")
        };
        foreach (var (status, date) in journey)
        {
            payload["status"] = status;
            payload["statusDate"] = date;
            payload["queryDetails"] = "Business event";
            if (ProcessDateFields.TryGetValue(status, out var field))
                payload[field] = date;
            if (status == "Signed Form Received from CSE")
                payload["signedFormDate"] = date;
            if (status == "Submitted to MOFSL")
                payload["submittedDate"] = date;
            if (status == "Discrepancy Raised to CSE")
                payload["discrepancyType"] = "Document Missing";
            if (status == "Form Found in Order - Ready for MOFSL Submission")
                payload["stage4ReviewOutcome"] = "Found in Order";
            if (status == "Account Opened")
                payload["accountNumber"] = "ACC-123";
            Assert.Equal(201, service.SaveCase(payload, Operations).Status);
        }
        using (var db = database.Open())
            Execute(db, "INSERT INTO settings VALUES ('sla_stage1_days','2')");
        var report = Json(new ReportService(database, clock).Report("", "", "cseName", Operations));
        var row = report.GetProperty("cases")[0];
        Assert.Equal(3, row.GetProperty("queryHoldDays").GetInt32());
        Assert.Equal(11, row.GetProperty("grossTat").GetInt32());
        Assert.Equal(8, row.GetProperty("netTat").GetInt32());
        Assert.Equal(14, row.GetProperty("touchCount").GetInt32());
        var expected = new[] { 3, 2, 2, 1, 3, 1 };
        for (var i = 0; i < 6; i++)
            Assert.Equal(expected[i], row.GetProperty("stageTat").GetProperty($"Stage {i + 1}").GetInt32());
        Assert.True(row.GetProperty("stageSlaBreaches").GetProperty("Stage 1").GetBoolean());
        Assert.Equal(2, row.GetProperty("cseQueries").GetInt32());
        Assert.Equal(1, row.GetProperty("mofslQueries").GetInt32());
        Assert.Equal(1, report.GetProperty("groups")[0].GetProperty("stage3Queries").GetInt32());
        Assert.Equal("2026-07-09", row.GetProperty("processDates").GetProperty("discrepancyRaisedDate").GetString());
        Assert.False(row.GetProperty("timingUsesAuditDates").GetBoolean());
        var history = Json(service.GetHistory(Operations));
        Assert.Equal("2026-07-17T12:00:00", history[0].GetProperty("timestamp").GetString());
    }

    [Fact]
    public void NewFieldsValidatePersistAndOpenAgingUsesToday()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 7, 17, 12, 0, 0, TimeSpan.Zero));
        var service = new CaseService(database, clock);
        var payload = Base();
        payload["stage1QueryRaisedDate"] = "2026-02-30";
        Assert.Equal(400, service.SaveCase(payload, Operations).Status);
        payload.Remove("stage1QueryRaisedDate");
        payload["discrepancyType"] = "Unknown";
        Assert.Equal(400, service.SaveCase(payload, Operations).Status);
        payload["discrepancyType"] = "Signature Mismatch";
        payload["digitalFormSentDate"] = "2026-07-03";
        Assert.Equal(400, service.SaveCase(payload, Operations).Status);
        payload.Remove("digitalFormSentDate");
        payload["stage4ReviewOutcome"] = "Still Pending";
        payload["accountOpeningDate"] = "2026-07-03";
        var saved = Json(service.SaveCase(payload, Operations).Body);
        Assert.Equal("Signature Mismatch", saved.GetProperty("discrepancyType").GetString());
        var row = Json(new ReportService(database, clock).Report("", "", "location", Operations)).GetProperty("cases")[0];
        Assert.Equal(12, row.GetProperty("aging").GetInt32());
        Assert.Equal(12, row.GetProperty("grossTat").GetInt32());
        Assert.Equal(JsonValueKind.Null, row.GetProperty("stageTat").GetProperty("Stage 2").ValueKind);
        Assert.Equal(JsonValueKind.Null, row.GetProperty("stageTat").GetProperty("Stage 6").ValueKind);
        payload["referenceId"] = saved.GetProperty("referenceId").GetString();
        payload["entryType"] = "Resubmission";
        payload["inwardDate"] = "2026-07-10";
        payload.Remove("accountOpeningDate");
        payload["stage1QueryRaisedDate"] = "2026-07-02";
        Assert.Equal(201, service.SaveCase(payload, Operations).Status);
    }

    [Fact]
    public async Task SlaSettingsRequireAdminAndRejectInvalidThresholds()
    {
        var thresholds = new Dictionary<string, object?> { ["slaDays"] = 7 };
        for (var i = 1; i <= 6; i++)
            thresholds[$"stage{i}"] = 7;
        using var viewer = Client();
        await Login(viewer, "viewer", "ViewDemo@123");
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.PutAsJsonAsync("/api/settings", thresholds)).StatusCode);
        using var admin = Client();
        await Login(admin, "admin", "AdminDemo@123");
        thresholds["stage1"] = 3;
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync("/api/settings", thresholds)).StatusCode);
        thresholds["stage1"] = 0;
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync("/api/settings", thresholds)).StatusCode);
        var settings = await Read(await admin.GetAsync("/api/settings"));
        Assert.Equal(3, settings.GetProperty("stageSlaDays").GetProperty("stage1").GetInt32());
    }

    [Fact]
    public void BusinessDatesAndSessionExpiryUseTheInjectedClock()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 7, 10, 10, 0, 0, TimeSpan.Zero));
        var caseService = new CaseService(database, clock);
        var reportService = new ReportService(database, clock);
        var authenticationService = new AuthenticationService(database, clock);
        var payload = Base("Physical Form Submitted to CSE");
        payload["autoCaptureDates"] = true;

        var saved = Json(caseService.SaveCase(payload, Admin).Body);
        Assert.Equal("2026-07-10", saved.GetProperty("outwardDate").GetString());
        var report = Json(reportService.Report("", "", "cseName", Operations));
        Assert.Equal(7, report.GetProperty("cases")[0].GetProperty("grossTat").GetInt32());
        Assert.Equal("2026-07-10T10:00:00", report.GetProperty("generatedAt").GetString());
        var login = authenticationService.Authenticate("operations", "OpsDemo@123");
        Assert.NotNull(login);
        using var db = database.Open();
        Assert.Equal("2026-07-10T22:00:00", Query(db, "SELECT expires_at FROM sessions")[0].Text("expires_at"));
    }

    private readonly string directory = Path.Combine(Path.GetTempPath(), "mofsl-tests-" + Guid.NewGuid());
    private readonly Database database;
    private readonly WebApplicationFactory<Program> factory;
    private readonly CaseService cases;
    private readonly ReportService reports;
    private readonly AuthenticationService authentication;
    private static readonly User Operations = new(1, "operations", "Operations Demo", "operations");
    private static readonly User Admin = new(1, "admin", "System Administrator", "admin");

    public ApiTests()
    {
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../"));
        database = new Database(Path.Combine(directory, "test.db"), Path.Combine(root, "sql/schema.sql"));
        factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ProjectRoot", root);
            builder.ConfigureServices(services => { services.RemoveAll<Database>(); services.AddSingleton(database); });
        });
        database.Initialize();
        cases = new CaseService(database, TimeProvider.System);
        reports = new ReportService(database, TimeProvider.System);
        authentication = new AuthenticationService(database, TimeProvider.System);
    }
    public void Dispose()
    {
        factory.Dispose();
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        Directory.Delete(directory, true);
    }
    private HttpClient Client() => factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, AllowAutoRedirect = false });
    private static Dictionary<string, object?> Base(string status = "Request Received from CSE") => new()
    {
        ["referenceId"] = "CLIENT-SUPPLIED",
        ["requestId"] = "REQ-1",
        ["entryType"] = "New",
        ["clientName"] = "Test Client",
        ["pan"] = "abcde1234f",
        ["accountType"] = "Individual",
        ["channel"] = "Physical",
        ["location"] = "Mumbai",
        ["segment"] = "Retail",
        ["cseName"] = "CSE Demo",
        ["processorName"] = "Untrusted name",
        ["owner"] = "Operations",
        ["inwardDate"] = "2026-07-01",
        ["status"] = status
    };
    private static JsonElement Json(object body) => JsonSerializer.SerializeToElement(body, new JsonSerializerOptions(JsonSerializerDefaults.Web));
    private static async Task<JsonElement> Read(HttpResponseMessage response) => await response.Content.ReadFromJsonAsync<JsonElement>();
    private static async Task Login(HttpClient client, string username, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new
        {
            username,
            password
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AuthenticationCookiesLogoutAndAllRoles()
    {
        using var client = Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/cases")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new
        {
            username = "admin",
            password = "wrong"
        })).StatusCode);
        foreach (var (username, _, role, password) in DemoUsers)
        {
            using var identity = Client();
            var response = await identity.PostAsJsonAsync("/api/auth/login", new
            {
                username,
                password
            });
            var body = await Read(response);
            Assert.Equal(role, body.GetProperty("role").GetString());
            Assert.False(body.TryGetProperty("token", out _));
            var cookie = response.Headers.GetValues("Set-Cookie").Single();
            Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
            Assert.Equal(HttpStatusCode.OK, (await identity.GetAsync("/api/auth/me")).StatusCode);
            await identity.PostAsJsonAsync("/api/auth/logout", new
            {
            });
            Assert.Equal(HttpStatusCode.Unauthorized, (await identity.GetAsync("/api/auth/me")).StatusCode);
        }
    }

    [Fact]
    public async Task RoleJourneyAndAuthoritativeAudit()
    {
        using var operations = Client();
        using var cse = Client();
        using var mofsl = Client();
        using var viewer = Client();
        using var admin = Client();
        await Login(operations, "operations", "OpsDemo@123");
        await Login(cse, "cse", "CseDemo@123");
        await Login(mofsl, "mofsl", "MofslDemo@123");
        await Login(viewer, "viewer", "ViewDemo@123");
        await Login(admin, "admin", "AdminDemo@123");
        var payload = Base();
        var createdResponse = await operations.PostAsJsonAsync("/api/cases", payload);
        Assert.Equal(HttpStatusCode.Created, createdResponse.StatusCode);
        var created = await Read(createdResponse);
        var reference = created.GetProperty("referenceId").GetString()!;
        Assert.Matches("^MOFSL-[0-9]{8}-[0-9A-F]{8}$", reference);
        Assert.Equal("ABCDE1234F", created.GetProperty("pan").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.PostAsJsonAsync("/api/cases", payload)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.PutAsJsonAsync($"/api/cases/{created.GetProperty("id")}", payload)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await operations.GetAsync("/api/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await operations.PostAsJsonAsync("/api/users", new
        {
        })).StatusCode);
        payload["referenceId"] = reference;
        payload["entryType"] = "Resubmission";
        payload["status"] = "Resubmitted by CSE";
        payload["cseName"] = "Spoofed name";
        payload["owner"] = "CSE";
        var cseResponse = await cse.PostAsJsonAsync("/api/cases", payload);
        Assert.Equal(HttpStatusCode.Created, cseResponse.StatusCode);
        var cseBody = await Read(cseResponse);
        Assert.Equal("CSE Demo", cseBody.GetProperty("cseName").GetString());
        Assert.Equal("Operations", cseBody.GetProperty("owner").GetString());
        payload["status"] = "Submitted to MOFSL";
        Assert.Equal(HttpStatusCode.Forbidden, (await cse.PostAsJsonAsync("/api/cases", payload)).StatusCode);
        payload["status"] = "Query Raised by MOFSL";
        payload["queryDetails"] = "Signature mismatch";
        Assert.Equal(HttpStatusCode.Forbidden, (await mofsl.PostAsJsonAsync("/api/cases", payload)).StatusCode);
        payload["status"] = "Submitted to MOFSL";
        payload["cseName"] = "CSE Demo";
        Assert.Equal(HttpStatusCode.Created, (await operations.PostAsJsonAsync("/api/cases", payload)).StatusCode);
        payload["status"] = "Query Raised by MOFSL";
        payload["changedBy"] = "Spoofed actor";
        Assert.Equal(HttpStatusCode.Created, (await mofsl.PostAsJsonAsync("/api/cases", payload)).StatusCode);
        var history = await Read(await mofsl.GetAsync("/api/history"));
        Assert.Equal("MOFSL Demo", history[0].GetProperty("changedBy").GetString());
        var rows = await Read(await viewer.GetAsync("/api/cases"));
        Assert.False(rows[0].TryGetProperty("pan", out _));
        Assert.Equal("AB*****34F", rows[0].GetProperty("panMasked").GetString());
        var report = await Read(await viewer.GetAsync("/api/reports"));
        Assert.Equal(1, report.GetProperty("summary").GetProperty("total").GetInt32());
        Assert.Equal("NRFT", report.GetProperty("cases")[0].GetProperty("rft").GetString());
        Assert.False(report.GetProperty("cases")[0].TryGetProperty("pan", out _));
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/users", new
        {
            username = "new-viewer",
            displayName = "New Viewer",
            role = "viewer",
            password = "NewViewer@123"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/users", new
        {
            username = "new-viewer",
            displayName = "Duplicate",
            role = "viewer",
            password = "NewViewer@123"
        })).StatusCode);
    }

    [Fact]
    public void VisibilityOwnershipAndStableReferences()
    {
        var payload = Base();
        payload["cseName"] = "Another CSE";
        var (_, saved) = cases.SaveCase(payload, Operations);
        var original = Json(saved);
        payload["referenceId"] = original.GetProperty("referenceId").GetString();
        payload["entryType"] = "Resubmission";
        payload["status"] = "Resubmitted by CSE";
        Assert.Equal(403, cases.SaveCase(payload, new User(3, "cse", "CSE Demo", "cse")).Status);
        Assert.Empty(Json(cases.GetCases(new User(3, "cse", "CSE Demo", "cse"))).EnumerateArray());
        Assert.Empty(Json(cases.GetCases(new User(4, "mofsl", "MOFSL Demo", "mofsl"))).EnumerateArray());
        payload["referenceId"] = "CHANGED";
        var (status, updated) = cases.SaveCase(payload, Operations, original.GetProperty("id").GetInt64());
        Assert.Equal(200, status);
        Assert.Equal(original.GetProperty("referenceId").GetString(), Json(updated).GetProperty("referenceId").GetString());
        Assert.Equal(404, cases.SaveCase(payload, Operations, 99999).Status);
    }

    [Fact]
    public void ValidationDatesAndAdminAutoCapture()
    {
        var payload = Base();
        payload["inwardDate"] = "29-09-2026";
        payload["outwardDate"] = "30-09-2026";
        var (status, body) = cases.SaveCase(payload, Operations);
        Assert.Equal(201, status);
        Assert.Equal("2026-09-29", Json(body).GetProperty("inwardDate").GetString());
        Assert.Equal("2026-09-30", Json(body).GetProperty("outwardDate").GetString());
        payload["inwardDate"] = "31-09-2026";
        payload["owner"] = "Unknown";
        payload["accountType"] = "Trust";
        var (invalidStatus, invalid) = cases.SaveCase(payload, Operations);
        Assert.Equal(400, invalidStatus);
        var errors = Json(invalid).GetProperty("errors").EnumerateArray().Select(x => x.GetString()).ToList();
        Assert.Contains("Inward date is invalid", errors);
        Assert.Contains("Current owner is invalid", errors);
        Assert.Contains("Account type is invalid", errors);
        foreach (var bad in new[] { "pan", "location", "segment", "status", "entryType", "channel" })
        {
            var item = Base();
            item[bad] = "invalid";
            Assert.Equal(400, cases.SaveCase(item, Operations).Status);
        }
        Assert.Equal(400, cases.SaveCase(Base("Account Opened"), Operations).Status);
        Assert.Equal(400, cases.SaveCase(Base("Query Raised by MOFSL"), Operations).Status);
        Assert.Equal(400, cases.SaveCase(Base("Digital Form Sent to Client"), Operations).Status);
        payload = Base("Physical Form Submitted to CSE");
        payload["autoCaptureDates"] = true;
        Assert.Equal("", Json(cases.SaveCase(payload, Operations).Body).GetProperty("outwardDate").GetString());
        Assert.Equal(DateTime.Today.ToString("yyyy-MM-dd"), Json(cases.SaveCase(payload, Admin).Body).GetProperty("outwardDate").GetString());
        payload["outwardDate"] = "2026-07-02";
        Assert.Equal("2026-07-02", Json(cases.SaveCase(payload, Admin).Body).GetProperty("outwardDate").GetString());
        payload = Base();
        payload["entryType"] = "Modification";
        Assert.Equal(400, cases.SaveCase(payload, Operations).Status);
    }

    [Fact]
    public void HistoryCalculationsAndExclusions()
    {
        Assert.Equal(1, WorkingDays(Date("2026-01-23"), Date("2026-01-27"), ["2026-01-26"]));
        var payload = Base("Query Raised to CSE - Missing Information");
        payload["queryDetails"] = "Missing proof";
        var first = Json(cases.SaveCase(payload, Operations).Body);
        payload["referenceId"] = first.GetProperty("referenceId").GetString();
        payload["entryType"] = "Resubmission";
        payload["status"] = "Resubmitted by CSE";
        cases.SaveCase(payload, Operations);
        using (var db = database.Open())
        {
            var events = Query(db, "SELECT id FROM status_history WHERE case_id=$0 ORDER BY id", first.GetProperty("caseId").GetInt64());
            Execute(db, "UPDATE status_history SET event_timestamp='2026-07-01T10:00:00' WHERE id=$0", events[0]["id"]);
            Execute(db, "UPDATE status_history SET event_timestamp='2026-07-03T10:00:00' WHERE id=$0", events[1]["id"]);
        }
        cases.SaveCase(Base("Rejected"), Operations);
        cases.SaveCase(Base("Cancelled by Client"), Operations);
        var report = Json(reports.Report("", "", "location", Operations));
        var summary = report.GetProperty("summary");
        Assert.Equal(3, summary.GetProperty("total").GetInt32());
        Assert.Equal(1, summary.GetProperty("nrft").GetInt32());
        Assert.Equal(0, summary.GetProperty("rftPercent").GetDouble());
        var current = report.GetProperty("cases").EnumerateArray().Single(x => x.GetProperty("caseId").GetInt64() == first.GetProperty("caseId").GetInt64());
        Assert.Equal(1, current.GetProperty("queryCount").GetInt32());
        Assert.Equal(2, current.GetProperty("queryHoldDays").GetInt32());
        Assert.Equal(1, current.GetProperty("resubmissionCount").GetInt32());
        Assert.Equal("2026-07-03", current.GetProperty("processDates").GetProperty("stage1ResubmissionDate").GetString());
        Assert.Equal(current.GetProperty("grossTat").GetInt32() - 2, current.GetProperty("netTat").GetInt32());
        Assert.Equal(current.GetProperty("netTat").GetDouble(), summary.GetProperty("averageNetTat").GetDouble());
        Assert.Equal("Mumbai", report.GetProperty("groups")[0].GetProperty("name").GetString());
        Assert.Equal(0, Json(reports.Report("2026-07-02", "", "segment", Operations)).GetProperty("summary").GetProperty("total").GetInt32());
        var eventsList = new List<Dictionary<string, object?>> {
            new() { ["timestamp"] = "2026-01-23T10:00:00", ["queryStart"] = "stage1", ["queryEnd"] = null },
            new() { ["timestamp"] = "2026-01-27T10:00:00", ["queryStart"] = "stage1", ["queryEnd"] = null },
            new() { ["timestamp"] = "2026-01-28T10:00:00", ["queryStart"] = null, ["queryEnd"] = "stage1" }
        };
        Assert.Equal((4, 2), HoldAndQueries(eventsList, Date("2026-01-29")!.Value, ["2026-01-26"]));
    }

    [Fact]
    public void SameStatusDoesNotAppendHistoryAndFailuresDoNotPersist()
    {
        var payload = Base();
        var original = Json(cases.SaveCase(payload, Operations).Body);
        var id = original.GetProperty("id").GetInt64();
        cases.SaveCase(payload, Operations, id);
        Assert.Single(Json(cases.GetHistory(Operations)).EnumerateArray());
        payload["status"] = "Under Review by Operations";
        cases.SaveCase(payload, Operations, id);
        Assert.Equal(2, Json(cases.GetHistory(Operations)).GetArrayLength());
        payload["pan"] = "invalid";
        Assert.Equal(400, cases.SaveCase(payload, Operations, id).Status);
        Assert.Equal(2, Json(cases.GetHistory(Operations)).GetArrayLength());
        Assert.Equal("ABCDE1234F", Json(cases.GetCases(Operations))[0].GetProperty("pan").GetString());
    }

    [Fact]
    public void ExistingPythonPasswordAndSessionFormatsRemainValid()
    {
        var salt = Enumerable.Range(0, 16).Select(x => (byte)x).ToArray();
        // Golden hash generated by Python hashlib.pbkdf2_hmac before migration.
        var hash = Convert.FromHexString("9e929f12bda7a3f082c216ba7bd7342f742a2ec58fc8b733c2dc961f22fe8252");
        Assert.Equal(hash, PasswordHasher.Digest("ExistingPassword@123", salt));
        using (var db = database.Open())
        {
            Execute(db, "UPDATE users SET password_hash=$0,password_salt=$1 WHERE username='operations'", hash, salt);
            var userId = Query(db, "SELECT id FROM users WHERE username='operations'")[0].Number("id");
            var tokenHash = Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("existing-python-token")));
            Execute(db, "INSERT INTO sessions VALUES ($0,$1,$2,$3)", tokenHash, userId, DateTime.Now.AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss"), DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss"));
        }
        Assert.NotNull(authentication.Authenticate("OPERATIONS", "ExistingPassword@123"));
        Assert.Equal("operations", authentication.SessionUser("existing-python-token")?.Role);
        database.Initialize();
        Assert.NotNull(authentication.Authenticate("operations", "ExistingPassword@123"));
    }

    [Fact]
    public void SixStageWorkflowCompletesWithAllQueryTypes()
    {
        var payload = Base();
        var created = Json(cases.SaveCase(payload, Operations).Body);
        payload["referenceId"] = created.GetProperty("referenceId").GetString();
        payload["entryType"] = "Modification";
        var journey = new[] {
            ("Query Raised to CSE - Missing Information", "Stage 1"), ("Resubmitted by CSE", "Stage 1"),
            ("Application Form Under Preparation", "Stage 2"), ("Physical Form Submitted to CSE", "Stage 2"),
            ("Signed Form Received from CSE", "Stage 3"), ("Discrepancy Raised to CSE", "Stage 3"),
            ("Discrepancy Resolution Received", "Stage 4"), ("Form Found in Order - Ready for MOFSL Submission", "Stage 4"),
            ("Submitted to MOFSL", "Stage 5"), ("Query Raised by MOFSL", "Stage 5"),
            ("Query Resolved - Resubmitted to MOFSL", "Stage 5"), ("Account Opened", "Stage 6"), ("Communication Sent - Case Closed", "Stage 6")
        };
        foreach (var (statusName, stage) in journey)
        {
            payload["status"] = statusName;
            payload["queryDetails"] = "Workflow event";
            payload["accountNumber"] = "ACCOUNT-123";
            payload["accountOpeningDate"] = "2026-07-20";
            var (status, saved) = cases.SaveCase(payload, Operations);
            Assert.Equal(201, status);
            Assert.Equal(stage, Json(saved).GetProperty("stage").GetString());
        }
        var report = Json(reports.Report("", "", "cseName", Operations));
        var row = report.GetProperty("cases")[0];
        Assert.Equal(1, report.GetProperty("summary").GetProperty("closed").GetInt32());
        Assert.Equal(0, report.GetProperty("summary").GetProperty("open").GetInt32());
        Assert.Equal(3, row.GetProperty("queryCount").GetInt32());
        Assert.Equal("NRFT", row.GetProperty("rft").GetString());
        Assert.Equal(0, row.GetProperty("aging").GetInt32());
        Assert.Equal(14, Json(cases.GetHistory(Operations)).GetArrayLength());
    }

    [Fact]
    public async Task SessionExpiryInactiveUsersAndBadRequests()
    {
        using var client = Client();
        await Login(client, "operations", "OpsDemo@123");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/reports?start=invalid")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/reports?start=2026-08-01&end=2026-07-01")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/unknown")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/cases", new StringContent("{", System.Text.Encoding.UTF8, "application/json"))).StatusCode);
        using (var db = database.Open())
            Execute(db, "UPDATE sessions SET expires_at='2000-01-01T00:00:00'");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        await Login(client, "operations", "OpsDemo@123");
        using (var db = database.Open())
            Execute(db, "UPDATE users SET is_active=0 WHERE username='operations'");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/cases")).StatusCode);
        Assert.Null(authentication.Authenticate("operations", "OpsDemo@123"));
    }
}
