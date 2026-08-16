using System.ComponentModel.DataAnnotations;
using lootta.Models;

namespace lootta.Dtos;

/*
 * DTOs — Data Transfer Objects.
 *
 * The API never returns an EF entity directly. Entities carry navigation
 * properties that would serialise in circles (Product -> Category -> Products),
 * and they expose columns the client has no business seeing. A DTO is the
 * public shape of the API, decided by us rather than by the database.
 */

/// <summary>Shape used by the product grid — small on purpose.</summary>
public class ProductListDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int CategoryId { get; set; }

    /// <summary>"new" | "like-new" | "good" | "fair"</summary>
    public string Condition { get; set; } = string.Empty;

    public decimal Price { get; set; }
    public decimal OriginalPrice { get; set; }
    public int Stock { get; set; }
    public int WarrantyMonths { get; set; }
    public bool Tested { get; set; }
    public int WatchCount { get; set; }
    public bool IsActive { get; set; }

    /// <summary>Base image paths, no size suffix. The client appends -480.webp etc.</summary>
    public List<string> Images { get; set; } = new();
}

/// <summary>Everything the product page needs.</summary>
public class ProductDetailDto : ProductListDto
{
    public string Description { get; set; } = string.Empty;
    public string FlawNotes { get; set; } = string.Empty;
    public List<SpecDto> Specs { get; set; } = new();
    public List<ProductImageDto> ImageDetails { get; set; } = new();
}

public class SpecDto
{
    [Required, MaxLength(60)]
    public string Key { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string Value { get; set; } = string.Empty;
}

public class ProductImageDto
{
    public int Id { get; set; }
    public string Url { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>What the admin sends to create or update a product.</summary>
public class ProductWriteDto
{
    [Required, MaxLength(160)]
    public string Title { get; set; } = string.Empty;

    [Required, MaxLength(60)]
    public string Brand { get; set; } = string.Empty;

    [Range(1, int.MaxValue, ErrorMessage = "Choose a category.")]
    public int CategoryId { get; set; }

    /// <summary>"new" | "like-new" | "good" | "fair"</summary>
    [Required]
    public string Condition { get; set; } = "good";

    [Range(0, 1_000_000)]
    public decimal Price { get; set; }

    [Range(0, 1_000_000)]
    public decimal OriginalPrice { get; set; }

    [Range(0, 10_000)]
    public int Stock { get; set; } = 1;

    [Range(0, 120)]
    public int WarrantyMonths { get; set; }

    public bool Tested { get; set; } = true;
    public bool IsActive { get; set; } = true;

    [MaxLength(2000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(600)]
    public string FlawNotes { get; set; } = string.Empty;

    public List<SpecDto> Specs { get; set; } = new();
}

/// <summary>
/// Converts between the C# enum and the lower-case strings the Angular apps
/// already use, so the existing frontend needs no changes.
/// </summary>
public static class ConditionMap
{
    public static string ToApi(this ProductCondition condition) => condition switch
    {
        ProductCondition.New => "new",
        ProductCondition.LikeNew => "like-new",
        ProductCondition.Good => "good",
        ProductCondition.Fair => "fair",
        _ => "good"
    };

    public static ProductCondition FromApi(string? value) => (value ?? "").ToLowerInvariant() switch
    {
        "new" => ProductCondition.New,
        "like-new" or "likenew" => ProductCondition.LikeNew,
        "good" => ProductCondition.Good,
        "fair" => ProductCondition.Fair,
        _ => ProductCondition.Good
    };
}
