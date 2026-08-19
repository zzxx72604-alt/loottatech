using System.ComponentModel.DataAnnotations;

namespace lootta.Dtos;

public class ReviewDto
{
    public int Id { get; set; }
    public int Rating { get; set; }
    public string Body { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public bool VerifiedPurchase { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>Shortened for display, e.g. "Sok D." — full names aren't public.</summary>
    public string Author { get; set; } = string.Empty;
    public bool IsMine { get; set; }
}

/// <summary>
/// The rating summary shown above the review list.
///
/// Every figure is derived from the review rows. Nothing here is stored, so a
/// product's score can never disagree with the reviews underneath it.
/// </summary>
public class RatingSummaryDto
{
    /// <summary>Mean rating, one decimal place. 0 when there are no reviews.</summary>
    public double Average { get; set; }
    public int Count { get; set; }

    /// <summary>How many reviews gave each score. Index 0 is one star.</summary>
    public int[] Distribution { get; set; } = new int[5];

    /// <summary>Same, as percentages, for the bar widths.</summary>
    public double[] Percentages { get; set; } = new double[5];

    /// <summary>Whether the signed-in customer may write one.</summary>
    public bool CanReview { get; set; }
    public string CannotReviewReason { get; set; } = string.Empty;
    public bool AlreadyReviewed { get; set; }
}

public class ReviewPageDto
{
    public RatingSummaryDto Summary { get; set; } = new();
    public List<ReviewDto> Reviews { get; set; } = new();
    public bool HasMore { get; set; }
    public int Total { get; set; }
}

public class WriteReviewDto
{
    [Range(1, 5, ErrorMessage = "Choose between one and five stars.")]
    public int Rating { get; set; }

    [MaxLength(1500)]
    public string Body { get; set; } = string.Empty;
}
