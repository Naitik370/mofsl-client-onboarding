using System.Text.Json;

namespace Onboarding;

public static class ApiSessionMiddleware
{
    public static void UseApiSession(this WebApplication app)
    {
        app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/api"))
            {
                context.Response.Headers.CacheControl = "no-store";
                if (context.Request.Path != "/api/health" && context.Request.Path != "/api/auth/login")
                {
                    var user = context.RequestServices.GetRequiredService<AuthenticationService>().SessionUser(context.Request.Cookies["session"] ?? "");
                    if (user is null)
                    {
                        context.Response.StatusCode = 401;
                        await context.Response.WriteAsJsonAsync(new
                        {
                            error = "Authentication required"
                        });
                        return;
                    }
                    context.Items["user"] = user;
                    if ((context.Request.Path.StartsWithSegments("/api/users") || context.Request.Path.StartsWithSegments("/api/settings")) && user.Role != "admin")
                    {
                        context.Response.StatusCode = 403;
                        await context.Response.WriteAsJsonAsync(new
                        {
                            error = "Admin access required"
                        });
                        return;
                    }
                }
            }
            try
            {
                await next(context);
            }
            catch (BadHttpRequestException e)
            {
                context.Response.StatusCode = e.StatusCode;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "Invalid JSON request"
                });
            }
            catch (JsonException)
            {
                context.Response.StatusCode = 400;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "Invalid JSON request"
                });
            }
        });

    }
}
