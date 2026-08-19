using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Dtos;
using lootta.Models;
using lootta.Services;

namespace lootta.Controllers;

[ApiController]
[Route("api/products/{productId:int}/reviews")]
public class ReviewsController : ControllerBase
{
    private readonly LoottaDbContext _db;
    private readonly ImageService _images;

    public ReviewsController(LoottaDbContext db, ImageService images)
    {
        _db = db;
        _images = images;
    }

    private int? CurrentUserIdOrNull()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(claim, out var id) ? id : null;
    }

    private bool IsAdmin => User.IsInRole("Admin");

    /* -------------------------------------------------------------- read */

    /// <summary>
    /// A page of reviews plus the rating summary.
    ///
    /// Defaults to three, because the product page shows a few and hides the
    /// rest behind "see more" — loading two hundred reviews nobody scrolls to
    /// is wasted bandwidth on every single page view.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ReviewPageDto>> Get(
        int productId,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 3)
    {
        if (!await _db.Products.AnyAsync(p => p.Id == productId))
            return NotFound($"No product with id {productId}.");

        take = Math.Clamp(take, 1, 50);
        var userId = CurrentUserIdOrNull();

        var visible = _db.Reviews.Where(r => r.ProductId == productId && !r.IsHidden);

        var total = await visible.CountAsync();

        var rows = await visible
            .OrderByDescending(r => r.VerifiedPurchase)
            .ThenByDescending(r => r.CreatedAt)
            .Skip(skip)
            .Take(take)
            .Include(r => r.User)
            .AsNoTracking()
            .ToListAsync();

        return Ok(new ReviewPageDto
        {
            Summary = await BuildSummaryAsync(productId, userId),
            Reviews = rows.Select(r => ToDto(r, userId)).ToList(),
            HasMore = skip + rows.Count < total,
            Total = total,
        });
    }

    /* ------------------------------------------------------------- write */

    /// <summary>
    /// Write a review. Only for products this customer has actually received.
    ///
    /// That single rule removes the entire abuse category: a shop cannot
    /// five-star its own stock, and nobody can review something they never
    /// bought. It is one database check.
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ReviewDto>> Write(int productId, WriteReviewDto dto)
    {
        var userId = CurrentUserIdOrNull()!.Value;

        if (!await _db.Products.AnyAsync(p => p.Id == productId))
            return NotFound($"No product with id {productId}.");

        if (await _db.Reviews.AnyAsync(r => r.ProductId == productId && r.UserId == userId))
            return BadRequest("You've already reviewed this product.");

        if (!await HasReceivedAsync(productId, userId))
            return BadRequest("You can review this once your order has been completed.");

        var review = new Review
        {
            ProductId = productId,
            UserId = userId,
            Rating = dto.Rating,
            Body = dto.Body.Trim(),
            VerifiedPurchase = true,
        };

        _db.Reviews.Add(review);
        await _db.SaveChangesAsync();

        await _db.Entry(review).Reference(r => r.User).LoadAsync();
        return Ok(ToDto(review, userId));
    }

    /// <summary>Attach a photo to your own review.</summary>
    [HttpPost("{reviewId:int}/image")]
    [Authorize]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<ReviewDto>> UploadImage(int productId, int reviewId, IFormFile file)
    {
        var userId = CurrentUserIdOrNull()!.Value;

        var review = await _db.Reviews
            .FirstOrDefaultAsync(r => r.Id == reviewId && r.ProductId == productId);

        if (review is null) return NotFound("Review not found.");
        if (review.UserId != userId) return Forbid();
        if (file is null) return BadRequest("No file was sent.");

        var result = await _images.SaveAsync(file, $"review-{reviewId}");
        if (!result.Ok) return BadRequest(result.Error);

        var old = review.ImageUrl;
        review.ImageUrl = result.BasePath;
        await _db.SaveChangesAsync();

        if (!string.IsNullOrWhiteSpace(old)) _images.Delete(old);

        await _db.Entry(review).Reference(r => r.User).LoadAsync();
        return Ok(ToDto(review, userId));
    }

    /// <summary>Delete your own review, or any review if you're an admin.</summary>
    [HttpDelete("{reviewId:int}")]
    [Authorize]
    public async Task<IActionResult> Delete(int productId, int reviewId)
    {
        var userId = CurrentUserIdOrNull()!.Value;

        var review = await _db.Reviews
            .FirstOrDefaultAsync(r => r.Id == reviewId && r.ProductId == productId);

        if (review is null) return NotFound("Review not found.");
        if (review.UserId != userId && !IsAdmin) return Forbid();

        var image = review.ImageUrl;
        _db.Reviews.Remove(review);
        await _db.SaveChangesAsync();

        if (!string.IsNullOrWhiteSpace(image)) _images.Delete(image);
        return NoContent();
    }

    /// <summary>Admin: hide a review without destroying it.</summary>
    [HttpPut("{reviewId:int}/hidden")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> SetHidden(int productId, int reviewId, [FromQuery] bool value)
    {
        var review = await _db.Reviews
            .FirstOrDefaultAsync(r => r.Id == reviewId && r.ProductId == productId);

        if (review is null) return NotFound("Review not found.");

        review.IsHidden = value;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /* ----------------------------------------------------------- helpers */

    /// <summary>Did this customer receive this product in a completed order?</summary>
    private async Task<bool> HasReceivedAsync(int productId, int userId) =>
        await _db.OrderItems.AnyAsync(i =>
            i.ProductId == productId &&
            i.Order!.UserId == userId &&
            i.Order.Status == OrderStatus.Completed);

    private async Task<RatingSummaryDto> BuildSummaryAsync(int productId, int? userId)
    {
        // One grouped query for the whole distribution, not five counts.
        var grouped = await _db.Reviews
            .Where(r => r.ProductId == productId && !r.IsHidden)
            .GroupBy(r => r.Rating)
            .Select(g => new { Stars = g.Key, Count = g.Count() })
            .ToListAsync();

        var distribution = new int[5];
        foreach (var row in grouped)
        {
            if (row.Stars is >= 1 and <= 5) distribution[row.Stars - 1] = row.Count;
        }

        var count = distribution.Sum();
        var points = distribution.Select((n, index) => n * (index + 1)).Sum();

        var summary = new RatingSummaryDto
        {
            Count = count,
            Distribution = distribution,
            Average = count == 0 ? 0 : Math.Round((double)points / count, 1),
            Percentages = distribution
                .Select(n => count == 0 ? 0 : Math.Round(n * 100.0 / count, 1))
                .ToArray(),
        };

        if (userId is null)
        {
            summary.CannotReviewReason = "Sign in to write a review.";
            return summary;
        }

        summary.AlreadyReviewed = await _db.Reviews
            .AnyAsync(r => r.ProductId == productId && r.UserId == userId);

        if (summary.AlreadyReviewed)
        {
            summary.CannotReviewReason = "You've already reviewed this product.";
        }
        else if (!await HasReceivedAsync(productId, userId.Value))
        {
            summary.CannotReviewReason = "You can review this once your order is completed.";
        }
        else
        {
            summary.CanReview = true;
        }

        return summary;
    }

    private static ReviewDto ToDto(Review r, int? currentUserId) => new()
    {
        Id = r.Id,
        Rating = r.Rating,
        Body = r.Body,
        ImageUrl = r.ImageUrl,
        VerifiedPurchase = r.VerifiedPurchase,
        CreatedAt = r.CreatedAt,
        Author = ShortName(r.User?.Name ?? "Customer"),
        IsMine = currentUserId is not null && r.UserId == currentUserId,
    };

    /// <summary>"Sok Dara" becomes "Sok D." — recognisable, not identifying.</summary>
    private static string ShortName(string name)
    {
        var parts = name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "Customer";
        if (parts.Length == 1) return parts[0];

        return $"{parts[0]} {parts[^1][0]}.";
    }
}
