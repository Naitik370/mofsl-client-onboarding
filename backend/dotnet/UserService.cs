using System.Security.Cryptography;
using Microsoft.Data.Sqlite;
using static Onboarding.Database;
using static Onboarding.Domain;

namespace Onboarding;

public sealed class UserService(Database database)
{
    private static string Now() => DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss");
    public static long CreateUser(SqliteConnection db, string username, string display, string role, string password)
    {
        if (!Roles.Contains(role))
            throw new ArgumentException("Invalid role");
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(display))
            throw new ArgumentException("Username and display name are required");
        if (password.Length < 8)
            throw new ArgumentException("Password must be at least 8 characters");
        var salt = RandomNumberGenerator.GetBytes(16);
        return Execute(db, """
            INSERT INTO users(username, display_name, role_id, password_hash, password_salt, created_at)
            VALUES ($0, $1, $2, $3, $4, $5)
            """,
            username.Trim(), display.Trim(), Lookup(db, "role_master", "role_name", role), PasswordHasher.Digest(password, salt), salt, Now());
    }

    public (int, object) AddUser(Dictionary<string, object?> payload)
    {
        try
        {
            using var db = database.Open();
            return (201, new
            {
                id = CreateUser(db, payload.Text("username"), payload.Text("displayName"), payload.Text("role"), payload.Text("password"))
            });
        }
        catch (ArgumentException e) { return (400, new { error = e.Message }); }
        catch (SqliteException e) when (e.SqliteErrorCode == 19) { return (400, new { error = "Username already exists" }); }
    }

    public object GetUsers()
    {
        using var db = database.Open();
        return Query(db, """
            SELECT u.id, u.username, u.display_name AS displayName, r.role_name AS role, u.is_active AS
            isActive, u.created_at AS createdAt FROM users u JOIN role_master r ON r.id=u.role_id ORDER BY
            u.id
            """);
    }

}
