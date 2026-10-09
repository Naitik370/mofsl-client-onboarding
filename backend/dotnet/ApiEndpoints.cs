using System.Text.Json;
using static Onboarding.Domain;

namespace Onboarding;

public static class ApiEndpoints
{
    public static void MapOnboardingApi(this WebApplication app)
    {
        app.MapGet("/api/health", () => new { status = "ok" });
        app.MapPost("/api/auth/login", async (HttpContext context, AuthenticationService service) =>
        {
            var payload = await Payload(context);
            var result = service.Authenticate(payload.Text("username"), payload.Text("password"));
            if (result is null)
                return Results.Json(new
                {
                    error = "Invalid username or password"
                }, statusCode: 401);
            context.Response.Cookies.Append("session", result.Value.Token, SessionCookie(context));
            return Results.Json(result.Value.User);
        });
        app.MapGet("/api/auth/me", (HttpContext context) => Current(context));
        app.MapPost("/api/auth/logout", (HttpContext context, AuthenticationService service) =>
        {
            service.Logout(context.Request.Cookies["session"] ?? "");
            context.Response.Cookies.Delete("session", SessionCookie(context));
            return new
            {
                status = "ok"
            };
        });
        app.MapGet("/api/meta", (CaseService service) => service.GetMeta());
        app.MapGet("/api/settings", (SettingsService service) => service.Get());
        app.MapPut("/api/settings", async (HttpContext context, SettingsService service) =>
        {
            var (status, body) = service.Save(await Payload(context));
            return Results.Json(body, statusCode: status);
        });
        app.MapGet("/api/cases", (HttpContext context, CaseService service) => service.GetCases(Current(context)));
        app.MapPost("/api/cases", async (HttpContext context, CaseService service) =>
        {
            var (status, body) = service.SaveCase(await Payload(context), Current(context));
            return Results.Json(body, statusCode: status);
        });
        app.MapPut("/api/cases/{entryId:long}", async (long entryId, HttpContext context, CaseService service) =>
        {
            var (status, body) = service.SaveCase(await Payload(context), Current(context), entryId);
            return Results.Json(body, statusCode: status);
        });
        app.MapGet("/api/users", (UserService service) => service.GetUsers());
        app.MapPost("/api/users", async (HttpContext context, UserService service) =>
        {
            var (status, body) = service.AddUser(await Payload(context));
            return Results.Json(body, statusCode: status);
        });
        app.MapGet("/api/history", (HttpContext context, CaseService service) => service.GetHistory(Current(context)));
        app.MapGet("/api/reports", (HttpContext context, ReportService service) =>
        {
            var start = context.Request.Query["start"].ToString();
            var end = context.Request.Query["end"].ToString();
            if (start != "" && Domain.Date(start) is null || end != "" && Domain.Date(end) is null || start != "" && end != "" && string.CompareOrdinal(start, end) > 0)
                return Results.Json(new
                {
                    error = "Report dates must be valid ISO dates with start before end"
                }, statusCode: 400);
            return Results.Json(service.Report(start, end, context.Request.Query["dimension"].ToString(), Current(context)));
        });
        app.MapFallback("/api/{**path}", () => Results.Json(new { error = "API endpoint not found" }, statusCode: 404));

    }

    private static User Current(HttpContext context) => (User)context.Items["user"]!;
    private static async Task<Dictionary<string, object?>> Payload(HttpContext context)
    {
        var json = await context.Request.ReadFromJsonAsync<Dictionary<string, JsonElement>>() ?? throw new BadHttpRequestException("JSON object required");
        return json.ToDictionary(x => x.Key, x => x.Value.ValueKind switch
        {
            JsonValueKind.String => (object?)x.Value.GetString(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Number => x.Value.GetRawText(),
            JsonValueKind.Null => null,
            _ => throw new BadHttpRequestException("Scalar field required")
        });
    }
    private static CookieOptions SessionCookie(HttpContext context) => new() { HttpOnly = true, SameSite = SameSiteMode.Strict, Secure = context.Request.IsHttps, Path = "/", MaxAge = TimeSpan.FromHours(12) };

}
