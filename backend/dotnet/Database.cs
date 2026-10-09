using static Onboarding.Domain;
using Microsoft.Data.Sqlite;

namespace Onboarding;

// SQL parameters and dictionary rows retain the existing SQLite/API contract.
public sealed class Database(string path, string schemaPath)
{
    public string SchemaPath { get; } = schemaPath;
    public SqliteConnection Open()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        var db = new SqliteConnection(new SqliteConnectionStringBuilder
        {
            DataSource = path,
            ForeignKeys = true
        }.ToString());
        db.Open();
        return db;
    }

    public static long? Lookup(SqliteConnection db, string table, string column, string name) => Query(db, $"SELECT id FROM {table} WHERE {column}=$0", name).FirstOrDefault()?.Number("id");

    private static SqliteCommand Command(SqliteConnection db, string sql, object?[] values)
    {
        var command = db.CreateCommand();
        command.CommandText = sql;
        for (var i = 0; i < values.Length; i++)
            command.Parameters.AddWithValue($"${i}", values[i] ?? DBNull.Value);
        return command;
    }

    public static long Execute(SqliteConnection db, string sql, params object?[] values)
    {
        using var command = Command(db, sql, values);
        command.ExecuteNonQuery();
        using var id = Command(db, "SELECT last_insert_rowid()", []);
        return (long)id.ExecuteScalar()!;
    }

    public static List<Dictionary<string, object?>> Query(SqliteConnection db, string sql, params object?[] values)
    {
        using var command = Command(db, sql, values);
        using var reader = command.ExecuteReader();
        var rows = new List<Dictionary<string, object?>>();
        while (reader.Read())
        {
            var row = new Dictionary<string, object?>();
            for (var i = 0; i < reader.FieldCount; i++)
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            rows.Add(row);
        }
        return rows;
    }
}
