# ASP.NET Core backend walkthrough

| File | Responsibility |
| --- | --- |
| Program.cs | Composition, initialization, static frontend serving |
| ApiEndpoints.cs | REST routes and HTTP responses |
| ApiSessionMiddleware.cs | Session checks and admin route protection |
| AuthenticationService.cs, PasswordHasher.cs | Login, password hashes, sessions |
| UserService.cs | User administration |
| CaseService.cs | Transactional entry saves, automatic touches, status history |
| CaseAccessPolicy.cs, CaseValidator.cs | Authoritative permissions and validation |
| EntryFields.cs | Trusted additional field-to-column mappings |
| CaseQueries.cs | Denormalized case reads |
| ReportService.cs | Case/report aggregation and query attribution |
| StageMetrics.cs | Gross working days accumulated across stage visits |
| SettingsService.cs | Admin-only overall/per-stage SLA settings |
| Database.cs, DatabaseInitializer.cs | Parameterized SQLite access and additive migrations |
| Domain.cs | Status definitions, normalization, working days, query hold calculation |

The source directory is backend/dotnet. Tests are in backend/tests and run through npm test.

Successful saves increment cases.touch_count once in the same transaction as entry persistence. Client-supplied counts are ignored. Failed saves and reads do not increment. Migration initializes old cases with saved entry count as a minimum baseline, preserving references and history.

Status history stores event_timestamp for audit and business_date for effective timing. Explicit Status business date takes precedence over the dedicated date associated with the status; undated historical events use audit dates and are flagged in reports.

The default SLA is seven working days. Settings routes require Admin. A skipped stage has unknown timing, not zero. Repeated stage visits accumulate.

[API and deployment details](07-dotnet-react-migration.md)
