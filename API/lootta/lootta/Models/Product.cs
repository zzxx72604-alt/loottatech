using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

public class Product
{
    public int Id { get; set; }

    [Required, MaxLength(160)]
    public string Title { get; set; } = string.Empty;

    [Required, MaxLength(60)]
    public string Brand { get; set; } = string.Empty;

    // ---- relationship: many products belong to one category ----
    public int CategoryId { get; set; }
    public Category? Category { get; set; }

    public ProductCondition Condition { get; set; } = ProductCondition.Good;

    /// <summary>What the customer pays today.</summary>
    public decimal Price { get; set; }

    /// <summary>Retail price when new. Shown struck through. 0 means "don't show".</summary>
    public decimal OriginalPrice { get; set; }

    public int Stock { get; set; } = 1;

    /// <summary>Months of shop warranty. 0 means sold as-seen.</summary>
    public int WarrantyMonths { get; set; }

    /// <summary>Whether the shop powered it on and checked it.</summary>
    public bool Tested { get; set; } = true;

    [MaxLength(2000)]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Honest note about scratches, dents or battery wear.
    /// This is the trust signal that makes a used-goods listing credible.
    /// </summary>
    [MaxLength(600)]
    public string FlawNotes { get; set; } = string.Empty;

    /// <summary>Hidden from the customer site when false, but never deleted.</summary>
    public bool IsActive { get; set; } = true;

    public int WatchCount { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // ---- child collections ----
    public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();
    public ICollection<ProductSpec> Specs { get; set; } = new List<ProductSpec>();
}
