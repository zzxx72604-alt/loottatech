using Microsoft.EntityFrameworkCore;
using lootta.Models;

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
    public static async Task SeedAsync(LoottaDbContext db)
    {
        if (await db.Products.AnyAsync()) return;   // already stocked

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
    }

    private static Product Build(
        string title, string brand, int categoryId, ProductCondition condition,
        decimal price, decimal originalPrice, int stock, int warrantyMonths,
        bool tested, int watchCount, string description, string flawNotes,
        string[] imageNames, (string Key, string Value)[] specs)
    {
        var product = new Product
        {
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
}
