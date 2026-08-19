using System.ComponentModel.DataAnnotations;

namespace lootta.Dtos;

public class CreateReportDto
{
    /// <summary>"Product" or "Review".</summary>
    [Required]
    public string Target { get; set; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int TargetId { get; set; }

    [Required, MaxLength(60)]
    public string Reason { get; set; } = string.Empty;

    [MaxLength(600)]
    public string Details { get; set; } = string.Empty;
}

public class ReportDto
{
    public int Id { get; set; }
    public string Target { get; set; } = string.Empty;
    public int TargetId { get; set; }

    /// <summary>Product title or the review's opening words, for the queue.</summary>
    public string TargetLabel { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Resolution { get; set; } = string.Empty;

    public int ReporterId { get; set; }
    public string ReporterName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}

public class ResolveReportDto
{
    /// <summary>"Actioned" or "Dismissed".</summary>
    [Required]
    public string Status { get; set; } = string.Empty;

    [MaxLength(300)]
    public string Resolution { get; set; } = string.Empty;
}

/// <summary>The reasons offered, so the client never invents its own.</summary>
public static class ReportReasons
{
    public static readonly string[] ForProduct =
    {
        "Wrong or misleading description",
        "Photos don't match the item",
        "Price looks wrong",
        "Prohibited or unsafe item",
        "Something else",
    };

    public static readonly string[] ForReview =
    {
        "Offensive language",
        "Spam or advertising",
        "Not about this product",
        "Personal information",
        "Something else",
    };
}
