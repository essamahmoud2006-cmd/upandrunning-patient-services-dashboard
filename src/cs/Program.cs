// UPANDRUNNING — Patient Services Daily Dashboard (C# / ASP.NET Core)
// Single-file web app + local SQLite storage. Publish with build_exe.bat to get a standalone .exe.
// Run: dotnet run   (then open http://127.0.0.1:5000)

using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using Microsoft.Data.Sqlite;

var LOCATIONS = new object[] {
    new { key = "alwasl", name = "Al Wasl Road" },
    new { key = "difc", name = "DIFC" },
    new { key = "egc", name = "Emirates Golf Club" },
    new { key = "jge", name = "Jumeirah Golf Estates" },
    new { key = "szr", name = "SZR Studio Republik" },
};

var COUNTERS = new object[] {
    new { field = "phone", name = "New booking — Phone" },
    new { field = "whatsapp", name = "New booking — WhatsApp" },
    new { field = "referral", name = "Referral booked" },
    new { field = "waitlist", name = "Waiting list slot filled" },
};

var CENTER_MAP = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
    { "sports", "alwasl" }, { "al wasl", "alwasl" }, { "al wasl road", "alwasl" },
    { "difc", "difc" },
    { "egc", "egc" }, { "emirates golf club", "egc" },
    { "jge", "jge" }, { "jumeirah golf estates", "jge" },
    { "szr", "szr" }, { "szr studio republik", "szr" }, { "studio republik", "szr" },
};

var ALLOWED_COUNTER_FIELDS = new HashSet<string> { "phone", "whatsapp", "referral", "waitlist" };

string exeDir = Path.GetDirectoryName(Environment.ProcessPath!) ?? AppContext.BaseDirectory;
Db.ConnString = $"Data Source={Path.Combine(exeDir, "dashboard.db")}";
Db.Init();

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:5000");
var app = builder.Build();

app.MapGet("/", () => Results.Content(
    INDEX_HTML
        .Replace("__LOCATIONS__", JsonSerializer.Serialize(LOCATIONS))
        .Replace("__COUNTER_DEFS__", JsonSerializer.Serialize(COUNTERS)),
    "text/html; charset=utf-8"));

app.MapGet("/api/data", (string? date) =>
{
    if (string.IsNullOrWhiteSpace(date)) return Results.Json(new { error = "date required" });
    return Results.Json(new
    {
        cancellations = Db.LoadCancellations(date),
        counters = Db.LoadCounters(date),
        logs = Db.LoadLogs(date)
    });
});

app.MapPost("/api/counter", async (HttpContext ctx) =>
{
    var b = await ctx.Request.ReadFromJsonAsync<JsonElement>();
    string date = b.GetProperty("date").GetString()!;
    string loc = b.GetProperty("location").GetString()!;
    string field = b.GetProperty("field").GetString()!;
    int delta = b.GetProperty("delta").GetInt32();
    if (!ALLOWED_COUNTER_FIELDS.Contains(field)) return Results.Json(new { error = "bad field" });
    int value = Db.AdjustCounter(date, loc, field, delta);
    return Results.Json(new { ok = true, value });
});

app.MapPost("/api/patients", async (HttpContext ctx) =>
{
    var b = await ctx.Request.ReadFromJsonAsync<JsonElement>();
    string date = b.GetProperty("date").GetString()!;
    string loc = b.GetProperty("location").GetString()!;
    string text = b.GetProperty("text").GetString()!;
    int added = Db.AddPatients(date, loc, text);
    return Results.Json(new { ok = true, added });
});

app.MapPost("/api/patient/{id}/toggle", async (HttpContext ctx) =>
{
    string id = (string)ctx.GetRouteValue("id")!;
    var b = await ctx.Request.ReadFromJsonAsync<JsonElement>();
    string date = b.GetProperty("date").GetString()!;
    bool recouped = Db.Toggle(id, date);
    return Results.Json(new { ok = true, recouped });
});

app.MapPost("/api/patient/{id}/note", async (HttpContext ctx) =>
{
    string id = (string)ctx.GetRouteValue("id")!;
    var b = await ctx.Request.ReadFromJsonAsync<JsonElement>();
    Db.SetNote(id, b.GetProperty("note").GetString()!);
    return Results.Json(new { ok = true });
});

app.MapPost("/api/patient/{id}/phone", async (HttpContext ctx) =>
{
    string id = (string)ctx.GetRouteValue("id")!;
    var b = await ctx.Request.ReadFromJsonAsync<JsonElement>();
    Db.SetPhone(id, b.GetProperty("phone").GetString()!);
    return Results.Json(new { ok = true });
});

app.MapDelete("/api/patient/{id}", async (HttpContext ctx) =>
{
    string id = (string)ctx.GetRouteValue("id")!;
    var body = await ctx.Request.ReadFromJsonAsync<JsonElement>();
    string date = body.TryGetProperty("date", out var d) ? d.GetString()! : "";
    Db.Remove(id, date);
    return Results.Json(new { ok = true });
});

app.MapPost("/api/import", async (HttpContext ctx) =>
{
    var form = await ctx.Request.ReadFormAsync();
    string date = form["date"].ToString();
    if (string.IsNullOrWhiteSpace(date)) return Results.Json(new { error = "date required" });
    List<string[]> rows;
    var file = form.Files.FirstOrDefault();
    try
    {
        if (file != null)
        {
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            var data = ms.ToArray();
            string fn = file.FileName.ToLowerInvariant();
            if (fn.EndsWith(".xlsx") || fn.EndsWith(".xls"))
                rows = ParseXlsx(data);
            else
                rows = ParseCsv(Encoding.UTF8.GetString(data).TrimStart('\uFEFF'));
        }
        else
        {
            rows = ParseCsv(form["text"].ToString());
        }
    }
    catch (Exception ex)
    {
        return Results.Json(new { error = "Could not read that file (" + ex.Message + "). Try re-exporting, or paste it in instead." });
    }
    return Results.Json(Db.ImportRows(date, rows, LOCATIONS, COUNTERS, CENTER_MAP));
});

