// Authored flow descriptions and source markers. Regenerate the standalone HTML with npm run guide.
export const chapters = [
  {
    id: 'foundations',
    title: 'Start from scratch',
    subtitle: 'The vocabulary, files, and startup sequence.',
    kind: 'code',
  },
  {
    id: 'access',
    title: 'Enter the workspace',
    subtitle: 'Sign in, restore a session, and understand your role.',
    kind: 'journey',
  },
  {
    id: 'workflow',
    title: 'Follow the six stages',
    subtitle: 'A request becomes a checked form, then an opened account.',
    kind: 'journey',
  },
  {
    id: 'save',
    title: 'Trace one save',
    subtitle: 'Follow a button click through validation, SQL, and audit history.',
    kind: 'code',
  },
  {
    id: 'reports',
    title: 'Understand the MIS',
    subtitle: 'Where the numbers come from and what they exclude.',
    kind: 'journey',
  },
  {
    id: 'tools',
    title: 'Upload and administer',
    subtitle: 'Bulk records, user creation, and ending a session.',
    kind: 'journey',
  },
  {
    id: 'design',
    title: 'Read and maintain the code',
    subtitle: 'SOLID choices, limitations, and verification.',
    kind: 'design',
  },
];

export const topics = [
  {
    id: 'architecture',
    chapter: 'foundations',
    title: 'What runs in the browser and on the server?',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'React displays screens. ASP.NET Core accepts requests. SQLite stores the register.',
    user: [
      'Open the application in a browser. The browser loads HTML, CSS, and a JavaScript bundle.',
      'Use the forms and tables. React updates the displayed page as its state changes.',
    ],
    system: [
      'TypeScript checks types during development; Vite compiles and bundles it for the browser.',
      'The workspace hook calls /api endpoints using JSON and the session cookie.',
      'The C# API validates permissions, writes SQLite, and calculates MIS. React displays the returned numbers.',
    ],
    data: 'Browser → api() → API middleware → endpoint → focused service → SQLite → JSON → React state.',
    note: 'The application contains only the ASP.NET Core API and React frontend. MIS calculations remain on the server.',
    sources: [
      {
        file: 'backend/dotnet/Program.cs',
        marker: 'var builder',
        end: 'app.Run();',
      },
      {
        file: 'frontend/lib.ts',
        marker: 'export async function api',
        end: 'export function formatDate',
      },
      {
        file: 'frontend/app.tsx',
        marker: 'function App()',
      },
    ],
  },
  {
    id: 'records',
    chapter: 'foundations',
    title: 'A case, an entry, and an event are different records',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'One stable Reference ID can have many operational entries and status-history events.',
    user: [
      'Create a New entry for the original request.',
      'Use its Reference ID for a resubmission, discrepancy resolution, or modification.',
    ],
    system: [
      'cases stores shared client metadata such as PAN, channel, location, and CSE.',
      'case_entries stores request IDs, process dates, owner, and the status of each operational row.',
      'status_history stores actual status changes and the authenticated actor. Foreign keys connect these records.',
    ],
    data: 'cases.id → case_entries.case_id; cases.id and case_entries.id → status_history.case_id / entry_id.',
    note: 'Adding a related entry can update shared client metadata. Reports count cases, while the register lists entries.',
    sources: [
      {
        file: 'sql/schema.sql',
        marker: 'CREATE TABLE IF NOT EXISTS cases',
        end: 'CREATE INDEX',
      },
      {
        file: 'backend/dotnet/CaseQueries.cs',
        marker: 'private const string CaseSql',
      },
    ],
  },
  {
    id: 'startup',
    chapter: 'foundations',
    title: 'Install, build, and start locally',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'Build the React assets, start the API, then open localhost.',
    user: [
      'Install Node.js 22.12+ and the .NET 10 SDK.',
      'Run npm install, npm run check, npm run build, and npm test.',
      'Run npm start and open http://127.0.0.1:4173/. For hot reload, also run npm run dev and open port 5173.',
    ],
    system: [
      'The npm scripts select the .NET SDK and build Vite assets into frontend/dist.',
      'Program.cs registers services and the system clock, initializes SQLite, and maps API endpoints.',
      'ASP.NET Core serves the built frontend; Vite development mode proxies /api to port 4173.',
    ],
    data: 'DatabasePath selects the SQLite file. ProjectRoot can override the repository root.',
    note: 'The project uses only the ASP.NET Core API and React frontend. No separate backend or legacy browser runtime is required.',
    sources: [
      {
        file: 'package.json',
        marker: '"scripts"',
        end: '"dependencies"',
      },
      {
        file: 'backend/dotnet/Program.cs',
        marker: 'var builder',
        end: 'app.Run();',
      },
      {
        file: 'vite.config.ts',
        marker: 'export default',
      },
    ],
  },
  {
    id: 'seed',
    chapter: 'foundations',
    title: 'Create only missing tables and master data',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'Startup reuses the existing database and seeds missing definitions.',
    user: [
      'Keep the existing sql/onboarding.db to retain your records.',
      'For a separate environment, set DatabasePath to a different file before starting.',
    ],
    system: [
      'DatabaseInitializer applies CREATE TABLE IF NOT EXISTS from schema.sql.',
      'INSERT OR IGNORE seeds roles, status/stage mappings, locations, segments, holidays, and the seven-day SLA.',
      'Demo users are created only when their usernames are missing. Initialization runs inside a transaction.',
    ],
    data: 'role_master, status_master, location_master, segment_master, holiday_master, settings, users.',
    note: 'Existing password hashes are retained. Replace demo credentials before shared deployment. Removing the database removes its business records.',
    sources: [
      {
        file: 'backend/dotnet/DatabaseInitializer.cs',
        marker: 'public static void Initialize',
      },
      {
        file: 'backend/dotnet/Database.cs',
        marker: 'public SqliteConnection Open',
      },
    ],
  },
  {
    id: 'restore',
    chapter: 'access',
    title: 'Open the app and restore an existing session',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'The boot screen waits for /api/auth/me before choosing login or workspace.',
    user: [
      'Open or refresh the app.',
      'If your session is still valid, the workspace appears. Otherwise, sign in.',
    ],
    system: [
      'useWorkspace calls /api/auth/me on mount and stops applying the result after unmount.',
      'The API reads the session cookie, hashes the token, and looks up an active user.',
      'Expired session rows are removed. A missing or invalid session returns 401.',
    ],
    data: 'The cookie carries a random token. sessions stores only its SHA-256 hash, expiry, and user ID.',
    note: 'An expected 401 on first launch means there is no signed-in session; it is not a broken application.',
    sources: [
      {
        file: 'frontend/useWorkspace.ts',
        marker: '  useEffect(() => {',
        end: '  async function signIn',
      },
      {
        file: 'backend/dotnet/AuthenticationService.cs',
        marker: 'public User? SessionUser',
      },
      {
        file: 'backend/dotnet/ApiSessionMiddleware.cs',
        marker: 'public static void UseApiSession',
      },
    ],
  },
  {
    id: 'login',
    chapter: 'access',
    title: 'Sign in with a username and password',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'The server checks credentials and sets a protected twelve-hour cookie.',
    user: [
      'Enter your username and password and choose Sign in.',
      'Correct active credentials open MIS Overview. Incorrect credentials show an error.',
    ],
    system: [
      'LoginScreen submits credentials to useWorkspace.signIn and POST /api/auth/login.',
      'AuthenticationService retrieves the existing salt and recalculates PBKDF2-HMAC-SHA256 with 200,000 iterations.',
      'A constant-time comparison verifies the hash. A random token is stored as a SHA-256 hash and returned through an HttpOnly, SameSite Strict cookie.',
    ],
    data: 'users.password_hash / password_salt → sessions.token_hash. The login JSON contains identity and role, not the session token.',
    note: 'HTTPS requests get Secure cookies. The Python hash/session formats remain compatible with C#.',
    sources: [
      {
        file: 'frontend/components/LoginScreen.tsx',
        marker: '  async function submit',
        end: '  return (',
      },
      {
        file: 'backend/dotnet/AuthenticationService.cs',
        marker: 'public (User User, string Token)? Authenticate',
      },
      {
        file: 'backend/dotnet/PasswordHasher.cs',
        marker: 'public static byte[] Digest',
      },
      {
        file: 'backend/dotnet/ApiEndpoints.cs',
        marker: '        app.MapPost("/api/auth/login"',
        end: '        app.MapGet("/api/auth/me"',
      },
    ],
  },
  {
    id: 'roles',
    chapter: 'access',
    title: 'Your role controls what you can see and write',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'UI controls provide guidance; server policies enforce access.',
    user: [
      'Admin manages users and all records. Operations manages case entry, edits, bulk upload, audit, and MIS.',
      'CSE works on own cases and request/resubmission/resolution statuses. MOFSL works on Stage 5/6 cases and MOFSL statuses.',
      'Viewer reads reports, the register, and audit history. RM is metadata, not a login role.',
    ],
    system: [
      'App filters navigation and CaseEntry filters status choices.',
      'ApiSessionMiddleware requires a session and restricts /api/users to admin.',
      'CaseAccessPolicy checks write status/ownership and filters read rows. The server sets CSE identity and role-specific owners itself.',
    ],
    data: 'Identity comes from the server-side session. Client-supplied changedBy or owner cannot bypass role checks.',
    note: 'MOFSL read visibility is based on the row owner or Stage 5/6; write permission still requires an existing Stage 5/6 context.',
    sources: [
      {
        file: 'backend/dotnet/CaseAccessPolicy.cs',
        marker: 'public static List<Dictionary<string, object?>> Visible',
      },
      {
        file: 'backend/dotnet/CaseAccessPolicy.cs',
        marker: 'public static List<string> AccessErrors',
      },
      {
        file: 'frontend/app.tsx',
        marker: '  const canWrite',
        end: '  return (',
      },
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'private static Dictionary<string, object?> PreparePayload',
      },
    ],
  },
  {
    id: 'load',
    chapter: 'access',
    title: 'Load the workspace without mixing old responses',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'Metadata, reports, entries, and history load together.',
    user: [
      'Wait for the initial MIS snapshot, then choose a screen.',
      'Refresh the workspace or change report filters when needed.',
    ],
    system: [
      'useWorkspace.reload loads metadata, filtered MIS, register entries, and audit concurrently. Admin also loads users.',
      'A separate unfiltered report supplies register metrics when the MIS date range is filtered.',
      'A request-version counter prevents an older response from replacing a newer filter result.',
    ],
    data: '/api/meta + /api/reports + /api/cases + /api/history + admin-only /api/users.',
    note: 'MIS date filters apply to reports. The register retains all visible entries and their unfiltered case metrics.',
    sources: [
      {
        file: 'frontend/useWorkspace.ts',
        marker: '  const reload =',
        end: '  useEffect(() => {',
      },
    ],
  },
  {
    id: 'stage1',
    chapter: 'workflow',
    title: 'Stage 1 · Receive and check the request',
    roles: ['admin', 'operations', 'cse'],
    summary: 'CSE sends the request; Operations checks whether information is complete.',
    user: [
      'Create a New entry with Request Received from CSE.',
      'Operations can record Under Review by Operations.',
      'If information is missing, Operations records Query Raised to CSE - Missing Information with details. CSE records Resubmitted by CSE after resolving it.',
    ],
    system: [
      'New saves generate a Reference ID. A query-start event increments query count and makes the case NRFT.',
      'Resubmitted by CSE closes the earliest pending stage1 query interval.',
      'CSE-related entries retain the Reference ID and are owned by Operations.',
    ],
    data: 'Example journey: Request Received → Query Raised → Resubmitted. The stage remains Stage 1.',
    note: 'Query hold uses status-event timestamps, not the manually supplied resubmission date.',
    sources: [
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'new("Request Received from CSE"',
        end: 'new("Application Form Under Preparation"',
      },
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'private static string GenerateReferenceId',
      },
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'public static (int Hold, int Queries) HoldAndQueries',
      },
    ],
  },
  {
    id: 'stage2',
    chapter: 'workflow',
    title: 'Stage 2 · Prepare and send the form',
    roles: ['admin', 'operations'],
    summary: 'Prepare the application form and send it through the chosen channel.',
    user: [
      'Record Application Form Under Preparation.',
      'For Physical channel, record Physical Form Submitted to CSE.',
      'For Digital channel, record Digital Form Sent to Client. Enter the outward date manually unless admin opts into auto-capture.',
    ],
    system: [
      'Status Master derives Stage 2 from the selected status.',
      'CaseValidator rejects physical submission with a Digital channel and digital sending with a Physical channel.',
      'Admin auto-capture fills a blank outwardDate for either sending status.',
    ],
    data: 'cases.channel + case_entries.outward_date + status_history new status.',
    note: 'Preparation/sending statuses do not themselves raise query count.',
    sources: [
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'new("Application Form Under Preparation"',
        end: 'new("Signed Form Received from CSE"',
      },
      {
        file: 'backend/dotnet/CaseValidator.cs',
        marker: 'public static List<string> Validate',
      },
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'public static readonly Dictionary<string, string> AutoDates',
        end: 'public static readonly Dictionary<string, string> ProcessDateFields',
      },
    ],
  },
  {
    id: 'stage3',
    chapter: 'workflow',
    title: 'Stage 3 · Receive and review the signed form',
    roles: ['admin', 'operations'],
    summary: 'Review the returned form and record discrepancies when necessary.',
    user: [
      'Record Signed Form Received from CSE, then Under Review - Signed Form.',
      'If there is a problem, record Discrepancy Raised to CSE or Form Returned to CSE and explain it.',
    ],
    system: [
      'Each changed status creates an audit event.',
      'Discrepancy and return events start stage3 query intervals, each counted as a qualifying query.',
      'Any qualifying query makes the case NRFT, including when it was previously RFT.',
    ],
    data: 'Signed form date is manual by default. Query details are mandatory for discrepancy/return statuses.',
    note: 'Multiple query-start events are counted individually; one resolution closes the earliest matching interval.',
    sources: [
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'new("Signed Form Received from CSE"',
        end: 'new("Discrepancy Resolution Received"',
      },
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'private static void AppendStatusHistory',
      },
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'public static (int Hold, int Queries) HoldAndQueries',
      },
    ],
  },
  {
    id: 'stage4',
    chapter: 'workflow',
    title: 'Stage 4 · Resolve discrepancies and prepare submission',
    roles: ['admin', 'operations', 'cse'],
    summary: 'CSE provides the correction; Operations confirms readiness.',
    user: [
      'CSE uses Add update and records Discrepancy Resolution Received or Resubmitted Form Received - Under Review.',
      'Operations checks the response and records Form Found in Order - Ready for MOFSL Submission.',
    ],
    system: [
      'CSE creates a related row rather than editing an earlier operational entry.',
      'Resolution statuses close the earliest pending stage3 hold interval.',
      'The readiness status maps to Stage 4 and prepares the operational handoff.',
    ],
    data: 'The same Reference ID groups the original and resolution entries.',
    note: 'Resolving the discrepancy ends that hold interval but does not change NRFT back to RFT.',
    sources: [
      {
        file: 'frontend/components/CaseEntry.tsx',
        marker: 'function initialEntry',
        end: 'export function CaseEntry',
      },
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'new("Discrepancy Resolution Received"',
        end: 'new("Submitted to MOFSL"',
      },
      {
        file: 'backend/dotnet/CaseAccessPolicy.cs',
        marker: 'public static List<string> AccessErrors',
      },
    ],
  },
  {
    id: 'stage5',
    chapter: 'workflow',
    title: 'Stage 5 · Submit to MOFSL and resolve queries',
    roles: ['admin', 'operations', 'mofsl'],
    summary: 'Operations submits the form; MOFSL can record its query or resolution.',
    user: [
      'Operations records Submitted to MOFSL and sets owner to MOFSL.',
      'MOFSL uses Add update to record Query Raised by MOFSL with details.',
      'When resolved, MOFSL records Query Resolved - Resubmitted to MOFSL.',
    ],
    system: [
      'MOFSL writes require the selected existing entry or latest related-entry context to have reached Stage 5/6.',
      'The API forces owner to MOFSL for MOFSL users.',
      'A stage5 query starts a hold interval; its resolution closes the earliest matching interval.',
    ],
    data: 'submittedDate describes the operational submission date. Audit timestamps drive query calculations.',
    note: 'A MOFSL user cannot create a brand-new case or update an earlier-stage case by submitting a forged payload.',
    sources: [
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'new("Submitted to MOFSL"',
        end: 'new("Account Opened"',
      },
      {
        file: 'backend/dotnet/CaseAccessPolicy.cs',
        marker: 'public static List<string> AccessErrors',
      },
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'private static Dictionary<string, object?> PreparePayload',
      },
    ],
  },
  {
    id: 'stage6',
    chapter: 'workflow',
    title: 'Stage 6 · Open the account and close communication',
    roles: ['admin', 'operations', 'mofsl'],
    summary: 'Record account details and complete the case.',
    user: [
      'Enter an account number and account-opening date, then record Account Opened.',
      'After communication, record Communication Sent - Case Closed.',
    ],
    system: [
      'Both statuses are classified as closed and map to Stage 6.',
      'Validation requires an account number and valid opening date. The opening date cannot precede the inward date.',
      'MIS stops gross TAT at the opening date, shows zero aging for closed status, and retains full query history.',
    ],
    data: 'case_entries.account_number / account_opening_date; closed count in MIS.',
    note: 'NRFT stays NRFT after closure. Admin can auto-fill a blank opening date on Account Opened, using the server clock.',
    sources: [
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'new("Account Opened"',
        end: 'new("On Hold"',
      },
      {
        file: 'backend/dotnet/CaseValidator.cs',
        marker: 'public static List<string> Validate',
      },
      {
        file: 'backend/dotnet/ReportService.cs',
        marker: 'private static void AddMetrics',
      },
    ],
  },
  {
    id: 'exceptions',
    chapter: 'workflow',
    title: 'Exceptions · Hold, reject, or cancel',
    roles: ['admin', 'operations', 'viewer'],
    summary: 'Exceptions remain visible; rejected/cancelled cases leave the performance base.',
    user: [
      'Operations/Admin records On Hold, Rejected, or Cancelled by Client as appropriate.',
      'Management reviews these counts alongside workload and quality.',
    ],
    system: [
      'All three statuses map to Exception.',
      'On Hold remains in the eligible RFT/TAT base and appears in attention cases.',
      'Rejected and Cancelled remain total/exception counts but are excluded from RFT percentages and average TAT.',
    ],
    data: 'Exception pipeline includes On Hold. Performance exclusions include only Rejected and Cancelled by Client.',
    note: 'On Hold alone does not start a query-hold interval. Only qualifying query/discrepancy events do. The API maps stages but does not enforce a full Stage 1→6 transition graph.',
    sources: [
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'public static readonly string[] Excluded',
        end: 'public static readonly string[] CseStatuses',
      },
      {
        file: 'backend/dotnet/ReportService.cs',
        marker: 'private static bool Eligible',
        end: 'public object Report',
      },
      {
        file: 'frontend/components/ReportingViews.tsx',
        marker: 'export function Dashboard',
      },
    ],
  },
  {
    id: 'form',
    chapter: 'save',
    title: 'Step 1 · Collect and validate the React form',
    roles: ['admin', 'operations', 'cse', 'mofsl'],
    summary: 'CaseEntry owns editable state and submits POST or PUT.',
    user: [
      'Choose New Entry or Edit/Add update from the register.',
      'Fill required fields, choose a permitted status, and choose Save entry.',
    ],
    system: [
      'CaseEntry starts with defaults or a selected row. CSE/MOFSL prepares a related update; Admin/Operations edits the selected entry.',
      'Date fields follow the selected master stage and channel. Show all process dates reveals other dates without clearing saved values.',
      'Frontend validation checks required fields, PAN, masters, dates, channel consistency, query details, and known related references.',
      'POST /api/cases creates an entry. PUT /api/cases/{id} updates an entry.',
    ],
    data: 'React form state → JSON payload. The New Reference ID field is read-only until the server generates it.',
    note: 'Frontend validation gives quick feedback; direct API callers still face all backend checks.',
    sources: [
      {
        file: 'frontend/components/CaseEntry.tsx',
        marker: '  async function save',
        end: '  function field',
      },
      {
        file: 'frontend/lib.ts',
        marker: 'export function validate',
        end: 'export function csvRecords',
      },
    ],
  },
  {
    id: 'request',
    chapter: 'save',
    title: 'Step 2 · Authenticate and route the API request',
    roles: ['admin', 'operations', 'cse', 'mofsl'],
    summary: 'Middleware resolves identity before the endpoint invokes the case service.',
    user: [
      'A valid save continues. An expired session returns to login.',
      'Malformed JSON is rejected before business data is changed.',
    ],
    system: [
      'api() sends same-origin cookies and JSON.',
      'ApiSessionMiddleware resolves the user from the session; ApiEndpoints.Payload accepts a JSON object with scalar fields.',
      'The endpoint calls CaseService.SaveCase with the server-resolved user and returns its response body/status.',
    ],
    data: 'HTTP → middleware → Current(context) + Payload(context) → SaveCase.',
    note: 'Missing sessions produce 401. Case permission failures produce 403. Invalid data produces 400.',
    sources: [
      {
        file: 'frontend/lib.ts',
        marker: 'export async function api',
        end: 'export function formatDate',
      },
      {
        file: 'backend/dotnet/ApiSessionMiddleware.cs',
        marker: 'public static void UseApiSession',
      },
      {
        file: 'backend/dotnet/ApiEndpoints.cs',
        marker: '        app.MapPost("/api/cases"',
        end: '        app.MapGet("/api/users"',
      },
      {
        file: 'backend/dotnet/ApiEndpoints.cs',
        marker: 'private static async Task<Dictionary<string, object?>> Payload',
      },
    ],
  },
  {
    id: 'validate',
    chapter: 'save',
    title: 'Step 3 · Normalize, authorize, then validate',
    roles: ['admin', 'operations', 'cse', 'mofsl'],
    summary: 'The service prepares trusted values before any persistent writes.',
    user: [
      'Review field errors and correct the form if the server rejects it.',
      'For related entries, use an existing Reference ID.',
    ],
    system: [
      'PreparePayload trims strings, uppercases PAN, normalizes valid DD-MM-YYYY dates, and applies role-specific CSE/owner values.',
      'CaseAccessPolicy checks permitted statuses, existing ownership, and stage context.',
      'CaseValidator verifies masters, controlled values, date validity, closed/query requirements, and original-case existence.',
    ],
    data: 'Normalized payload + existing case context + authenticated User.',
    note: 'PAN must match five letters, four digits, and a final letter. Invalid dates such as 31 September are rejected.',
    sources: [
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'public (int Status, object Body) SaveCase',
      },
      {
        file: 'backend/dotnet/CaseValidator.cs',
        marker: 'public static List<string> Validate',
      },
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'public static Dictionary<string, object?> Normalize',
      },
    ],
  },
  {
    id: 'persist',
    chapter: 'save',
    title: 'Step 4 · Save the case and entry in one transaction',
    roles: ['admin', 'operations', 'cse', 'mofsl'],
    summary: 'Client metadata, entry details, and status history succeed together.',
    user: [
      'After a successful save, the register reloads and displays the generated Reference ID.',
      'An invalid or denied request leaves the previous records intact.',
    ],
    system: [
      'ResolveCase finds the existing case/entry or creates the original case.',
      'UpdateClientDetails updates shared metadata. WriteEntry inserts a related entry or updates the selected row.',
      'AppendStatusHistory adds a changed-status event. The service reads the saved row and commits once. Without a commit, the transaction rolls back.',
    ],
    data: 'cases + case_entries + status_history in one SQLite transaction.',
    note: 'Editing cannot change the stable Reference ID. SQL values are bound as parameters rather than concatenated from form input.',
    sources: [
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'public (int Status, object Body) SaveCase',
      },
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'private static long WriteEntry',
      },
      {
        file: 'backend/dotnet/Database.cs',
        marker: 'private static SqliteCommand Command',
        end: 'public static List<Dictionary<string, object?>> Query',
      },
    ],
  },
  {
    id: 'audit',
    chapter: 'save',
    title: 'Step 5 · Append status history with the real actor',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'History records who changed status and supplies the query-calculation timeline.',
    user: [
      'Open Audit History to see the old status, new status, actor, owner, timestamp, and notes.',
      'A change to remarks without a status change does not add another status-history event.',
    ],
    system: [
      'For a new related entry, the previous status comes from the latest existing entry.',
      'AppendStatusHistory compares old/new status IDs and inserts only when they differ.',
      'changed_by uses User.DisplayName from the authenticated session, even if the payload includes a different name.',
    ],
    data: 'status_history is appended through the case service; there is no API to edit or delete history.',
    note: 'This is status-change audit history, not a separate audit event for every field edit.',
    sources: [
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'private static void AppendStatusHistory',
      },
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'public object GetHistory',
      },
      {
        file: 'frontend/components/ReportingViews.tsx',
        marker: 'export function AuditHistory',
        end: 'export function Dashboard',
      },
    ],
  },
  {
    id: 'dates',
    chapter: 'save',
    title: 'Automatic inward date and optional process-date capture',
    roles: ['admin', 'operations', 'cse', 'mofsl'],
    summary:
      'New cases default Inward date to today; other process dates stay manual unless an admin opts in.',
    user: [
      'Review the automatic New-case Inward date and correct it for an earlier receipt. Enter other dates when their activities happen.',
      'For a backdated status change, set Status business date. Admin can fill blank status-related dates automatically.',
    ],
    system: [
      'EntryFields defines the persisted stage date columns. CaseValidator validates them.',
      'Metadata supplies the server local date for New forms. SaveCase fills a missing New-case Inward date; supplied dates and normal edits/related entries are preserved.',
      'The API captures a business date for each status event separately from its audit recording timestamp.',
      'Admin automatic capture fills blank generic and dedicated status dates without replacing supplied dates.',
    ],
    data: 'Manual process-date fields and audit event timestamps are separate.',
    note: 'An explicit Status business date takes precedence, then the dedicated date for that status. Undated events fall back to audit dates and are marked in Case Details.',
    sources: [
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'private static Dictionary<string, object?> PreparePayload',
      },
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'public static Dictionary<string, object?> Normalize',
      },
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'public static readonly Dictionary<string, string> AutoDates',
        end: 'public static readonly Dictionary<string, string> ProcessDateFields',
      },
      {
        file: 'backend/dotnet/EntryFields.cs',
        marker: 'public static class EntryFields',
      },
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'private static object? BusinessDate',
      },
    ],
  },
  {
    id: 'touches',
    chapter: 'save',
    title: 'Count operational touches automatically',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'A touch is one successful case save.',
    user: [
      'Save a new entry or edit an existing entry. Read Touch Count in the register or Case Details.',
      'A same-status edit counts as a touch. Viewing records does not.',
    ],
    system: [
      'UpdateClientDetails increments the case counter inside the same transaction as entry persistence.',
      'Denied or invalid saves roll back; a client-supplied Touch Count is ignored.',
      'Migration initializes older cases from their saved entry count once. Subsequent saves increment automatically.',
    ],
    data: 'cases.touch_count is shared by every entry under the Reference ID.',
    note: 'Existing entry count is a minimum legacy baseline. Earlier edits were not tracked and cannot be reconstructed reliably.',
    sources: [
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'private static void UpdateClientDetails',
      },
      {
        file: 'backend/dotnet/DatabaseInitializer.cs',
        marker: 'public static void Initialize',
      },
      {
        file: 'backend/tests/ApiTests.cs',
        marker: 'public void TouchCountIsAutomaticAtomicAndCountsSameStatusSaves',
      },
    ],
  },
  {
    id: 'latest',
    chapter: 'reports',
    title: 'Choose one current row per case',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'The register has entries; MIS selects the latest entry for each case.',
    user: [
      'Apply an inward date range on MIS Overview.',
      'Use the register to view the individual entries behind a case.',
    ],
    system: [
      'CaseQueries orders entries by updated_at descending, then ID descending.',
      'ReportService.LatestCases groups by caseId and takes the first row.',
      'It finds the earliest valid inward date across the group, applies filters to that original date, and records entry count minus one as resubmissionCount.',
    ],
    data: 'Latest entry determines current status/stage. Earliest inward date determines the case TAT start.',
    note: 'The field named resubmissionCount counts all additional entries, including modifications and discrepancy resolutions.',
    sources: [
      {
        file: 'backend/dotnet/ReportService.cs',
        marker: 'private static List<Dictionary<string, object?>> LatestCases',
      },
      {
        file: 'backend/dotnet/CaseQueries.cs',
        marker: 'public static List<Dictionary<string, object?>> CaseRows',
      },
    ],
  },
  {
    id: 'queries',
    chapter: 'reports',
    title: 'Calculate query count and query hold days',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'Status-history events determine quality and waiting time.',
    user: [
      'Raise queries with the appropriate status and details.',
      'Record the matching resolution status when the response arrives.',
    ],
    system: [
      'Events are ordered by business date and event ID; older undated events use the audit date.',
      'Each query-start event enters a queue for stage1, stage3, or stage5 and increments query count.',
      'A matching resolution removes the earliest pending start. Working days in each interval contribute to hold; unresolved starts count through today.',
    ],
    data: 'RFT when queryCount is zero; NRFT when queryCount is positive.',
    note: 'Example: a Friday query resolved on Tuesday counts Monday/Tuesday, excluding listed holidays. Overlapping query intervals are counted individually, not merged.',
    sources: [
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'public static (int Hold, int Queries) HoldAndQueries',
      },
      {
        file: 'backend/dotnet/ReportService.cs',
        marker: 'private static void AddMetrics',
      },
    ],
  },
  {
    id: 'tat',
    chapter: 'reports',
    title: 'Calculate working-day TAT and SLA',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'TAT excludes weekends and Holiday Master dates; net TAT also subtracts query hold.',
    user: [
      'Read gross/net TAT and SLA breaches in MIS.',
      'Maintain correct inward/opening dates because those dates affect reporting.',
    ],
    system: [
      'WorkingDays excludes the start day and includes eligible days through the end day.',
      'Gross TAT runs from original inward date to opening date for closed cases, or today for open cases.',
      'Net TAT = max(0, gross TAT − query hold). SLA breach uses gross TAT > the configured SLA, seven working days by default.',
    ],
    data: 'Example: Friday 23 Jan 2026 → Tuesday 27 Jan, with Monday a holiday, is one working day.',
    note: 'SLA uses gross TAT, not net TAT. Rejected/cancelled cases leave the average-TAT base.',
    sources: [
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'public static int WorkingDays',
      },
      {
        file: 'backend/dotnet/ReportService.cs',
        marker: 'private static void AddMetrics',
      },
      {
        file: 'backend/tests/ApiTests.cs',
        marker: 'public void HistoryCalculationsAndExclusions',
        end: '    [Fact]',
      },
    ],
  },
  {
    id: 'stage-timing',
    chapter: 'reports',
    title: 'Measure gross TAT and SLA within each stage',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'Stage intervals accumulate across repeated visits.',
    user: [
      'Open Case Details for all six stage timings and breach flags.',
      'Use SLA Settings as Admin to change overall and per-stage limits.',
    ],
    system: [
      'StageMetrics orders business-date events and supplied milestone dates.',
      'Each interval belongs to the starting stage, with Monday-Friday working days excluding holidays. Repeated visits accumulate.',
      'A stage breach is gross stage TAT greater than its threshold, default 7 days. A skipped stage stays unknown.',
    ],
    data: 'stageTat + stageSlaBreaches + stageSlaDays in report responses.',
    note: 'Gross stage TAT includes query waiting time. Legacy events may use audit dates. Case aging and time in a stage are displayed separately.',
    sources: [
      {
        file: 'backend/dotnet/StageMetrics.cs',
        marker: 'public static Dictionary<string, int?> Calculate',
      },
      {
        file: 'backend/dotnet/ReportService.cs',
        marker: 'private static void AddMetrics',
      },
      {
        file: 'frontend/components/CaseDetails.tsx',
        marker: 'export function CaseDetails',
      },
    ],
  },
  {
    id: 'overview',
    chapter: 'reports',
    title: 'Read the overview and attention list',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'The API returns summary, pipeline, groups, and masked case details.',
    user: [
      'Review open/closed volume, RFT, average TAT, breaches, and exceptions.',
      'Use the stage pipeline to assess current workload and aging.',
      'Review up to ten open cases above SLA or currently On Hold.',
    ],
    system: [
      'ReportService aggregates eligible cases and returns the full reporting response.',
      'Dashboard renders numbers and bar widths; it does not recalculate business metrics.',
      'Finished/rejected/cancelled cases are excluded from the attention list.',
    ],
    data: 'summary + pipeline + groups + cases. PAN is removed and replaced by panMasked before report serialization.',
    note: 'Average aging uses zero for closed cases. Pipeline includes Stage 6 and Exception.',
    sources: [
      {
        file: 'backend/dotnet/ReportService.cs',
        marker: 'public object Report',
        end: 'private static List<Dictionary<string, object?>> LatestCases',
      },
      {
        file: 'frontend/components/ReportingViews.tsx',
        marker: 'export function Dashboard',
      },
    ],
  },
  {
    id: 'dimensions',
    chapter: 'reports',
    title: 'Compare CSE, location, and segment',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary:
      'Performance MIS changes the grouping dimension without changing the calculation rules.',
    user: [
      'Choose CSE, Location, or Vertical / Segment.',
      'Compare totals, RFT/NRFT, net TAT, overall/stage SLA cases, and Stage 1/3/5 query attribution.',
    ],
    system: [
      'React updates dimension and triggers a workspace reload.',
      'The API permits cseName, location, or segment and defaults unsupported dimensions to cseName.',
      'Groups use the same rejection/cancellation exclusions; missing grouping values appear as Unassigned.',
    ],
    data: 'GET /api/reports?dimension=location&start=YYYY-MM-DD&end=YYYY-MM-DD.',
    note: 'All groups are limited by your role visibility and the selected original-inward date range.',
    sources: [
      {
        file: 'frontend/components/ReportingViews.tsx',
        marker: 'export function Performance',
        end: 'export function CaseRegister',
      },
      {
        file: 'backend/dotnet/ReportService.cs',
        marker: 'public object Report',
        end: 'private static List<Dictionary<string, object?>> LatestCases',
      },
    ],
  },
  {
    id: 'register',
    chapter: 'reports',
    title: 'Search the register and start an edit or update',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'Each displayed row is an entry, with case-level metrics attached for context.',
    user: [
      'Search a reference/client or filter by status.',
      'Admin/Operations chooses Edit. CSE/MOFSL chooses Add update. Viewer has no write action.',
      'Choose Details for original inward, resubmission count, automatic touches, stage timing, SLA, and all process dates.',
    ],
    system: [
      'CaseRegister filters the visible entries locally.',
      'It joins case metrics by caseId from the unfiltered reporting snapshot.',
      'App opens CaseEntry with the selected row; initialEntry decides whether it is an exact edit or a related update.',
    ],
    data: 'PAN is masked on screen. Viewer case responses omit raw PAN; permitted operational case responses can include PAN for editing.',
    note: 'Register query/hold/TAT fields describe the current case, not only the row’s own entry status.',
    sources: [
      {
        file: 'frontend/components/ReportingViews.tsx',
        marker: 'export function CaseRegister',
        end: 'export function AuditHistory',
      },
      {
        file: 'frontend/components/CaseEntry.tsx',
        marker: 'function initialEntry',
        end: 'export function CaseEntry',
      },
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'public object GetCases',
      },
      {
        file: 'frontend/components/CaseDetails.tsx',
        marker: 'export function CaseDetails',
      },
    ],
  },
  {
    id: 'csv',
    chapter: 'tools',
    title: 'Preview and import a CSV',
    roles: ['admin', 'operations'],
    summary: 'Rows are validated locally, then each valid row uses the ordinary save API.',
    user: [
      'Download the template, fill it, and choose the CSV file.',
      'Inspect each ready/error row, then choose Import valid rows.',
      'Review Imported markers and any server failures.',
    ],
    system: [
      'csvRecords supports a BOM, quoted commas, escaped quotes, and multiline values.',
      'parseCsv maps headers, applies defaults, normalizes DD-MM-YYYY dates, and validates against known references.',
      'BulkUpload sends rows sequentially, marks successes, and keeps failures visible. It stops on session expiry.',
    ],
    data: 'Every CSV row uses POST /api/cases and the same permissions, validation, transaction, and audit rules as a form save.',
    note: 'Bulk upload is not atomic. Earlier successes remain saved if a later row fails. Successful rows cannot be imported twice in the same preview.',
    sources: [
      {
        file: 'frontend/lib.ts',
        marker: 'export function csvRecords',
        end: 'export function downloadTemplate',
      },
      {
        file: 'frontend/components/BulkUpload.tsx',
        marker: '  async function importValid',
        end: '  return (',
      },
    ],
  },
  {
    id: 'users',
    chapter: 'tools',
    title: 'Create an application user',
    roles: ['admin'],
    summary: 'Admin assigns a role and an initial password.',
    user: [
      'Open User Administration.',
      'Supply a unique username, display name, role, and password of at least eight characters.',
      'Choose Create user and review the refreshed user list.',
    ],
    system: [
      'Middleware rejects non-admin calls to /api/users.',
      'UserService validates identity fields and the role, generates a fresh salt, and stores a PBKDF2 hash.',
      'Duplicate usernames return a 400 error; the user list excludes password hashes and salts.',
    ],
    data: 'users.role_id → role_master.id. Usernames are unique without case sensitivity.',
    note: 'This screen creates users. It does not currently provide password reset, disabling, or role-edit controls.',
    sources: [
      {
        file: 'frontend/components/UserAdministration.tsx',
        marker: '  async function createUser',
        end: '  return (',
      },
      {
        file: 'backend/dotnet/UserService.cs',
        marker: 'public static long CreateUser',
      },
      {
        file: 'backend/dotnet/UserService.cs',
        marker: 'public (int, object) AddUser',
      },
    ],
  },
  {
    id: 'sla-settings',
    chapter: 'tools',
    title: 'Configure overall and stage SLA as Admin',
    roles: ['admin'],
    summary: 'SLA limits are persisted centrally.',
    user: [
      'Open SLA Settings and enter the overall and six stage thresholds in working days.',
      'Save settings to refresh reports.',
    ],
    system: [
      'GET and PUT /api/settings are protected by the API session middleware.',
      'SettingsService accepts only whole numbers from 1 to 3650 and saves all limits in one transaction.',
      'Stage limits fall back to the overall SLA when they have not been configured separately.',
    ],
    data: 'settings.sla_days and sla_stage1_days through sla_stage6_days.',
    note: 'Other roles cannot read or change administrative settings through the API.',
    sources: [
      {
        file: 'backend/dotnet/SettingsService.cs',
        marker: 'public sealed class SettingsService',
      },
      {
        file: 'backend/dotnet/ApiSessionMiddleware.cs',
        marker: 'public static void UseApiSession',
      },
      {
        file: 'frontend/components/SlaSettings.tsx',
        marker: 'export function SlaSettings',
      },
    ],
  },
  {
    id: 'logout',
    chapter: 'tools',
    title: 'Sign out or recover from session expiry',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'The server invalidates the session and React clears protected snapshots.',
    user: [
      'Choose Sign out when finished.',
      'If a request returns session-expired feedback, sign in again before continuing.',
    ],
    system: [
      'POST /api/auth/logout deletes the token hash and expires the cookie.',
      'useWorkspace.clearSession clears users, case rows, history, reports, and metadata.',
      '401 errors trigger the same clearing behavior and a login message. Request-version invalidation prevents stale data returning after sign-out.',
    ],
    data: 'The session row is deleted; business cases and history remain.',
    note: 'If sign-out fails because the server is unreachable, the UI shows the error rather than falsely claiming the server session was deleted.',
    sources: [
      {
        file: 'frontend/useWorkspace.ts',
        marker: '  const clearSession',
        end: '  const reload',
      },
      {
        file: 'frontend/useWorkspace.ts',
        marker: '  async function signOut',
        end: '  return {',
      },
      {
        file: 'backend/dotnet/AuthenticationService.cs',
        marker: 'public void Logout',
      },
    ],
  },
  {
    id: 'solid-srp',
    chapter: 'design',
    title: 'S · Give each module one clear responsibility',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'Separate HTTP, authentication, case policy, persistence, and reporting.',
    user: [
      'When debugging a screen, begin with its React component.',
      'When a calculation is wrong, begin with ReportService/Domain. When permission is wrong, begin with CaseAccessPolicy.',
    ],
    system: [
      'App coordinates navigation. useWorkspace owns session and read snapshots. CaseEntry, BulkUpload, and UserAdministration own editable local state.',
      'Program composes dependencies; ApiEndpoints and middleware handle HTTP. Focused services implement distinct use cases.',
      'CaseService.SaveCase reads as a sequence of named steps inside one transaction.',
    ],
    data: 'AuthenticationService, UserService, CaseService, ReportService, CaseAccessPolicy, CaseValidator, CaseQueries, Database, DatabaseInitializer.',
    note: 'Shared JSX primitives handle tables, panels, statuses, and errors. JSON dictionary rows deliberately preserve the legacy API contract.',
    sources: [
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'public (int Status, object Body) SaveCase',
      },
      {
        file: 'frontend/app.tsx',
        marker: 'function App()',
      },
      {
        file: 'frontend/components/shared.tsx',
        marker: 'export function Table',
        end: 'export function Panel',
      },
    ],
  },
  {
    id: 'solid-ocp',
    chapter: 'design',
    title: 'O · Put ordinary variation in data and small modules',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'Status mappings and masters feed generic reporting and display code.',
    user: [
      'Read Status Master and the mapping definitions before changing workflow behavior.',
      'Change a specific policy or calculation module rather than duplicating rules in each screen.',
    ],
    system: [
      'Stages and query-start/end mappings are persisted in Status Master and consumed by generic reporting.',
      'Locations, segments, holidays, and SLA are read from the database.',
      'Role authorization and automatic-date mappings remain explicit, centralized code.',
    ],
    data: 'A new holiday requires data, not a new WorkingDays implementation.',
    note: 'This is a practical open/closed design, not a plugin framework. Adding a new role or special status may still require policy, validation, UI, and test changes.',
    sources: [
      {
        file: 'backend/dotnet/ReportService.cs',
        marker: 'private static void AddMetrics',
      },
      {
        file: 'backend/dotnet/CaseService.cs',
        marker: 'public object GetMeta',
      },
      {
        file: 'backend/dotnet/Domain.cs',
        marker: 'public static int WorkingDays',
      },
    ],
  },
  {
    id: 'solid-lsp',
    chapter: 'design',
    title: 'L · Keep replacements compatible with their contracts',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'Use composition, and prove the real clock substitution behaves correctly.',
    user: [
      'Preserve the documented routes and JSON fields during refactoring.',
      'Run compatibility and role tests after changing authentication or saves.',
    ],
    system: [
      'Services are sealed and composed instead of creating an unnecessary service-inheritance hierarchy.',
      'TimeProvider.System and the test FixedClock satisfy the same time-provider contract.',
      'Integration tests verify password/session compatibility, status codes, and business outcomes through the real API.',
    ],
    data: 'Tests substitute time and isolated database files while exercising the same service/endpoint flow.',
    note: 'Liskov substitution concerns behavioral compatibility when replacing a dependency. It does not require every class to inherit from a base class.',
    sources: [
      {
        file: 'backend/tests/ApiTests.cs',
        marker: 'private sealed class FixedClock',
        end: '    private readonly string directory',
      },
      {
        file: 'backend/tests/ApiTests.cs',
        marker: 'public void ExistingPythonPasswordAndSessionFormatsRemainValid',
        end: '    [Fact]',
      },
    ],
  },
  {
    id: 'solid-isp',
    chapter: 'design',
    title: 'I · Keep caller contracts focused',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'Routes and screens receive the dependencies and callbacks they actually use.',
    user: [
      'Inspect a component’s Props to understand what its parent must provide.',
      'Inspect a route’s injected service to identify its backend responsibility.',
    ],
    system: [
      'A case endpoint requests CaseService; authentication endpoints request AuthenticationService; report endpoints request ReportService.',
      'CaseEntry receives case data and onSaved/onError callbacks. It does not receive user-administration behavior.',
      'The shared UI primitives accept small presentation props and do not call APIs themselves.',
    ],
    data: 'Focused component Props and service methods are the contracts used by callers.',
    note: 'TypeScript Props and C# service methods provide focused contracts without adding an interface wrapper for every concrete class.',
    sources: [
      {
        file: 'frontend/components/CaseEntry.tsx',
        marker: 'type Props',
        end: 'function initialEntry',
      },
      {
        file: 'backend/dotnet/ApiEndpoints.cs',
        marker: '        app.MapGet("/api/meta"',
        end: '        app.MapFallback(',
      },
      {
        file: 'frontend/components/shared.tsx',
        marker: 'export function Panel',
      },
    ],
  },
  {
    id: 'solid-dip',
    chapter: 'design',
    title: 'D · Inject dependencies and abstract real variation',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'The composition root supplies storage and an abstract clock to services.',
    user: [
      'Set DatabasePath for a different environment; do not hard-code it inside business operations.',
      'Use a fixed clock when testing dates, aging, and session expiry.',
    ],
    system: [
      'Program registers Database and TimeProvider.System through dependency injection.',
      'AuthenticationService, CaseService, and ReportService receive the clock through their constructors.',
      'Pure working-day and query helpers accept dates and holiday sets, independent of HTTP or filesystem state.',
    ],
    data: 'Production TimeProvider.System → service; test FixedClock → the same service.',
    note: 'Storage intentionally remains a concrete SQLite adapter. Replacing SQLite would require changes to the SQL/query layer. No claim is made that every dependency is abstracted.',
    sources: [
      {
        file: 'backend/dotnet/Program.cs',
        marker: 'builder.Services.AddSingleton',
        end: 'var app =',
      },
      {
        file: 'backend/dotnet/AuthenticationService.cs',
        marker: 'public sealed class AuthenticationService',
        end: '    public User? SessionUser',
      },
      {
        file: 'backend/tests/ApiTests.cs',
        marker: 'public void BusinessDatesAndSessionExpiryUseTheInjectedClock',
        end: '    private readonly string directory',
      },
    ],
  },
  {
    id: 'tests',
    chapter: 'design',
    title: 'Verify behavior and keep the guide current',
    roles: ['admin', 'operations', 'cse', 'mofsl', 'viewer'],
    summary: 'Automated checks protect the workflow and regenerate exact code references.',
    user: [
      'Run npm run check, npm run build, and npm test before completing changes.',
      'Run npm run format for consistent source formatting.',
      'Run npm run guide after a code change, or let npm run build regenerate this HTML.',
    ],
    system: [
      'Frontend tests check CSV, related references, dates, and API errors.',
      'Backend tests exercise all roles, six-stage completion, query calculations, validation, audit, authentication, session expiry, compatibility, and injected time.',
      'The guide generator extracts source excerpts and line ranges from the working tree. It fails if a requested code marker disappears.',
    ],
    data: 'Tests use isolated temporary databases. This guide contains source snapshots, not business records.',
    note: 'The guide explains intended user order, while documenting actual enforcement and limitations. Code excerpts are labeled with path, line range, and a short source hash.',
    sources: [
      {
        file: 'package.json',
        marker: '"scripts"',
        end: '"dependencies"',
      },
      {
        file: 'backend/tests/ApiTests.cs',
        marker: 'public void SixStageWorkflowCompletesWithAllQueryTypes',
        end: '    [Fact]',
      },
      {
        file: 'scripts/frontend-tests.mjs',
        marker: "test('CSV",
        end: "test('CSV reports",
      },
    ],
  },
];
