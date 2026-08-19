using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

public enum ReportTarget
{
    Product,
    Review
}

public enum ReportStatus
{
    Open,
    Actioned,
    Dismissed
}

/// <summary>
/// A customer flagging something for the shop to look at.
///
/// Reports never hide anything by themselves. A hundred reports from one angry
/// person should not remove a product — a human decides, and the report is the
/// prompt, not the verdict.
/// </summary>
public class Report
{
    public int Id { get; set; }

    public int ReporterId { get; set; }
    public User? Reporter { get; set; }

    public ReportTarget Target { get; set; }

    /// <summary>Product id or review id, depending on <see cref="Target"/>.</summary>
    public int TargetId { get; set; }

    [Required, MaxLength(60)]
    public string Reason { get; set; } = string.Empty;

    [MaxLength(600)]
    public string Details { get; set; } = string.Empty;

    public ReportStatus Status { get; set; } = ReportStatus.Open;

    /// <summary>What the admin decided, kept for the record.</summary>
    [MaxLength(300)]
    public string Resolution { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
}