// Open the browser once the server starts.
_ = Task.Run(async () =>
{
    await Task.Delay(1200);
    try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("cmd", "/c start http://127.0.0.1:5000") { CreateNoWindow = true }); } catch { }
});

app.Run();

// ---------------- Helpers ----------------

static string NormHeader(string? h) => Regex.Replace((h ?? "").ToLowerInvariant(), "[^a-z]", "");

static string CleanName(string? n)
{
    n = Regex.Replace(n ?? "", @"^(mrs|miss|mr|ms|dr)\.?\s*", "", RegexOptions.IgnoreCase);
    return Regex.Replace(n, @"\s+", " ").Trim();
}

static List<string[]> ParseCsv(string text)
{
    var rows = new List<string[]>();
    var fields = new List<string>();
    var sb = new StringBuilder();
    bool inQuotes = false;
    for (int i = 0; i < text.Length; i++)
    {
        char c = text[i];
        if (inQuotes)
        {
            if (c == '"')
            {
                if (i + 1 < text.Length && text[i + 1] == '"') { sb.Append('"'); i++; }
                else inQuotes = false;
            }
            else sb.Append(c);
        }
        else
        {
            if (c == '"') inQuotes = true;
            else if (c == ',') { fields.Add(sb.ToString()); sb.Clear(); }
            else if (c == '\n') { fields.Add(sb.ToString()); sb.Clear(); rows.Add(fields.ToArray()); fields.Clear(); }
            else if (c == '\r') { /* skip */ }
            else sb.Append(c);
        }
    }
    if (sb.Length > 0 || fields.Count > 0) { fields.Add(sb.ToString()); rows.Add(fields.ToArray()); }
    return rows.Where(r => r.Any(x => !string.IsNullOrWhiteSpace(x))).ToList();
}

static List<string[]> ParseXlsx(byte[] data)
{
    var rows = new List<string[]>();
    using var ms = new MemoryStream(data);
    using var wb = new XLWorkbook(ms);
    var ws = wb.Worksheets.First();
    var used = ws.RangeUsed();
    if (used == null) return rows;
    for (int r = 1; r <= used.RowCount(); r++)
    {
        var list = new List<string>();
        for (int c = 1; c <= used.ColumnCount(); c++)
            list.Add(ws.Cell(r, c).GetString());
        rows.Add(list.ToArray());
    }
    return rows;
}

// ---------------- Database ----------------

static class Db
{
    public static string ConnString = "";

    static SqliteConnection Open()
    {
        var conn = new SqliteConnection(ConnString);
        conn.Open();
        return conn;
    }

