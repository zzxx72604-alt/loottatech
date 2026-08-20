using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

/// <summary>
/// A photo the customer attached when asking for a refund.
///
/// The point is evidence: a scratch, a wrong item, a cracked screen. Words
/// alone put the shop in the position of taking somebody's account of the
/// damage on trust, which is fine until two accounts disagree.
///
/// Stored as a path, never as bytes in the database — the same rule the
/// product photos follow.
/// </summary>
public class RefundPhoto
{
    public int Id { get; set; }

    public int OrderId { get; set; }
    public Order? Order { get; set; }

    /// <summary>Base path with no extension, e.g. "/uploads/products/refund-12-a4f".</summary>
    [Required, MaxLength(400)]
    public string Path { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
