using System.Text.Json;

namespace lootta.Data;

/// <summary>
/// The demo shop, loaded from seed-data.json rather than written in C#.
///
/// Why a file instead of code: the point of the seed is that somebody else can
/// clone this project onto a different computer and get the same shop. Keeping
/// the data in a file means changing what the demo contains is an edit and a
/// restart, not an edit, a rebuild and a redeploy — and the file itself is
/// readable by anyone reviewing the project, which C# collection initialisers
/// are not.
///
/// If the file is missing or malformed the seeder falls back to the list built
/// into the code, so a bad edit can never leave the shop empty.
/// </summary>
public sealed class SeedFile
{
    public List<SeedCategory> Categories { get; set; } = new();
    public List<SeedQuickTag> QuickTags { get; set; } = new();
    public Dictionary<string, string> SiteText { get; set; } = new();
    public List<SeedProduct> Products { get; set; } = new();

    public sealed class SeedCategory
    {
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public int SortOrder { get; set; }
    }

    public sealed class SeedQuickTag
    {
        public string Label { get; set; } = string.Empty;
        public string Query { get; set; } = string.Empty;
        public int SortOrder { get; set; }
    }

    public sealed class SeedProduct
    {
        public string Model { get; set; } = string.Empty;
        public string Brand { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public decimal Retail { get; set; }
        public string Image { get; set; } = string.Empty;
        public string Tagline { get; set; } = string.Empty;
    }

    /// <summary>
    /// Reads the file next to the API, or returns null if it is not usable.
    ///
    /// Two locations are tried because they differ between running and
    /// publishing: "dotnet run" works from the project folder, while a
    /// published build only has the folder the .dll sits in.
    /// </summary>
    public static SeedFile? Load(string contentRoot)
    {
        var candidates = new[]
        {
            Path.Combine(contentRoot, "seed-data.json"),
            Path.Combine(AppContext.BaseDirectory, "seed-data.json"),
        };

        foreach (var path in candidates)
        {
            if (!File.Exists(path)) continue;

            try
            {
                var json = File.ReadAllText(path);

                var seed = JsonSerializer.Deserialize<SeedFile>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    ReadCommentHandling = JsonCommentHandling.Skip,
                    AllowTrailingCommas = true,
                });

                // A file that parses but contains nothing is treated as absent,
                // so an accidentally emptied file falls back rather than
                // producing a shop with no products in it.
                if (seed is not null && seed.Products.Count > 0)
                {
                    Console.WriteLine($"[seed] loaded {seed.Products.Count} products from {Path.GetFileName(path)}");
                    return seed;
                }
            }
            catch (JsonException ex)
            {
                // Named explicitly: a typo in the JSON is the likeliest problem
                // here, and silently ignoring it would be baffling to debug.
                Console.WriteLine($"[seed] {Path.GetFileName(path)} is not valid JSON, using the built-in data instead. {ex.Message}");
                return null;
            }
        }

        return null;
    }
}