    public static void Init()
    {
        using var conn = Open();
        var cur = conn.CreateCommand();
        cur.CommandText = @"
        CREATE TABLE IF NOT EXISTS cancellation (
            id TEXT PRIMARY KEY, date TEXT NOT NULL, location TEXT NOT NULL, name TEXT NOT NULL,
            mr_no TEXT DEFAULT '', consultant TEXT DEFAULT '', reason TEXT DEFAULT '',
            phone TEXT DEFAULT '', note TEXT DEFAULT '', recouped INTEGER DEFAULT 0,
            created_at TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS daily_counter (
            id TEXT PRIMARY KEY, date TEXT NOT NULL, location TEXT NOT NULL,
            phone INTEGER DEFAULT 0, whatsapp INTEGER DEFAULT 0, referral INTEGER DEFAULT 0,
            waitlist INTEGER DEFAULT 0
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_dc ON daily_counter(date, location);
        CREATE TABLE IF NOT EXISTS activity_log (
            id TEXT PRIMARY KEY, date TEXT NOT NULL, location TEXT NOT NULL,
            label TEXT NOT NULL, ts TEXT NOT NULL
        );";
        cur.ExecuteNonQuery();
    }

    static void AddLog(SqliteConnection conn, string date, string loc, string label)
    {
        using var c = conn.CreateCommand();
        c.CommandText = "INSERT INTO activity_log (id,date,location,label,ts) VALUES (@id,@d,@l,@lb,@ts)";
        c.Parameters.AddWithValue("@id", Guid.NewGuid().ToString("N"));
        c.Parameters.AddWithValue("@d", date);
        c.Parameters.AddWithValue("@l", loc);
        c.Parameters.AddWithValue("@lb", label);
        c.Parameters.AddWithValue("@ts", DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss"));
        c.ExecuteNonQuery();
    }

    public static void EnsureCounters(string date, IEnumerable<object> locations)
    {
        using var conn = Open();
        foreach (dynamic loc in locations)
        {
            using var c = conn.CreateCommand();
            c.CommandText = "INSERT OR IGNORE INTO daily_counter (id,date,location,phone,whatsapp,referral,waitlist) VALUES (@id,@d,@l,0,0,0,0)";
            c.Parameters.AddWithValue("@id", Guid.NewGuid().ToString("N"));
            c.Parameters.AddWithValue("@d", date);
            c.Parameters.AddWithValue("@l", (string)loc.key);
            c.ExecuteNonQuery();
        }
    }

    public static List<Dictionary<string, object?>> LoadCancellations(string date)
    {
        var list = new List<Dictionary<string, object?>>();
        using var conn = Open();
        using var c = conn.CreateCommand();
        c.CommandText = "SELECT * FROM cancellation WHERE date=@d ORDER BY created_at DESC";
        c.Parameters.AddWithValue("@d", date);
        using var r = c.ExecuteReader();
        while (r.Read())
        {
            list.Add(new Dictionary<string, object?>
            {
                ["id"] = r.GetString(0),
                ["date"] = r.GetString(1),
                ["location"] = r.GetString(2),
                ["name"] = r.GetString(3),
                ["mr_no"] = r.IsDBNull(4) ? "" : r.GetString(4),
                ["consultant"] = r.IsDBNull(5) ? "" : r.GetString(5),
                ["reason"] = r.IsDBNull(6) ? "" : r.GetString(6),
                ["phone"] = r.IsDBNull(7) ? "" : r.GetString(7),
                ["note"] = r.IsDBNull(8) ? "" : r.GetString(8),
                ["recouped"] = r.GetInt32(9) == 1,
                ["created_at"] = r.IsDBNull(10) ? "" : r.GetString(10),
            });
        }
        return list;
    }

    public static Dictionary<string, Dictionary<string, object?>> LoadCounters(string date, IEnumerable<object>? locations = null)
    {
        var dict = new Dictionary<string, Dictionary<string, object?>>();
        using var conn = Open();
        if (locations != null) EnsureCounters(date, locations);
        using var c = conn.CreateCommand();
        c.CommandText = "SELECT * FROM daily_counter WHERE date=@d";
        c.Parameters.AddWithValue("@d", date);
        using var r = c.ExecuteReader();
        while (r.Read())
        {
            dict[r.GetString(2)] = new Dictionary<string, object?>
            {
                ["id"] = r.GetString(0),
                ["date"] = r.GetString(1),
                ["location"] = r.GetString(2),
                ["phone"] = r.GetInt32(3),
                ["whatsapp"] = r.GetInt32(4),
                ["referral"] = r.GetInt32(5),
                ["waitlist"] = r.GetInt32(6),
            };
        }
        return dict;
    }

    public static Dictionary<string, List<Dictionary<string, object?>>> LoadLogs(string date)
    {
        var outDict = new Dictionary<string, List<Dictionary<string, object?>>>();
        using var conn = Open();
        using var c = conn.CreateCommand();
        c.CommandText = "SELECT * FROM activity_log WHERE date=@d ORDER BY ts DESC LIMIT 500";
        c.Parameters.AddWithValue("@d", date);
        using var r = c.ExecuteReader();
        while (r.Read())
        {
            string loc = r.GetString(2);
            if (!outDict.ContainsKey(loc)) outDict[loc] = new List<Dictionary<string, object?>>();
            outDict[loc].Add(new Dictionary<string, object?>
            {
                ["id"] = r.GetString(0),
                ["date"] = r.GetString(1),
                ["location"] = loc,
                ["label"] = r.GetString(3),
                ["ts"] = r.GetString(4),
            });
        }
        return outDict;
    }

    public static int AdjustCounter(string date, string loc, string field, int delta)
    {
        using var conn = Open();
        EnsureCounters(date, new[] { new { key = loc, name = "" } });
        int current = 0; string id = "";
        using (var c = conn.CreateCommand())
        {
            c.CommandText = "SELECT id, " + field + " FROM daily_counter WHERE date=@d AND location=@l";
            c.Parameters.AddWithValue("@d", date);
            c.Parameters.AddWithValue("@l", loc);
            using var r = c.ExecuteReader();
            if (r.Read()) { id = r.GetString(0); current = r.IsDBNull(1) ? 0 : r.GetInt32(1); }
        }
        int newVal = Math.Max(0, current + delta);
        using (var c = conn.CreateCommand())
        {
            c.CommandText = "UPDATE daily_counter SET " + field + "=@v WHERE id=@id";
            c.Parameters.AddWithValue("@v", newVal);
            c.Parameters.AddWithValue("@id", id);
            c.ExecuteNonQuery();
        }
        if (delta > 0)
        {
            string label = field; // replaced below
            AddLog(conn, date, loc, "Counter +1 (" + field + ")");
        }
        return newVal;
    }

    public static int AddPatients(string date, string loc, string text)
    {
        var names = text.Split('\n', StringSplitOptions.None)
            .Select(CleanName)
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Distinct()
            .ToList();
        if (names.Count == 0) return 0;
        using var conn = Open();
        var ts = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss");
        foreach (var name in names)
        {
            using var c = conn.CreateCommand();
            c.CommandText = @"INSERT INTO cancellation (id,date,location,name,mr_no,consultant,reason,phone,note,recouped,created_at)
                              VALUES (@id,@d,@l,@n,'','','','',0,@ts)";
            c.Parameters.AddWithValue("@id", Guid.NewGuid().ToString("N"));
            c.Parameters.AddWithValue("@d", date);
            c.Parameters.AddWithValue("@l", loc);
            c.Parameters.AddWithValue("@n", name);
            c.Parameters.AddWithValue("@ts", ts);
            c.ExecuteNonQuery();
        }
        AddLog(conn, date, loc, $"Added {names.Count} patient{(names.Count == 1 ? "" : "s")} from cancellations report");
        return names.Count;
    }

    public static bool Toggle(string id, string date)
    {
        using var conn = Open();
        string loc = "", name = ""; int rec = 0;
        using (var c = conn.CreateCommand())
        {
            c.CommandText = "SELECT location,name,recouped FROM cancellation WHERE id=@id";
            c.Parameters.AddWithValue("@id", id);
            using var r = c.ExecuteReader();
            if (!r.Read()) return false;
            loc = r.GetString(0); name = r.GetString(1); rec = r.GetInt32(2);
        }
        int newVal = rec == 1 ? 0 : 1;
        using (var c = conn.CreateCommand())
        {
            c.CommandText = "UPDATE cancellation SET recouped=@v WHERE id=@id";
            c.Parameters.AddWithValue("@v", newVal);
            c.Parameters.AddWithValue("@id", id);
            c.ExecuteNonQuery();
        }
        AddLog(conn, date, loc, (newVal == 1 ? "Recouped — " : "Unmarked — ") + name);
        return newVal == 1;
    }

    public static void SetNote(string id, string note)
    {
        using var conn = Open();
        using var c = conn.CreateCommand();
        c.CommandText = "UPDATE cancellation SET note=@n WHERE id=@id";
        c.Parameters.AddWithValue("@n", note);
        c.Parameters.AddWithValue("@id", id);
        c.ExecuteNonQuery();
    }

    public static void SetPhone(string id, string phone)
    {
        using var conn = Open();
        using var c = conn.CreateCommand();
        c.CommandText = "UPDATE cancellation SET phone=@p WHERE id=@id";
        c.Parameters.AddWithValue("@p", phone);
        c.Parameters.AddWithValue("@id", id);
        c.ExecuteNonQuery();
    }

    public static void Remove(string id, string date)
    {
        using var conn = Open();
        string loc = "", name = "";
        using (var c = conn.CreateCommand())
        {
            c.CommandText = "SELECT location,name FROM cancellation WHERE id=@id";
            c.Parameters.AddWithValue("@id", id);
            using var r = c.ExecuteReader();
            if (r.Read()) { loc = r.GetString(0); name = r.GetString(1); }
        }
        using (var c = conn.CreateCommand())
        {
            c.CommandText = "DELETE FROM cancellation WHERE id=@id";
            c.Parameters.AddWithValue("@id", id);
            c.ExecuteNonQuery();
        }
        if (!string.IsNullOrEmpty(name)) AddLog(conn, date, loc, "Removed — " + name);
    }

    public static Dictionary<string, object?> ImportRows(string date, List<string[]> rows, object[] locations, object[] counters, Dictionary<string, string> centerMap)
    {
        int headerIdx = -1;
        string[]? headerFields = null;
        for (int i = 0; i < rows.Count; i++)
        {
            var norm = rows[i].Select(NormHeader).ToArray();
            if (norm.Any(h => h == "patientname")) { headerIdx = i; headerFields = rows[i]; break; }
        }
        if (headerIdx == -1)
            return new Dictionary<string, object?> { ["error"] = "Could not find a “Patient Name” column. Make sure the header row is intact." };

        var normHeaders = headerFields!.Select(NormHeader).ToArray();
        int idx(string name) => Array.IndexOf(normHeaders, name);
        int idxContains(string frag) => Array.FindIndex(normHeaders, h => h.Contains(frag));
        int colCenter = idx("centername");
        int colMrno = idx("mrno");
        int colConsultant = idx("consultant");
        int colPatient = idx("patientname");
        int colReason = idx("cancelreason");
        int colPhone = idxContains("mobile") >= 0 ? idxContains("mobile") : (idxContains("phone") >= 0 ? idxContains("phone") : (idxContains("contact") >= 0 ? idxContains("contact") : (idxContains("tel") >= 0 ? idxContains("tel") : -1)));
        int colLast = headerFields.Length - 1;

        var existing = LoadCancellations(date);
        var perNew = new Dictionary<string, int>();
        var perDup = new Dictionary<string, int>();
        var unmapped = new Dictionary<string, int>();
        int totalNew = 0, totalDup = 0, totalUnmapped = 0;
        var toCreate = new List<(string id, string loc, string name, string mrno, string consultant, string reason, string phone, int recouped)>();
        var ts = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss");

        for (int ri = headerIdx + 1; ri < rows.Count; ri++)
        {
            var r = rows[ri];
            var fields = r.Select((c, i) => (i < r.Length ? (c ?? "").Trim() : "")).ToList();
            if (fields.Count < 2 || !fields.Any(x => !string.IsNullOrWhiteSpace(x))) continue;
            string centerRaw = colCenter >= 0 && colCenter < fields.Count ? fields[colCenter] : "";
            string patientRaw = colPatient >= 0 && colPatient < fields.Count ? fields[colPatient] : "";
            if (string.IsNullOrWhiteSpace(patientRaw)) continue;
            string? locKey = null;
            if (!string.IsNullOrWhiteSpace(centerRaw) && centerMap.TryGetValue(centerRaw, out var mapped))
                locKey = mapped;
            if (locKey == null)
            {
                if (!string.IsNullOrWhiteSpace(centerRaw))
                {
                    unmapped[centerRaw] = unmapped.GetValueOrDefault(centerRaw) + 1;
                    totalUnmapped++;
                }
                continue;
            }
            string name = CleanName(patientRaw);
            if (string.IsNullOrEmpty(name)) continue;
            string mrno = colMrno >= 0 && colMrno < fields.Count ? fields[colMrno] : "";
            string consultant = colConsultant >= 0 && colConsultant < fields.Count ? fields[colConsultant] : "";
            string reason = colReason >= 0 && colReason < fields.Count ? fields[colReason] : "";
            string phone = colPhone >= 0 && colPhone < fields.Count ? fields[colPhone] : "";
            string lastVal = colLast >= 0 && colLast < fields.Count ? fields[colLast].ToLowerInvariant() : "";
            int recouped = lastVal == "booked" ? 1 : 0;
            bool isDup = existing.Any(p =>
                (!string.IsNullOrEmpty(mrno) && !string.IsNullOrEmpty((string)p["mr_no"]!) && (string)p["mr_no"]! == mrno) ||
                (((string)p["name"]!).ToLowerInvariant() == name.ToLowerInvariant()));
            if (isDup) { perDup[locKey] = perDup.GetValueOrDefault(locKey) + 1; totalDup++; continue; }
            toCreate.Add((Guid.NewGuid().ToString("N"), locKey, name, mrno, consultant, reason, phone, recouped));
            perNew[locKey] = perNew.GetValueOrDefault(locKey) + 1;
            totalNew++;
        }

        using var conn = Open();
        foreach (var t in toCreate)
        {
            using var c = conn.CreateCommand();
            c.CommandText = @"INSERT INTO cancellation (id,date,location,name,mr_no,consultant,reason,phone,note,recouped,created_at)
                              VALUES (@id,@d,@l,@n,@mr,@co,@re,@ph,'',@rc,@ts)";
            c.Parameters.AddWithValue("@id", t.id);
            c.Parameters.AddWithValue("@d", date);
            c.Parameters.AddWithValue("@l", t.loc);
            c.Parameters.AddWithValue("@n", t.name);
            c.Parameters.AddWithValue("@mr", t.mrno);
            c.Parameters.AddWithValue("@co", t.consultant);
            c.Parameters.AddWithValue("@re", t.reason);
            c.Parameters.AddWithValue("@ph", t.phone);
            c.Parameters.AddWithValue("@rc", t.recouped);
            c.Parameters.AddWithValue("@ts", ts);
            c.ExecuteNonQuery();
        }
        foreach (var kv in perNew)
            AddLog(conn, date, kv.Key, $"Imported {kv.Value} patient{(kv.Value == 1 ? "" : "s")} from cancellations report");

        return new Dictionary<string, object?>
        {
            ["totalNew"] = totalNew,
            ["totalDup"] = totalDup,
            ["totalUnmapped"] = totalUnmapped,
            ["perLocationNew"] = perNew,
            ["unmapped"] = unmapped,
        };
    }
}

// ---------------- Embedded HTML ----------------
// Placeholders __LOCATIONS__ and __COUNTER_DEFS__ are replaced server-side.
static readonly string INDEX_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>UPANDRUNNING Patient Services Dashboard</title>
<style>
  :root { --teal:#006272; --teal-dark:#004a56; --light-teal:#E6EEEF; --orange:#E87722; --text:#333; --muted:#777; --border:#ddd; --bg:#FAFAFA; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:-apple-system,"Segoe UI",Arial,sans-serif; background:var(--bg); color:var(--text); }
  #app { max-width:1100px; margin:0 auto; padding:20px 20px 60px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:18px; }
  .brand .name { font-weight:800; letter-spacing:.5px; color:var(--teal); font-size:20px; }
  .brand .subtitle { color:var(--muted); font-size:13px; letter-spacing:.3px; text-transform:uppercase; margin-top:2px; }
  .date-picker { display:flex; align-items:center; gap:8px; }
  .date-picker button { border:1px solid var(--border); background:#fff; border-radius:6px; width:32px; height:32px; font-size:16px; cursor:pointer; color:var(--teal); }
  .date-picker button:hover { background:var(--light-teal); }
  .date-picker input[type=date] { border:1px solid var(--border); border-radius:6px; padding:6px 10px; font-size:14px; }
  .today-btn { border:1px solid var(--teal); color:var(--teal); background:#fff; border-radius:6px; padding:6px 10px; font-size:13px; cursor:pointer; }
  .today-btn:hover { background:var(--light-teal); }
  .tabs { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:20px; border-bottom:2px solid var(--border); padding-bottom:10px; }
  .tab { padding:8px 14px; border-radius:20px; font-size:13px; font-weight:600; cursor:pointer; border:1px solid var(--border); background:#fff; color:var(--muted); white-space:nowrap; }
  .tab.active { background:var(--teal); border-color:var(--teal); color:#fff; }
  .tab:hover:not(.active) { background:var(--light-teal); }
  .cards-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:20px; }
  .card { background:#fff; border:1px solid var(--border); border-radius:10px; padding:14px 16px; }
  .card .label { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.4px; margin-bottom:6px; }
  .card .value { font-size:28px; font-weight:700; color:var(--teal); }
  .card .value.orange { color:var(--orange); }
  .card .sub { font-size:12px; color:var(--muted); margin-top:4px; }
  .section-title { font-size:14px; font-weight:700; color:var(--teal); text-transform:uppercase; letter-spacing:.4px; margin:24px 0 10px; }
  .counter-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
  .counter-card { background:#fff; border:1px solid var(--border); border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; gap:10px; }
  .counter-top { display:flex; justify-content:space-between; align-items:center; }
  .counter-top .count { font-size:24px; font-weight:700; color:var(--teal); }
  .counter-buttons { display:flex; gap:8px; }
  .counter-buttons button { flex:1; border:none; border-radius:8px; padding:10px 0; font-size:16px; font-weight:700; cursor:pointer; }
  .btn-plus { background:var(--teal); color:#fff; } .btn-plus:hover { background:var(--teal-dark); }
  .btn-minus { background:var(--light-teal); color:var(--teal); } .btn-minus:hover { background:#d3e2e4; }
  .patient-panel { background:#fff; border:1px solid var(--border); border-radius:10px; padding:14px 16px; margin-bottom:20px; }
  .patient-panel-head .title { font-size:13px; font-weight:700; color:var(--teal); text-transform:uppercase; letter-spacing:.4px; }
  .paste-row { display:flex; gap:8px; margin-bottom:12px; }
  .paste-row textarea { flex:1; border:1px solid var(--border); border-radius:6px; padding:8px 10px; font-size:13px; resize:vertical; min-height:40px; }
  .paste-row button, .add-one-btn { border:none; background:var(--teal); color:#fff; border-radius:6px; padding:0 16px; font-size:13px; font-weight:600; cursor:pointer; }
  .paste-row button:hover, .add-one-btn:hover { background:var(--teal-dark); }
  .paste-hint { font-size:11px; color:var(--muted); margin:-6px 0 12px; }
  .patient-list { display:flex; flex-direction:column; gap:6px; }
  .patient-row { display:flex; align-items:flex-start; gap:10px; padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--bg); }
  .patient-row.recouped { background:var(--light-teal); border-color:#bcdadd; }
  .patient-row input[type=checkbox] { width:18px; height:18px; cursor:pointer; flex-shrink:0; margin-top:2px; }
  .patient-row .p-name { flex:1; font-size:13px; font-weight:600; }
  .patient-row.recouped .p-name { text-decoration:line-through; color:var(--muted); }
  .patient-row .p-note, .patient-row .p-phone { font-size:12px; border:1px solid transparent; background:transparent; padding:3px 6px; border-radius:6px; }
  .patient-row .p-note { color:var(--muted); width:160px; flex-shrink:0; }
  .patient-row .p-phone { color:var(--text); width:118px; flex-shrink:0; }
  .patient-row .p-phone:hover, .patient-row .p-phone:focus { border-color:var(--border); background:#fff; }
  .patient-row .p-call { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:50%; background:var(--teal); color:#fff; text-decoration:none; font-size:13px; }
  .patient-row .p-call:hover { background:var(--teal-dark); }
  .patient-row .p-remove { border:none; background:transparent; color:var(--muted); cursor:pointer; font-size:15px; }
  .patient-row .p-remove:hover { color:var(--orange); }
  .log-box { background:#fff; border:1px solid var(--border); border-radius:10px; padding:4px 16px; max-height:260px; overflow-y:auto; }
  .log-row { display:flex; gap:12px; padding:8px 0; border-bottom:1px solid #f0f0f0; font-size:13px; }
  .log-row:last-child { border-bottom:none; }
  .log-time { color:var(--muted); min-width:64px; }
  table.summary { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--border); border-radius:10px; overflow:hidden; }
  table.summary th, table.summary td { padding:10px 12px; text-align:center; font-size:13px; border-bottom:1px solid #f0f0f0; }
  table.summary th { background:var(--teal); color:#fff; font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:.3px; }
  table.summary td:first-child, table.summary th:first-child { text-align:left; }
  table.summary tr.total-row td { font-weight:700; background:var(--light-teal); }
  .loading { text-align:center; color:var(--muted); padding:40px 0; font-size:14px; }
  .footer-note { margin-top:28px; font-size:12px; color:var(--muted); text-align:center; }
</style>
</head>
<body>
<div id="app"><div class="loading">Loading dashboard...</div></div>
<script>
const LOCATIONS = __LOCATIONS__;
const COUNTER_DEFS = __COUNTER_DEFS__;
let state = { date: todayStr(), activeTab: "all", data: null, importSummary: null };
function todayStr(){ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function fmtTime(ts){ const d=new Date(ts); let h=d.getHours(); const m=String(d.getMinutes()).padStart(2,"0"); const ap=h>=12?"PM":"AM"; h=h%12; if(!h)h=12; return h+":"+m+" "+ap; }
function fmtDateHuman(s){ const d=new Date(s+"T00:00:00"); return d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); }
function esc(s){ const d=document.createElement("div"); d.textContent=s==null?"":String(s); return d.innerHTML; }
function newTotal(c){ return (c.phone||0)+(c.whatsapp||0)+(c.referral||0)+(c.waitlist||0); }
async function api(path, opts){ const res=await fetch(path, opts); if(!res.ok){ const e=await res.json().catch(()=>({})); throw new Error(e.error||("Request failed ("+res.status+")")); } return res.json(); }
async function load(){ state.data = await api("/api/data?date="+state.date); render(); }
function shiftDate(days){ const d=new Date(state.date+"T00:00:00"); d.setDate(d.getDate()+days); state.date=d.toISOString().slice(0,10); refresh(); }
function onDateChange(v){ if(!v)return; state.date=v; refresh(); }
function goToday(){ state.date=todayStr(); refresh(); }
function refresh(){ document.getElementById("app").innerHTML='<div class="loading">Loading dashboard...</div>'; load(); }
function setActiveTab(k){ state.activeTab=k; render(); }
async function adjustCounter(locKey, field, delta){ try{ await api("/api/counter",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:state.date,location:locKey,field,delta})}); await load(); }catch(e){ alert(e.message); } }
async function addPatients(locKey, text){ try{ await api("/api/patients",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:state.date,location:locKey,text})}); await load(); }catch(e){ alert(e.message); } }
async function submitPaste(locKey){ const a=document.getElementById("paste-"+locKey); if(!a||!a.value.trim())return; const t=a.value; a.value=""; await addPatients(locKey,t); }
async function addSingle(locKey){ const i=document.getElementById("single-"+locKey); if(!i||!i.value.trim())return; const t=i.value; i.value=""; await addPatients(locKey,t); }
async function toggle(pid){ try{ await api("/api/patient/"+pid+"/toggle",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:state.date})}); await load(); }catch(e){ alert(e.message); } }
async function saveNote(pid,val){ await api("/api/patient/"+pid+"/note",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({note:val})}); }
async function savePhone(pid,val){ await api("/api/patient/"+pid+"/phone",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:val})}); await load(); }
async function removePatient(pid){ if(!confirm("Remove this patient?"))return; try{ await api("/api/patient/"+pid,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:state.date})}); await load(); }catch(e){ alert(e.message); } }
async function importFile(file){ if(!file)return; const fd=new FormData(); fd.append("file",file); fd.append("date",state.date); try{ state.importSummary=await api("/api/import",{method:"POST",body:fd}); await load(); render(); }catch(e){ state.importSummary={error:e.message}; render(); } }
async function importPaste(){ const a=document.getElementById("csv-area"); if(!a||!a.value.trim())return; const fd=new FormData(); fd.append("text",a.value); fd.append("date",state.date); a.value=""; try{ state.importSummary=await api("/api/import",{method:"POST",body:fd}); await load(); render(); }catch(e){ state.importSummary={error:e.message}; render(); } }
function dismissSummary(){ state.importSummary=null; render(); }
function recoupCount(cancs){ return cancs.filter(p=>p.recouped).length; }
function recoupRate(cancs){ const t=cancs.length; return t?Math.round(recoupCount(cancs)/t*100):null; }
function render(){ const app=document.getElementById("app"); const all=state.activeTab==="all"; let h=""; h+='<div class="header"><div class="brand"><div class="name">UPANDRUNNING</div><div class="subtitle">Patient Services Daily Dashboard</div></div>'; h+='<div class="date-picker"><button onclick="shiftDate(-1)">&#8249;</button><input type="date" value="'+state.date+'" onchange="onDateChange(this.value)"/><button onclick="shiftDate(1)">&#8250;</button><button class="today-btn" onclick="goToday()">Today</button></div></div>'; h+='<div style="font-size:13px;color:var(--muted);margin-bottom:14px;">'+fmtDateHuman(state.date)+'</div>'; h+='<div class="tabs"><div class="tab '+(all?"active":"")+'" onclick="setActiveTab(\'all\')">All Locations</div>'; LOCATIONS.forEach(l=>{ h+='<div class="tab '+(state.activeTab===l.key?"active":"")+'" onclick="setActiveTab(\''+l.key+'\')">'+l.name+'</div>'; }); h+='</div>'; h+= all? renderAll() : renderLocation(state.activeTab); h+='<div class="footer-note">Changes save automatically to a local SQLite database.</div>'; app.innerHTML=h; }
function card(label,value,sub,orange){ return '<div class="card"><div class="label">'+label+'</div><div class="value'+(orange?' orange':'')+'">'+value+'</div>'+(sub?'<div class="sub">'+sub+'</div>':'')+'</div>'; }
function renderAll(){ let h=""; if(state.importSummary){ const s=state.importSummary; h+='<div style="background:var(--light-teal);border:1px solid #bcdadd;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;">'; if(s.error){ h+='<div style="color:var(--orange);font-weight:600;">Import did not run</div><div>'+esc(s.error)+'</div>'; } else{ h+='<div style="font-weight:700;color:var(--teal);margin-bottom:6px;">Import complete</div><div>'+s.totalNew+' patient'+(s.totalNew===1?'':'s')+' added'+(s.totalDup?(", "+s.totalDup+" already on today's list (skipped)"):'')+'.</div>'; if(s.unmapped&&Object.keys(s.unmapped).length){ h+='<div style="margin-top:6px;color:var(--orange);">Not imported: '+Object.keys(s.unmapped).map(k=>k+" ("+s.unmapped[k]+")").join(", ")+'</div>'; } } h+='<button onclick="dismissSummary()" style="margin-top:8px;border:none;background:transparent;color:var(--teal);font-size:12px;font-weight:600;cursor:pointer;">Dismiss</button></div>'; }
  h+='<div class="patient-panel"><div class="patient-panel-head"><span class="title">Import daily cancellations report</span></div>'; h+='<input type="file" id="report-file" accept=".csv,.txt,.xlsx,.xls" style="display:none" onchange="importFile(this.files[0])"/>'; h+='<div style="display:flex;gap:12px;align-items:center;margin-bottom:8px;"><button onclick="document.getElementById(\'report-file\').click()" style="border:none;background:var(--teal);color:#fff;border-radius:6px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;">Choose file</button><span style="font-size:12px;color:var(--muted);" id="file-name">No file chosen</span></div>'; h+='<div class="paste-hint">Download the cancellations report from Insta HMS (.csv or .xlsx) and choose it here. Patients are sorted into the right location automatically; anyone already showing as Booked is pre-ticked as recouped. Imports go into '+fmtDateHuman(state.date)+'.</div>'; h+='<details><summary style="font-size:12px;color:var(--teal);cursor:pointer;">Or paste the report text instead</summary><div class="paste-row" style="margin-top:8px;"><textarea id="csv-area" placeholder="Paste the full report here, including its header row" style="min-height:70px;"></textarea><button onclick="importPaste()">Import</button></div></details></div>';
  let tc=0,tr=0,tp=0,tw=0,tf=0,twl=0,rows=""; LOCATIONS.forEach(l=>{ const cancs=state.data.cancellations.filter(p=>p.location===l.key); const c=state.data.counters[l.key]||{phone:0,whatsapp:0,referral:0,waitlist:0}; const rate=recoupRate(cancs); const carried=cancs.length; const rn=recoupCount(cancs); const nt=newTotal(c); tc+=carried;tr+=rn;tp+=c.phone||0;tw+=c.whatsapp||0;tf+=c.referral||0;twl+=c.waitlist||0; rows+="<tr><td>"+l.name+"</td><td>"+carried+"</td><td>"+rn+"</td><td>"+(rate===null?"\u2014":rate+"%")+"</td><td>"+(c.phone||0)+"</td><td>"+(c.whatsapp||0)+"</td><td>"+(c.referral||0)+"</td><td>"+(c.waitlist||0)+"</td><td>"+nt+"</td></tr>"; });
  const tr2=tc?Math.round(tr/tc*100):null; const gnt=tp+tw+tf+twl; rows+='<tr class="total-row"><td>All locations</td><td>'+tc+'</td><td>'+tr+'</td><td>'+(tr2===null?"\u2014":tr2+"%")+'</td><td>'+tp+'</td><td>'+tw+'</td><td>'+tf+'</td><td>'+twl+'</td><td>'+gnt+'</td></tr>';
  h+='<div class="cards-row">'+card("Carried from yesterday",tc,"")+card("Recouped",tr,"",true)+card("Recoup rate",tr2===null?"\u2014":tr2+"%","")+card("New appointments today",gnt,"",true)+'</div>';
  h+='<div class="section-title">By location</div>'; h+='<table class="summary"><thead><tr><th>Location</th><th>Carried</th><th>Recouped</th><th>Recoup rate</th><th>Phone</th><th>WhatsApp</th><th>Referral</th><th>Waitlist</th><th>New total</th></tr></thead><tbody>'+rows+'</tbody></table>'; return h; }
function renderLocation(locKey){ const loc=LOCATIONS.find(l=>l.key===locKey); const cancs=state.data.cancellations.filter(p=>p.location===locKey); const c=state.data.counters[locKey]||{phone:0,whatsapp:0,referral:0,waitlist:0}; const carried=cancs.length; const rn=recoupCount(cancs); const rate=recoupRate(cancs); const nt=newTotal(c); let h='<div class="cards-row">'+card("Carried from yesterday",carried,"")+card("Recouped",rn,"",true)+card("Recoup rate",rate===null?"\u2014":rate+"%",rate!==null&&rate>=80?"On target":"")+card("New appointments today",nt,"",true)+'</div>';
  h+='<div class="patient-panel"><div class="patient-panel-head"><span class="title">Cancellations / no-shows \u2014 '+loc.name+'</span></div>'; h+='<div class="paste-row"><textarea id="paste-'+locKey+'" placeholder="Paste patient names from today\'s cancellations report, one per line"></textarea><button onclick="submitPaste(\''+locKey+'\')">Add list</button></div>'; h+='<div class="paste-hint">Copy the patient name column and paste above, or add one at a time below.</div>'; h+='<div class="paste-row"><input id="single-'+locKey+'" type="text" placeholder="Patient name" style="flex:1;border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:13px;" onkeydown="if(event.key===\'Enter\'){addSingle(\''+locKey+'\');}"/><button class="add-one-btn" onclick="addSingle(\''+locKey+'\')">Add</button></div>';
  h+='<div class="patient-list">'; if(cancs.length){ cancs.forEach(p=>{ const meta=[p.mr_no,p.consultant,p.reason].filter(Boolean).join(" \u00b7 "); const digits=(p.phone||"").replace(/[^0-9+]/g,""); h+='<div class="patient-row'+(p.recouped?' recouped':'')+'"><input type="checkbox" '+(p.recouped?'checked':'')+' onchange="toggle(\''+p.id+'\')"/>'; h+='<span style="flex:1;"><div class="p-name">'+esc(p.name)+'</div>'+(meta?'<div style="font-size:11px;color:var(--muted);margin-top:2px;">'+esc(meta)+'</div>':'')+'</span>'; h+='<input class="p-phone" type="text" placeholder="Phone number" value="'+esc(p.phone||"")+'" onchange="savePhone(\''+p.id+'\',this.value)"/>'; if(digits) h+='<a class="p-call" href="tel:'+digits+'">&#9742;</a>'; h+='<input class="p-note" type="text" placeholder="Note" value="'+esc(p.note||"")+'" onchange="saveNote(\''+p.id+'\',this.value)"/>'; h+='<button class="p-remove" onclick="removePatient(\''+p.id+'\')">&#10005;</button></div>'; }); } else { h+='<div style="font-size:13px;color:var(--muted);text-align:center;padding:12px 0;">No cancellations or no-shows added for this location yet today.</div>'; } h+='</div></div>';
  h+='<div class="section-title">Tap to log</div><div class="counter-grid">'; COUNTER_DEFS.forEach(cd=>{ h+='<div class="counter-card"><div class="counter-top"><span>'+cd.name+'</span><span class="count">'+(c[cd.field]||0)+'</span></div><div class="counter-buttons"><button class="btn-minus" onclick="adjustCounter(\''+locKey+'\',\''+cd.field+'\','-1')">&#8722;</button><button class="btn-plus" onclick="adjustCounter(\''+locKey+'\',\''+cd.field+'\',1)">+ 1</button></div></div>'; }); h+='</div>';
  h+='<div class="section-title">Activity log \u2014 '+loc.name+'</div><div class="log-box">'; const logs=(state.data.logs[locKey]||[]); if(logs.length){ logs.forEach(e=>{ h+='<div class="log-row"><div class="log-time">'+fmtTime(e.ts)+'</div><div>'+esc(e.label)+'</div></div>'; }); } else { h+='<div style="color:var(--muted);font-size:13px;padding:16px 0;text-align:center;">No activity logged yet today.</div>'; } h+='</div>'; return h; }
load();
</script>
</body>
</html>
""";