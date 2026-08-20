using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace lootta.Services;

/// <summary>
/// Turns an uploaded photo into the three files the shop actually serves.
///
/// One upload becomes:
///     name-480.webp   small,  for phones
///     name-800.webp   large,  for tablet and desktop
///     name.jpg        fallback for anything that can't do webp
///
/// The browser then picks the smallest file that fits its screen, which is
/// where most of the page-weight saving comes from — a phone downloads about
/// 10 kB instead of the 2 MB original.
/// </summary>
public class ImageService
{
    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp", ".avif" };
    private const long MaxBytes = 8 * 1024 * 1024;   // 8 MB

    private readonly string _uploadRoot;

    public ImageService(IWebHostEnvironment env)
    {
        _uploadRoot = Path.Combine(env.ContentRootPath, "uploads", "products");
        Directory.CreateDirectory(_uploadRoot);
    }

    public record SaveResult(bool Ok, string Error, string BasePath, string FileName);

    /// <summary>
    /// Validates, crops to a square, and writes the three sizes.
    /// Returns the BASE path (no extension) that goes into the database.
    /// </summary>
    /// <summary>
    /// Where to crop, as fractions of the source image (0–1).
    ///
    /// Fractions rather than pixels, because the admin drew the box on a
    /// preview that was scaled to fit their screen. Sending pixels would mean
    /// the browser has to know the original dimensions and get the maths right;
    /// fractions survive any scaling.
    /// </summary>
    public record CropBox(double X, double Y, double Size);

    public async Task<SaveResult> SaveAsync(
        IFormFile file,
        string? preferredName = null,
        CropBox? crop = null)
    {
        // ---- validation ----
        if (file.Length == 0)
            return new SaveResult(false, "The file is empty.", "", "");

        if (file.Length > MaxBytes)
            return new SaveResult(false, $"Images must be under {MaxBytes / 1024 / 1024} MB.", "", "");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
            return new SaveResult(false, $"Allowed types: {string.Join(", ", AllowedExtensions)}.", "", "");

        /*
         * The uploaded filename is NEVER trusted or reused. A name like
         * "../../appsettings.json" would otherwise let an upload escape the
         * folder entirely. We generate our own name from a GUID.
         */
        var slug = Slugify(preferredName ?? Path.GetFileNameWithoutExtension(file.FileName));
        var unique = Guid.NewGuid().ToString("N")[..8];
        var name = string.IsNullOrEmpty(slug) ? unique : $"{slug}-{unique}";

        try
        {
            await using var stream = file.OpenReadStream();
            using var image = await Image.LoadAsync(stream);

            /*
             * Crop to a square: the admin's chosen box when there is one,
             * otherwise the centre. Every card is square, so this has to
             * happen somewhere — doing it here means the customer never
             * downloads pixels that will be cropped away.
             */
            if (crop is not null)
            {
                var size = (int)Math.Round(crop.Size * Math.Min(image.Width, image.Height));
                size = Math.Max(16, size);

                var x = (int)Math.Round(crop.X * image.Width);
                var y = (int)Math.Round(crop.Y * image.Height);

                // Clamp, so a rounding error or a hand-edited request can
                // never ask for pixels outside the image.
                x = Math.Clamp(x, 0, Math.Max(0, image.Width - size));
                y = Math.Clamp(y, 0, Math.Max(0, image.Height - size));
                size = Math.Min(size, Math.Min(image.Width - x, image.Height - y));

                image.Mutate(op => op.Crop(new Rectangle(x, y, size, size)));
            }
            else
            {
                var side = Math.Min(image.Width, image.Height);
                image.Mutate(op => op.Crop(new Rectangle(
                    (image.Width - side) / 2,
                    (image.Height - side) / 2,
                    side,
                    side)));
            }

            foreach (var size in new[] { 480, 800 })
            {
                using var resized = image.Clone(x => x.Resize(size, size));
                await resized.SaveAsync(
                    Path.Combine(_uploadRoot, $"{name}-{size}.webp"),
                    new WebpEncoder { Quality = 80 });
            }

            using var fallback = image.Clone(x => x.Resize(800, 800));
            await fallback.SaveAsync(
                Path.Combine(_uploadRoot, $"{name}.jpg"),
                new JpegEncoder { Quality = 82 });

            return new SaveResult(true, "", $"/uploads/products/{name}", name);
        }
        catch (UnknownImageFormatException)
        {
            // A file can be named .jpg and contain anything at all. This is
            // what catches that, rather than trusting the extension.
            return new SaveResult(false, "That file isn't a readable image.", "", "");
        }
    }

    /// <summary>Removes all three files for a stored base path.</summary>
    public void Delete(string basePath)
    {
        var name = Path.GetFileName(basePath);
        if (string.IsNullOrWhiteSpace(name)) return;

        foreach (var candidate in new[] { $"{name}-480.webp", $"{name}-800.webp", $"{name}.jpg" })
        {
            var full = Path.Combine(_uploadRoot, candidate);

            // Belt and braces: never delete outside the uploads folder, even if
            // a crafted path somehow reached this far.
            if (!Path.GetFullPath(full).StartsWith(Path.GetFullPath(_uploadRoot))) continue;
            if (File.Exists(full)) File.Delete(full);
        }
    }

    private static string Slugify(string value)
    {
        var cleaned = new string(value.ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) ? c : '-')
            .ToArray());

        while (cleaned.Contains("--")) cleaned = cleaned.Replace("--", "-");
        cleaned = cleaned.Trim('-');

        return cleaned.Length > 40 ? cleaned[..40].Trim('-') : cleaned;
    }
}
