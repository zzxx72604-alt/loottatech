using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

/// <summary>
/// A customer's review of a product they actually bought.
///
/// The rating is NEVER stored on the product. A product's score is calculated
/// from these rows, so it cannot drift away from the reviews that produced it
/// — and it cannot be set by hand.
/// </summary>
public class Review
{
    public int Id { get; set; }

    public int ProductId { get; set; }
    public Product? Product { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    /// <summary>1 to 5. Validated on the way in; nothing else is accepted.</summary>
    [Range(1, 5)]
    public int Rating { get; set; }

    [MaxLength(1500)]
    public string Body { get; set; } = string.Empty;

    /// <summary>Optional photo, stored as a base path like the product images.</summary>
    [MaxLength(400)]
    public string ImageUrl { get; set; } = string.Empty;

    /// <summary>
    /// True when the reviewer had a completed order containing this product.
    /// Recorded at write time rather than checked at read time, so later
    /// order changes cannot silently rewrite an old review's badge.
    /// </summary>
    public bool VerifiedPurchase { get; set; }

    /// <summary>Admin moderation. Hidden reviews stay in the database.</summary>
    public bool IsHidden { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
