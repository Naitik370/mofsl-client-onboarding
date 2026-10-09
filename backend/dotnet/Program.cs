using Microsoft.Extensions.FileProviders;
using Onboarding;

var builder = WebApplication.CreateBuilder(args);
var repositoryRoot = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "../.."));
var root = builder.Configuration["ProjectRoot"] ?? (File.Exists(Path.Combine(repositoryRoot, "sql/schema.sql")) ? repositoryRoot : AppContext.BaseDirectory);
var schema = File.Exists(Path.Combine(root, "sql/schema.sql")) ? Path.Combine(root, "sql/schema.sql") : Path.Combine(AppContext.BaseDirectory, "sql/schema.sql");
builder.Services.AddSingleton(new Database(builder.Configuration["DatabasePath"] ?? Path.Combine(root, "sql/onboarding.db"), schema));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<AuthenticationService>();
builder.Services.AddSingleton<UserService>();
builder.Services.AddSingleton<CaseService>();
builder.Services.AddSingleton<ReportService>();
builder.Services.AddSingleton<SettingsService>();
var app = builder.Build();
app.Services.GetRequiredService<Database>().Initialize();

app.UseApiSession();
app.MapOnboardingApi();

var frontend = Directory.Exists(Path.Combine(root, "frontend/dist")) ? Path.Combine(root, "frontend/dist") : Path.Combine(AppContext.BaseDirectory, "wwwroot");
if (Directory.Exists(frontend))
{
    var files = new PhysicalFileProvider(frontend);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = files });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = files });
    app.MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = files });
}
app.Run();

public partial class Program
{
}
