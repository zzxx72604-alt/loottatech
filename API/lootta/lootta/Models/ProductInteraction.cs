namespace lootta.Models;

/// <summary>
/// What one customer has done with one product.
///
/// Like and Save are SEPARATE states — liking something you'd never buy and
/// saving something to buy later are different intentions, and the spec is
/// right to keep them apart.
///
/// They live as two columns on one row rather than two tables, because the key
/// is identical (user + product) and a customer almost always does both or
/// neither. Two tables would mean two joins to answer "what did this person do
/// with this product", for no gain.
/// </summary>
public class ProductInteraction
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    public int ProductId { get; set; }
    public Product? Product { get; set; }

    /// <summary>Public signal. Drives the like count and popularity sorting.</summary>
    public bool Liked { get; set; }

    /// <summary>Private wishlist. Nobody else sees it.</summary>
    public bool Saved { get; set; }

    public DateTime? LikedAt { get; set; }
    public DateTime? SavedAt { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
