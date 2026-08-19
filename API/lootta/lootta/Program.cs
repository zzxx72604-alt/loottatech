using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using lootta.Data;
using lootta.Services;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------- services

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Swagger, with a padlock so protected endpoints can be tried from the docs.
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "LoottaTech API", Version = "v1" });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the token from /api/auth/login. No need to type \"Bearer\".",
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

/*
 * WHICH DATABASE?
 *
 * SQL Server is the intended database, but a fresh clone often lands on a
 * machine that has never had it installed — and "The system cannot find the
 * file specified" is a miserable first impression.
 *
 * So the API probes for SQL Server at startup. If it answers, we use it. If it
 * does not, we fall back to a SQLite file created next to the executable. The
 * models, the migrations, the controllers and the API are all identical either
 * way, because EF Core sits in between.
 *
 * Force one or the other with "Database:Provider" = "SqlServer" | "Sqlite".
 */
var sqlServerConnection = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=localhost;Database=LoottaTech;Trusted_Connection=True;"
     + "TrustServerCertificate=True;MultipleActiveResultSets=True";

var requested = builder.Configuration["Database:Provider"] ?? "Auto";

var useSqlServer = requested.Equals("SqlServer", StringComparison.OrdinalIgnoreCase)
    || (requested.Equals("Auto", StringComparison.OrdinalIgnoreCase)
        && CanReachSqlServer(sqlServerConnection));

var sqlitePath = Path.Combine(builder.Environment.ContentRootPath, "loottatech.db");

builder.Services.AddDbContext<LoottaDbContext>(options =>
{
    if (useSqlServer) options.UseSqlServer(sqlServerConnection);
    else options.UseSqlite($"Data Source={sqlitePath}");
});

builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<EconomyService>();
builder.Services.AddSingleton<ImageService>();
builder.Services.AddScoped<NotificationService>();

// ---- authentication: JWT bearer -----------------------------------------
var jwt = builder.Configuration.GetSection("Jwt");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!)),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });

/*
 * Authorization by POLICY, not by role strings scattered across controllers.
 *
 * "Who is allowed to manage products" is decided here, once. If that changes
 * later — say a Manager role is added — this file changes and no controller
 * has to be touched.
 */
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
    options.AddPolicy("CanManageProducts", policy => policy.RequireRole("Admin"));
    options.AddPolicy("CanManageOrders", policy => policy.RequireRole("Admin"));
});

// ---- rate limiting: slows brute-force attempts ---------------------------
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Login and registration: 8 attempts per 5 minutes from one IP.
    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 8,
                Window = TimeSpan.FromMinutes(5),
                QueueLimit = 0,
            }));

    // Everything else: generous, just enough to stop a runaway script.
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 300,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
});

const string DevCors = "LoottaDevCors";
builder.Services.AddCors(options =>
{
    options.AddPolicy(DevCors, policy =>
        policy.WithOrigins(
                  "http://localhost:4200",   // customer Angular site
                  "http://localhost:4300")   // admin Angular site
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

// Apply migrations and load the starting stock so a fresh clone just runs.
// Development only — production migrations are applied deliberately.
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<LoottaDbContext>();

    try
    {
        if (useSqlServer)
        {
            // Real migration history, so the schema can evolve over time.
            await db.Database.MigrateAsync();
        }
        else
        {
            /*
             * SQLite builds the schema straight from the model instead.
             * EnsureCreated cannot apply incremental migrations, which is fine
             * here: the fallback database is created fresh and seeded, never
             * upgraded in place.
             */
            await db.Database.EnsureCreatedAsync();
        }

        await DbSeeder.SeedAsync(db);

        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine();
        Console.WriteLine(useSqlServer
            ? "  Database: SQL Server"
            : $"  Database: SQLite (SQL Server not found) -> {sqlitePath}");
        Console.ResetColor();
        Console.WriteLine();
    }
    catch (Exception ex)
    {
        // A wall of stack trace tells a first-time user nothing. Say plainly
        // what is wrong and how to fix it, then stop.
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine();
        Console.WriteLine("  Could not prepare the database.");
        Console.ResetColor();
        Console.WriteLine();
        Console.WriteLine(useSqlServer
            ? $"  Tried SQL Server: {sqlServerConnection}"
            : $"  Tried SQLite file: {sqlitePath}");
        Console.WriteLine();

        if (useSqlServer)
        {
            Console.WriteLine("  Check SQL Server is running, then set the server name in");
            Console.WriteLine("  appsettings.Development.json:");
            Console.WriteLine();
            Console.WriteLine("     default instance ....  Server=localhost;");
            Console.WriteLine("     SQL Express .........  Server=localhost\\SQLEXPRESS;");
            Console.WriteLine("     LocalDB .............  Server=(localdb)\\MSSQLLocalDB;");
            Console.WriteLine();
            Console.WriteLine("  Or force the no-install fallback by setting");
            Console.WriteLine("     \"Database\": { \"Provider\": \"Sqlite\" }");
        }
        else
        {
            Console.WriteLine("  Delete loottatech.db and start again to rebuild it.");
        }
        Console.WriteLine();
        Console.WriteLine($"  Original error: {ex.GetBaseException().Message}");
        Console.WriteLine();
        return;
    }
}

// ---------------------------------------------------------------- pipeline

/*
 * Behind Nginx and Cloudflare the API would otherwise see every request as
 * coming from 127.0.0.1 over plain HTTP. This restores the real client IP and
 * scheme, which rate limiting depends on.
 */
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

/*
 * Only /uploads is served as static files. The default UseStaticFiles() for
 * wwwroot is deliberately not called — this project has no wwwroot, and asking
 * for one only produces a warning about a folder we never use.
 */
var uploadsPath = Path.Combine(builder.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsPath);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

app.UseCors(DevCors);
app.UseRateLimiter();

// Order matters: work out WHO you are, then whether you're ALLOWED.
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

/// <summary>
/// Opens a connection with a short timeout just to see whether SQL Server is
/// there. Two seconds is long enough for a local instance and short enough
/// that nobody notices when it is missing.
/// </summary>
static bool CanReachSqlServer(string connectionString)
{
    try
    {
        var builder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(connectionString)
        {
            ConnectTimeout = 2,
            // Probe the server itself; the database may not exist yet.
            InitialCatalog = "master",
        };

        using var connection = new Microsoft.Data.SqlClient.SqlConnection(builder.ConnectionString);
        connection.Open();
        return true;
    }
    catch
    {
        return false;
    }
}
