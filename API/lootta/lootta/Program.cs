using Microsoft.EntityFrameworkCore;
using lootta.Data;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------- services

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// SQL Server via Entity Framework Core.
// The connection string lives in appsettings.Development.json, which is
// gitignored, so no credentials reach GitHub.
builder.Services.AddDbContext<LoottaDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Explicit development origins only — never AllowAnyOrigin in a real app.
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

// Apply any pending migrations and load the starting stock, so a fresh clone
// runs with one command. Development only — never auto-migrate in production.
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<LoottaDbContext>();
    await db.Database.MigrateAsync();
    await DbSeeder.SeedAsync(db);
}

// ---------------------------------------------------------------- pipeline

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Serves wwwroot (not used yet, but required before UseStaticFiles on /uploads).
app.UseStaticFiles();

// Makes uploaded product photos publicly readable at /uploads/products/...
var uploadsPath = Path.Combine(builder.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsPath);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

app.UseCors(DevCors);

app.UseAuthorization();
app.MapControllers();

app.Run();
