using Microsoft.EntityFrameworkCore;
using lootta.Models;
using lootta.Services;

namespace lootta.Data;

/// <summary>
/// Loads the real LoottaTech stock the first time the API starts.
///
/// Categories are seeded by the migration (HasData). Products are seeded here
/// instead, because HasData cannot easily express child collections like
/// images and specs.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(LoottaDbContext db, string contentRoot = "")
    {
        // Null when the file is missing or unreadable; every use below falls
        // back to the data built into this class.
        var seed = SeedFile.Load(string.IsNullOrEmpty(contentRoot)
            ? AppContext.BaseDirectory
            : contentRoot);

        await SeedUsersAsync(db);
        await BackfillPublicIdsAsync(db);
        await BackfillUserCodesAsync(db);
        await SeedStoreContentAsync(db, seed);

        if (await db.Products.AnyAsync())
        {
            /*
             * Already stocked with the original ten, but a database created
             * before the larger catalogue and the reviews existed still needs
             * both. Each of these has its own guard, so running them again is
             * harmless.
             */
            await SeedBulkAsync(db, seed);
            await SeedReviewsAsync(db);
            return;
        }

        var phones = await db.Categories.FirstAsync(c => c.Slug == "phones");
        var laptops = await db.Categories.FirstAsync(c => c.Slug == "laptops");
        var wearables = await db.Categories.FirstAsync(c => c.Slug == "wearables");
        var accessories = await db.Categories.FirstAsync(c => c.Slug == "accessories");

        var products = new List<Product>
        {
            Build("iPhone 12 mini 128GB — Starlight", "Apple", phones.Id, ProductCondition.LikeNew,
                269, 699, 1, 3, true, 24,
                "Compact flagship that still feels fast. Screen has no scratches, frame is clean, Face ID tested and working. New cable included, no original box.",
                "Faint micro-scuff on the bottom-left frame edge, only visible at an angle.",
                new[] { "iphone-12-mini-1", "iphone-12-mini-2", "iphone-12-mini-3" },
                new[] { ("Storage", "128 GB"), ("Battery health", "89%"), ("Screen", "5.4\" Super Retina XDR OLED"),
                        ("Chip", "A14 Bionic"), ("Face ID", "Working"), ("Network lock", "Unlocked") }),

            Build("iPhone 12 mini 64GB — Starlight", "Apple", phones.Id, ProductCondition.Good,
                229, 599, 1, 3, true, 11,
                "Same model, cheaper unit. Battery is below 85% so budget for a replacement eventually. Everything else tested and working.",
                "Two small scratches on the back glass, no cracks. Battery health 84%.",
                new[] { "iphone-12-mini-2", "iphone-12-mini-1", "iphone-12-mini-3" },
                new[] { ("Storage", "64 GB"), ("Battery health", "84%"), ("Screen", "5.4\" Super Retina XDR OLED"),
                        ("Chip", "A14 Bionic"), ("Face ID", "Working"), ("Network lock", "Unlocked") }),

            Build("Xiaomi Mi 11 8GB/256GB — Horizon Blue", "Xiaomi", phones.Id, ProductCondition.LikeNew,
                189, 749, 1, 3, true, 31,
                "A 120Hz AMOLED flagship for under two hundred. Screen is flawless, curved glass intact, charges at full speed.",
                "None found. Screen protector applied since new, removed for photos.",
                new[] { "xiaomi-mi-11-1", "xiaomi-mi-11-2", "xiaomi-mi-11-3" },
                new[] { ("Storage", "256 GB"), ("RAM", "8 GB"), ("Screen", "6.81\" AMOLED 120Hz"),
                        ("Chip", "Snapdragon 888"), ("Main camera", "108 MP"), ("Battery", "4600 mAh") }),

            Build("Xiaomi Mi 11 8GB/128GB — Horizon Blue", "Xiaomi", phones.Id, ProductCondition.Good,
                159, 649, 2, 1, true, 8,
                "Budget unit of the same flagship. Fully functional, cosmetically used. Two in stock.",
                "Light scuffing along the aluminium frame. Screen clean.",
                new[] { "xiaomi-mi-11-3", "xiaomi-mi-11-1", "xiaomi-mi-11-2" },
                new[] { ("Storage", "128 GB"), ("RAM", "8 GB"), ("Screen", "6.81\" AMOLED 120Hz"),
                        ("Chip", "Snapdragon 888"), ("Main camera", "108 MP"), ("Battery", "4600 mAh") }),

            Build("Lenovo ThinkPad E14 Gen 2 — i5 / 16GB / 512GB / MX450", "Lenovo", laptops.Id, ProductCondition.Good,
                319, 899, 1, 6, true, 47,
                "The classic ThinkPad keyboard with a discrete GPU. Stress-tested for an hour, thermals normal, no throttling. Charger included.",
                "Minor paint chip and a faint stain on the lid — photographed close-up in the third image. Purely cosmetic.",
                new[] { "thinkpad-e14-1", "thinkpad-e14-2", "thinkpad-e14-3" },
                new[] { ("CPU", "Intel Core i5-1135G7"), ("RAM", "16 GB DDR4"), ("Storage", "512 GB NVMe SSD"),
                        ("Graphics", "NVIDIA GeForce MX450 2GB"), ("Screen", "14\" FHD IPS matte"),
                        ("Battery health", "91%"), ("Ports", "USB-C, 2x USB-A, HDMI, RJ45"), ("Weight", "1.75 kg") }),

            Build("Lenovo ThinkPad E14 Gen 2 — i5 / 8GB / 256GB", "Lenovo", laptops.Id, ProductCondition.Fair,
                249, 799, 1, 3, true, 15,
                "Cheapest way into a working ThinkPad. Cosmetically rough but mechanically sound — RAM and SSD are both upgradeable.",
                "Visible paint loss on the lid, worn keycaps on E/R/T, battery down to 76%. Runs fine on mains.",
                new[] { "thinkpad-e14-3", "thinkpad-e14-1", "thinkpad-e14-2" },
                new[] { ("CPU", "Intel Core i5-1135G7"), ("RAM", "8 GB DDR4"), ("Storage", "256 GB NVMe SSD"),
                        ("Graphics", "Intel Iris Xe"), ("Screen", "14\" FHD IPS matte"),
                        ("Battery health", "76%"), ("Weight", "1.75 kg") }),

            Build("Apple Watch Series 7 45mm — Starlight Aluminium", "Apple", wearables.Id, ProductCondition.LikeNew,
                179, 429, 1, 3, true, 19,
                "Bigger 45mm case with the always-on display. Screen is unmarked, crown and side button both crisp. Magnetic charger included.",
                "None on the screen. Barely visible wear on the underside sensor ring.",
                new[] { "apple-watch-s7-1", "apple-watch-s7-2" },
                new[] { ("Case size", "45 mm"), ("Case material", "Starlight aluminium"), ("Battery health", "92%"),
                        ("Connectivity", "GPS (no cellular)"), ("Band", "Black sport band, included"),
                        ("Screen", "Always-On Retina LTPO") }),

            Build("Apple Watch Series 7 41mm — Starlight Aluminium", "Apple", wearables.Id, ProductCondition.Good,
                149, 399, 1, 3, true, 6,
                "Smaller case, same generation. Everything functions, light cosmetic wear.",
                "Two hairline marks on the case edge. Screen clean.",
                new[] { "apple-watch-s7-2", "apple-watch-s7-1" },
                new[] { ("Case size", "41 mm"), ("Case material", "Starlight aluminium"), ("Battery health", "87%"),
                        ("Connectivity", "GPS (no cellular)"), ("Band", "Black sport band, included"),
                        ("Screen", "Always-On Retina LTPO") }),

            Build("VXE Dragonfly R1 wireless gaming mouse — Pink", "VXE", accessories.Id, ProductCondition.LikeNew,
                29, 59, 3, 1, true, 38,
                "Featherweight 55g mouse with a flagship sensor. Dongle and USB-C cable included. Three in stock.",
                "PTFE feet lightly worn. Shell and buttons like new.",
                new[] { "vxe-mouse-1", "vxe-mouse-2" },
                new[] { ("Weight", "55 g"), ("Sensor", "PixArt PAW3395"), ("Max DPI", "26,000"),
                        ("Connection", "2.4GHz dongle + Bluetooth"), ("Battery life", "up to 60 h"), ("Buttons", "6") }),

            Build("VXE Dragonfly R1 wireless gaming mouse — Pink, sealed", "VXE", accessories.Id, ProductCondition.New,
                39, 59, 2, 12, false, 12,
                "Still sealed in the factory box, so it ships untested with a full 12-month warranty.",
                "",
                new[] { "vxe-mouse-2", "vxe-mouse-1" },
                new[] { ("Weight", "55 g"), ("Sensor", "PixArt PAW3395"), ("Max DPI", "26,000"),
                        ("Connection", "2.4GHz dongle + Bluetooth"), ("Battery life", "up to 60 h"), ("Buttons", "6") })
        };

        db.Products.AddRange(products);
        await db.SaveChangesAsync();

        await SeedBulkAsync(db, seed);
        await SeedReviewsAsync(db);
    }

    /// <summary>
    /// A larger catalogue, so paging, endless scrolling and search have
    /// something real to work against.
    ///
    /// Generated from a fixed seed, so every install gets the same shop and a
    /// demo is reproducible.
    /// </summary>
    private static async Task SeedBulkAsync(LoottaDbContext db, SeedFile? seed)
    {
        /*
         * Skip anything already present rather than bailing on a count.
         * A count guard means the catalogue can never be extended later —
         * matching on title lets new rows be added to an existing shop.
         */
        var existingTitles = (await db.Products.Select(p => p.Title).ToListAsync()).ToHashSet();

        var categories = await db.Categories.ToDictionaryAsync(c => c.Slug, c => c.Id);
        var random = new Random(42);

        // (model, brand, category, base price, retail, image, taglines)
        var lines = seed is not null
            ? seed.Products
                .Select(p => (Model: p.Model, Brand: p.Brand, Slug: p.Category,
                              Price: p.Price, Retail: p.Retail, Image: p.Image, Tagline: p.Tagline))
                .ToArray()
            : BuiltInLines;


        var conditions = new[]
        {
            ProductCondition.LikeNew, ProductCondition.Good,
            ProductCondition.Good, ProductCondition.Fair, ProductCondition.New,
        };

        foreach (var line in lines)
        {
            if (!categories.TryGetValue(line.Slug, out var categoryId)) continue;

            var condition = conditions[random.Next(conditions.Length)];

            // Rougher condition means a bigger discount, so the numbers stay
            // believable rather than random.
            var multiplier = condition switch
            {
                ProductCondition.New => 1.15m,
                ProductCondition.LikeNew => 1.0m,
                ProductCondition.Good => 0.88m,
                _ => 0.74m,
            };

            var price = Math.Round(line.Price * multiplier);

            var title = $"{line.Model} — {line.Tagline}";
            if (existingTitles.Contains(title)) continue;

            var product = new Product
            {
                PublicId = PublicIdGenerator.Next(),
                Title = title,
                Brand = line.Brand,
                CategoryId = categoryId,
                Condition = condition,
                Price = price,
                OriginalPrice = line.Retail,
                Stock = random.Next(0, 4),
                WarrantyMonths = condition == ProductCondition.New ? 12 : random.Next(0, 7),
                Tested = condition != ProductCondition.New,
                WatchCount = random.Next(0, 60),
                Description = $"{line.Model} in {condition} condition. {line.Tagline}. Checked and photographed by LoottaTech.",
                FlawNotes = condition switch
                {
                    ProductCondition.New => "",
                    ProductCondition.LikeNew => "No marks found.",
                    ProductCondition.Good => "Light cosmetic wear, nothing structural.",
                    _ => "Visible scuffing and wear. Fully working.",
                },
                IsActive = true,
                CreatedAt = DateTime.UtcNow.AddDays(-random.Next(1, 60)),
            };

            product.Images.Add(new ProductImage
            {
                FileName = line.Image,
                Url = $"/uploads/products/{line.Image}",
                IsPrimary = true,
                SortOrder = 0,
            });

            db.Products.Add(product);
        }

        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Demo reviews, so the ratings and distribution bars have something real
    /// to show on a fresh install.
    ///
    /// Marked VerifiedPurchase because in the real flow they could only exist
    /// after a completed order — seeding them any other way would misrepresent
    /// what the badge means.
    /// </summary>
    private static async Task SeedReviewsAsync(LoottaDbContext db)
    {
        if (await db.Reviews.AnyAsync()) return;

        var reviewers = new[]
        {
            ("Chan Sophea", "sophea@gmail.com"),
            ("Kim Rithy", "rithy@gmail.com"),
            ("Nou Sreyneang", "sreyneang@gmail.com"),
            ("Heng Vibol", "vibol@gmail.com"),
            ("Long Dara", "longdara@gmail.com"),
        };

        var users = new List<User>();
        var codes = new HashSet<string>();

        foreach (var (name, email) in reviewers)
        {
            var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (existing is not null) { users.Add(existing); continue; }

            var user = new User
            {
                Name = name,
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Demo123"),
                Role = UserRole.Customer,
                Address = "Phnom Penh",
                Coins = 200,
                PublicId = await NextUserCodeAsync(db, codes),
            };
            db.Users.Add(user);
            users.Add(user);
        }

        await db.SaveChangesAsync();

        var products = await db.Products.OrderBy(p => p.Id).ToListAsync();
        if (products.Count == 0) return;

        // (product index, reviewer index, stars, comment)
        var written = new (int Product, int User, int Stars, string Body)[]
        {
            (0, 0, 5, "Battery is exactly as described at 89%. Screen has no scratches at all. Arrived in two days."),
            (0, 1, 4, "Good phone for the price. The scuff on the frame is real but you only see it in bright light."),
            (0, 2, 5, "Second one I've bought from LoottaTech. Both were honest about condition."),
            (1, 3, 4, "Battery is weaker than the 128GB one, as the listing says. Still fine for a day of light use."),
            (2, 0, 5, "120Hz screen is lovely. Genuinely looks unused."),
            (2, 4, 5, "Fast charging works properly. Very happy."),
            (3, 1, 3, "Works well but the frame scuffing is more than I expected from the photos."),
            (4, 2, 5, "The ThinkPad keyboard is worth it alone. Ran a long build with no throttling."),
            (4, 3, 5, "Paint chip is tiny and photographed honestly. Great machine for the money."),
            (4, 4, 4, "Battery at 91% as stated. Only wish it had more RAM slots free."),
            (5, 0, 3, "Cheap way into a ThinkPad but the keycaps are quite worn. Runs fine plugged in."),
            (6, 1, 5, "Watch looks new. Charger included as promised."),
            (6, 2, 4, "Screen is perfect, small mark underneath as described."),
            (7, 3, 4, "Smaller case suits me better. Battery health is honest."),
            (8, 4, 5, "55g really does feel different. Dongle included."),
            (8, 0, 5, "Great mouse, arrived quickly."),
            (9, 1, 5, "Sealed in the box exactly as listed."),
        };

        var random = new Random(7);   // fixed seed, so the demo data is stable

        foreach (var row in written)
        {
            if (row.Product >= products.Count || row.User >= users.Count) continue;

            db.Reviews.Add(new Review
            {
                ProductId = products[row.Product].Id,
                UserId = users[row.User].Id,
                Rating = row.Stars,
                Body = row.Body,
                VerifiedPurchase = true,
                CreatedAt = DateTime.UtcNow.AddDays(-random.Next(1, 40)),
            });
        }

        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Two demo accounts. Passwords are BCrypt-hashed here exactly as they are
    /// at registration — the plain text never reaches the database.
    /// </summary>
    private static async Task SeedUsersAsync(LoottaDbContext db)
    {
        if (await db.Users.AnyAsync()) return;

        var codes = new HashSet<string>();

        db.Users.AddRange(
            new User
            {
                Name = "Shop Admin",
                Email = "admin@loottatech.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123"),
                Role = UserRole.Admin,
                Address = "Phnom Penh",
                Coins = 0,
                PublicId = await NextUserCodeAsync(db, codes),
            },
            new User
            {
                Name = "Sok Dara",
                Email = "dara@gmail.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Dara123"),
                Role = UserRole.Customer,
                Address = "Phnom Penh",
                Coins = 120,
                PublicId = await NextUserCodeAsync(db, codes),
            });

        await db.SaveChangesAsync();
    }

    /// <summary>
    /// An account number nobody holds yet.
    ///
    /// The column is unique, so seeded accounts cannot be left at the empty
    /// default — the second row would be rejected and a brand new database
    /// would never finish seeding. <paramref name="taken"/> keeps the codes
    /// handed out within one batch apart from each other, before any of them
    /// has reached the table.
    /// </summary>
    private static async Task<string> NextUserCodeAsync(LoottaDbContext db, HashSet<string> taken)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = PublicIdGenerator.NextUser();
            if (!taken.Add(code)) continue;
            if (await db.Users.AnyAsync(u => u.PublicId == code)) continue;
            return code;
        }

        // Five million combinations against a handful of rows: unreachable in
        // practice, but a seeder must not spin forever either.
        throw new InvalidOperationException("Could not allocate a unique account number.");
    }

    /// <summary>
    /// Gives a share code to any product created before the column existed.
    ///
    /// Cheaper than a data migration and it self-heals: products added by an
    /// older build still get a code the next time the API starts.
    /// </summary>
    private static async Task BackfillPublicIdsAsync(LoottaDbContext db)
    {
        var missing = await db.Products
            .Where(p => p.PublicId == null || p.PublicId == "")
            .ToListAsync();

        if (missing.Count == 0) return;

        var taken = (await db.Products
                .Where(p => p.PublicId != null && p.PublicId != "")
                .Select(p => p.PublicId)
                .ToListAsync())
            .ToHashSet();

        foreach (var product in missing)
        {
            string code;
            do { code = PublicIdGenerator.Next(); } while (!taken.Add(code));
            product.PublicId = code;
        }

        await db.SaveChangesAsync();
    }

    /// <summary>Gives an account number to anyone created before the column.</summary>
    private static async Task BackfillUserCodesAsync(LoottaDbContext db)
    {
        var missing = await db.Users
            .Where(u => u.PublicId == null || u.PublicId == "")
            .ToListAsync();

        if (missing.Count == 0) return;

        var taken = (await db.Users
                .Where(u => u.PublicId != null && u.PublicId != "")
                .Select(u => u.PublicId)
                .ToListAsync())
            .ToHashSet();

        foreach (var user in missing)
        {
            string code;
            do { code = PublicIdGenerator.NextUser(); } while (!taken.Add(code));
            user.PublicId = code;
        }

        await db.SaveChangesAsync();
    }

    private static Product Build(
        string title, string brand, int categoryId, ProductCondition condition,
        decimal price, decimal originalPrice, int stock, int warrantyMonths,
        bool tested, int watchCount, string description, string flawNotes,
        string[] imageNames, (string Key, string Value)[] specs)
    {
        var product = new Product
        {
            PublicId = PublicIdGenerator.Next(),
            Title = title,
            Brand = brand,
            CategoryId = categoryId,
            Condition = condition,
            Price = price,
            OriginalPrice = originalPrice,
            Stock = stock,
            WarrantyMonths = warrantyMonths,
            Tested = tested,
            WatchCount = watchCount,
            Description = description,
            FlawNotes = flawNotes,
            IsActive = true
        };

        for (var i = 0; i < imageNames.Length; i++)
        {
            product.Images.Add(new ProductImage
            {
                FileName = imageNames[i],
                // Base path with no size suffix — the Angular image loader
                // appends "-480.webp" or "-800.webp" and the browser picks.
                Url = $"/uploads/products/{imageNames[i]}",
                IsPrimary = i == 0,
                SortOrder = i
            });
        }

        for (var i = 0; i < specs.Length; i++)
        {
            product.Specs.Add(new ProductSpec
            {
                Key = specs[i].Key,
                Value = specs[i].Value,
                SortOrder = i
            });
        }

        return product;
    }

    /// <summary>
    /// The catalogue built into the code.
    ///
    /// Used only when seed-data.json is missing or unreadable. Keeping it
    /// means a broken edit to the JSON degrades to the original demo shop
    /// instead of leaving somebody with an empty storefront and no clue why.
    /// </summary>
    private static readonly (string Model, string Brand, string Slug, decimal Price, decimal Retail, string Image, string Tagline)[] BuiltInLines =
    {
            ("iPhone 13",              "Apple",   "phones",      329, 799, "iphone-12-mini-1", "fast · great camera · all-day battery"),
            ("iPhone 13 Pro",          "Apple",   "phones",      459, 999, "iphone-12-mini-2", "120Hz · triple camera · pro video"),
            ("iPhone 14",              "Apple",   "phones",      499, 899, "iphone-12-mini-3", "bright screen · crash detection"),
            ("iPhone SE 2022",         "Apple",   "phones",      179, 429, "iphone-12-mini-1", "small · fast chip · budget pick"),
            ("Xiaomi 12",              "Xiaomi",  "phones",      239, 749, "xiaomi-mi-11-1",   "120Hz AMOLED · fast charging"),
            ("Xiaomi 13",              "Xiaomi",  "phones",      329, 899, "xiaomi-mi-11-2",   "Leica camera · flagship chip"),
            ("Xiaomi 13 Pro",          "Xiaomi",  "phones",      429, 1099,"xiaomi-mi-11-3",   "1-inch sensor · best camera"),
            ("Xiaomi Redmi Note 12",   "Xiaomi",  "phones",      129, 299, "xiaomi-mi-11-1",   "big battery · cheap and reliable"),
            ("Xiaomi Redmi Note 13",   "Xiaomi",  "phones",      159, 349, "xiaomi-mi-11-2",   "108MP camera · fast internet"),
            ("Samsung Galaxy S21",     "Samsung", "phones",      269, 849, "iphone-12-mini-2", "120Hz · wireless charging"),
            ("Samsung Galaxy S22",     "Samsung", "phones",      359, 949, "iphone-12-mini-3", "compact flagship · great screen"),
            ("Google Pixel 6a",        "Google",  "phones",      199, 449, "iphone-12-mini-1", "clean Android · superb photos"),

            ("ThinkPad T14 Gen 3",     "Lenovo",  "laptops",     429, 1199,"thinkpad-e14-1",   "i7 · 16GB · business build"),
            ("ThinkPad X1 Carbon",     "Lenovo",  "laptops",     649, 1799,"thinkpad-e14-2",   "1.1kg · 14in · long battery"),
            ("ThinkPad E15",           "Lenovo",  "laptops",     339, 899, "thinkpad-e14-3",   "15in · numeric keypad · SSD"),
            ("MacBook Air M1",         "Apple",   "laptops",     549, 1099,"thinkpad-e14-1",   "silent · 15h battery · fast"),
            ("MacBook Pro 13 M1",      "Apple",   "laptops",     699, 1299,"thinkpad-e14-2",   "bright screen · great speakers"),
            ("Dell XPS 13",            "Dell",    "laptops",     499, 1299,"thinkpad-e14-3",   "thin bezels · premium build"),
            ("HP EliteBook 840",       "HP",      "laptops",     319, 999, "thinkpad-e14-1",   "sturdy · docking · i5"),
            ("Asus Vivobook 15",       "Asus",    "laptops",     279, 649, "thinkpad-e14-2",   "budget all-rounder · SSD"),

            ("Apple Watch SE",         "Apple",   "wearables",   129, 299, "apple-watch-s7-1", "fitness · notifications · light"),
            ("Apple Watch Series 8",   "Apple",   "wearables",   229, 499, "apple-watch-s7-2", "always-on · temperature sensor"),
            ("Galaxy Watch 5",         "Samsung", "wearables",   139, 329, "apple-watch-s7-1", "sleep tracking · long battery"),
            ("Xiaomi Smart Band 8",    "Xiaomi",  "wearables",    29,  59, "apple-watch-s7-2", "14-day battery · cheap tracker"),

            ("Logitech MX Master 3",   "Logitech","accessories",  59, 119, "vxe-mouse-1",      "quiet · precise · productivity"),
            ("Logitech G Pro X",       "Logitech","accessories",  49,  99, "vxe-mouse-2",      "lightweight · esports sensor"),
            ("Razer DeathAdder V3",    "Razer",   "accessories",  45,  89, "vxe-mouse-1",      "ergonomic · 8K polling"),
            ("Keychron K2 keyboard",   "Keychron","accessories",  55, 109, "vxe-mouse-2",      "mechanical · wireless · compact"),
            ("Anker 65W charger",      "Anker",   "accessories",  19,  45, "vxe-mouse-1",      "GaN · small · fast charge"),
            ("Anker PowerBank 20000",  "Anker",   "accessories",  25,  59, "vxe-mouse-2",      "charges a laptop · USB-C"),
            ("USB-C to HDMI hub",      "Ugreen",  "accessories",  15,  35, "vxe-mouse-1",      "7-in-1 · 4K output"),
            ("Sony WH-1000XM4",        "Sony",    "accessories", 149, 349, "vxe-mouse-2",      "noise cancelling · 30h battery"),
            ("JBL Tune 760NC",         "JBL",     "accessories",  59, 129, "vxe-mouse-1",      "over-ear · 50h battery"),
            ("AirPods Pro 2",          "Apple",   "accessories", 129, 249, "vxe-mouse-2",      "active noise cancelling"),
            ("Samsung T7 1TB SSD",     "Samsung", "accessories",  75, 149, "vxe-mouse-1",      "portable · 1050MB/s"),
            ("SanDisk 128GB microSD",  "SanDisk", "accessories",  12,  29, "vxe-mouse-2",      "A2 · 4K ready"),

            ("iPad 9th gen 64GB",      "Apple",   "tablets",     199, 429, "iphone-12-mini-1", "10.2in · school and study"),
            ("iPad Air 4",             "Apple",   "tablets",     319, 749, "iphone-12-mini-2", "10.9in · USB-C · fast"),
            ("Samsung Tab S6 Lite",    "Samsung", "tablets",     149, 349, "iphone-12-mini-3", "with S Pen · light"),
            ("Xiaomi Pad 5",           "Xiaomi",  "tablets",     169, 399, "xiaomi-mi-11-1",   "120Hz · great for video"),

            ("Dell 24in P2419H",       "Dell",    "monitors",     79, 219, "thinkpad-e14-1",   "1080p · IPS · height adjust"),
            ("LG 27in 27UL500",        "LG",      "monitors",    169, 399, "thinkpad-e14-2",   "4K · IPS · HDR10"),
            ("AOC 24in 144Hz",         "AOC",     "monitors",    109, 249, "thinkpad-e14-3",   "gaming · 1ms · FreeSync"),

            ("HP LaserJet M15w",       "HP",      "printers",     59, 149, "thinkpad-e14-1",   "mono laser · wireless"),
            ("Canon PIXMA G2010",      "Canon",   "printers",     79, 189, "thinkpad-e14-2",   "ink tank · cheap refills"),
            ("Epson L3110",            "Epson",   "printers",     89, 199, "thinkpad-e14-3",   "print scan copy · ink tank"),

            ("RTX 3060 12GB",          "NVIDIA",  "pc-parts",    189, 449, "vxe-mouse-1",      "1080p gaming · 12GB VRAM"),
            ("Ryzen 5 5600X",          "AMD",     "pc-parts",     99, 299, "vxe-mouse-2",      "6 cores · great value"),
            ("Corsair 16GB DDR4",      "Corsair", "pc-parts",     29,  79, "vxe-mouse-1",      "3200MHz · 2x8GB"),
            ("Kingston 500GB NVMe",    "Kingston","pc-parts",     35,  89, "vxe-mouse-2",      "PCIe 3.0 · fast boot"),

            ("PS5 DualSense pad",      "Sony",    "gaming",       39,  79, "vxe-mouse-1",      "wireless · haptic triggers"),
            ("Xbox Series controller", "Microsoft","gaming",      35,  69, "vxe-mouse-2",      "wireless · works on PC"),
            ("Nintendo Switch Lite",   "Nintendo","gaming",      119, 219, "vxe-mouse-1",      "handheld · light and cheap"),
    };


    /// <summary>
    /// Categories, tag shortcuts and shop wording.
    ///
    /// Every part is additive and guarded on what is already there. That
    /// matters because the shop owner edits all of this from the admin site:
    /// re-running the seeder must never undo their work, so anything with a
    /// matching slug, label or key is left exactly as it is.
    /// </summary>
    private static async Task SeedStoreContentAsync(LoottaDbContext db, SeedFile? seed)
    {
        /* ------------------------------------------------------ categories */

        if (seed is not null && seed.Categories.Count > 0)
        {
            var existingSlugs = (await db.Categories.Select(c => c.Slug).ToListAsync()).ToHashSet();

            foreach (var category in seed.Categories)
            {
                if (existingSlugs.Contains(category.Slug)) continue;

                db.Categories.Add(new Category
                {
                    Name = category.Name,
                    Slug = category.Slug,
                    SortOrder = category.SortOrder,
                });
            }
        }

        /* ------------------------------------------------------ quick tags */

        if (!await db.QuickTags.AnyAsync())
        {
            var tags = seed?.QuickTags.Count > 0
                ? seed.QuickTags.Select(t => new QuickTag
                {
                    Label = t.Label,
                    Query = string.IsNullOrWhiteSpace(t.Query) ? t.Label : t.Query,
                    SortOrder = t.SortOrder,
                })
                : DefaultTags();

            db.QuickTags.AddRange(tags);
        }

        /* ------------------------------------------------------- shop text */

        var savedKeys = (await db.SiteTexts.Select(t => t.Key).ToListAsync()).ToHashSet();

        foreach (var entry in SiteTextKeys.All)
        {
            if (savedKeys.Contains(entry.Key)) continue;

            // The file wins over the default, and an admin edit wins over both
            // because a key already in the table is skipped entirely.
            var value = seed is not null && seed.SiteText.TryGetValue(entry.Key, out var fromFile)
                ? fromFile
                : entry.Default;

            db.SiteTexts.Add(new SiteText
            {
                Key = entry.Key,
                Value = value,
                Description = entry.Description,
                SortOrder = entry.SortOrder,
            });
        }

        /* -------------------------------------------------- payment methods */

        if (!await db.PaymentMethodSettings.AnyAsync())
        {
            var order = 0;

            foreach (var option in PaymentMethods.All)
            {
                db.PaymentMethodSettings.Add(new PaymentMethodSetting
                {
                    Method = option.Value.ToString(),
                    IsEnabled = true,
                    SortOrder = order++,
                });
            }
        }

        await db.SaveChangesAsync();
    }

    /// <summary>Used only when seed-data.json has no tags of its own.</summary>
    private static IEnumerable<QuickTag> DefaultTags() =>
    [
        new() { Label = "iPhone",      Query = "iphone",      SortOrder = 1 },
        new() { Label = "ThinkPad",    Query = "thinkpad",    SortOrder = 2 },
        new() { Label = "Apple Watch", Query = "apple watch", SortOrder = 3 },
        new() { Label = "Xiaomi",      Query = "xiaomi",      SortOrder = 4 },
        new() { Label = "Mouse",       Query = "mouse",       SortOrder = 5 },
        new() { Label = "Under $100",  Query = "under 100",   SortOrder = 6 },
    ];

}
