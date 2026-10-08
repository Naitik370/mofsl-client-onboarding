using System.Security.Cryptography;
using System.Text;
using static Onboarding.Database;
using static Onboarding.Domain;

namespace Onboarding;

public sealed class AuthenticationService(Database database, TimeProvider clock)
{
    private string Now() => clock.GetLocalNow().ToString("yyyy-MM-ddTHH:mm:ss");
    private static string TokenHash(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    private static User UserFrom(Dictionary<string, object?> row) => new(row.Number("id"), row.Text("username"), row.Text("displayName"), row.Text("role"));
    public (User User, string Token)? Authenticate(string username, string password)
    {
        using var db = database.Open();
        using var transaction = db.BeginTransaction();
        var row = Query(db, """
            SELECT u.id, u.username, u.display_name AS displayName, r.role_name AS role, u.password_hash,
            u.password_salt FROM users u JOIN role_master r ON r.id=u.role_id WHERE u.username=$0 COLLATE
            NOCASE AND u.is_active=1
            """, username.Trim()).FirstOrDefault();
        if (row is null || !CryptographicOperations.FixedTimeEquals((byte[])row["password_hash"]!, PasswordHasher.Digest(password, (byte[])row["password_salt"]!)))
            return null;
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        Execute(db, "INSERT INTO sessions VALUES ($0,$1,$2,$3)", TokenHash(token), row.Number("id"), clock.GetLocalNow().AddHours(12).ToString("yyyy-MM-ddTHH:mm:ss"), Now());
        transaction.Commit();
        return (UserFrom(row), token);
    }

    public User? SessionUser(string token)
    {
        if (token == "")
            return null;
        using var db = database.Open();
        Execute(db, "DELETE FROM sessions WHERE expires_at <= $0", Now());
        var row = Query(db, """
            SELECT u.id, u.username, u.display_name AS displayName, r.role_name AS role FROM sessions s JOIN
            users u ON u.id=s.user_id JOIN role_master r ON r.id=u.role_id WHERE s.token_hash=$0 AND
            u.is_active=1
            """, TokenHash(token)).FirstOrDefault();
        return row is null ? null : UserFrom(row);
    }

    public void Logout(string token)
    {
        using var db = database.Open();
        Execute(db, "DELETE FROM sessions WHERE token_hash=$0", TokenHash(token));
    }

}
