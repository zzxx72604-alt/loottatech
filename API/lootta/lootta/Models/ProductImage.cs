using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

/// <summary>
/// One uploaded photo.
///
/// Only the FILE PATH lives in SQL Server — never the image bytes. The file
/// itself sits in wwwroot-served /uploads/products, which keeps the database
/// small and makes it easy to swap in cloud storage later.
/// </summary>
public class ProductImage
{
    public int Id { get; set; }

    public int ProductId { get; set; }
    public Product? Product { get; set; }

    /// <summary>Server-generated file name. The uploaded name is never trusted.</summary>
    [Required, MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    /// <summary>Public path, e.g. "/uploads/products/8f3c....webp".</summary>
    [Required, MaxLength(400)]
    public string Url { get; set; } = string.Empty;

    /// <summary>The photo shown on the product card.</summary>
    public bool IsPrimary { get; set; }

    public int SortOrder { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
