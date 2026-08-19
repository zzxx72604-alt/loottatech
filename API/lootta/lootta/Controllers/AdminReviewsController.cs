using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Dtos;
using lootta.Services;

namespace lootta.Controllers;

/// <summary>
/// Review moderation across the whole shop.
///
/// The customer-facing controller is scoped to one product, which is right for
/// a product page and useless for moderation — an admin needs to see what was
/// posted recently regardless of where.
/// </summary>
[ApiController]
[Route("api/admin/reviews")]
[Authorize(Policy = "AdminOnly")]
public class AdminReviewsController : ControllerBase
{
    private readonly LoottaDbContext _db;
    private readonly ImageService _images;

    public AdminReviewsController(LoottaDbContext db, ImageService images)
    {
        _db = db;
        _images = images;
    }

    /// <summary>Recent reviews, newest first, including hidden ones.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdminReviewDto>>> Get(
        [FromQuery] string? search,
        [FromQuery] bool onlyHidden = false,
        [FromQuery] int take = 100)
    {
        var query = _db.Reviews
            .Include(r => r.User)
            .Include(r => r.Product)
            .AsNoTracking()
            .AsQueryable();

        if (onlyHidden) query = query.Where(r => r.IsHidden);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(r =>
                EF.Functions.Like(r.Body, $"%{term}%") ||
                EF.Functions.Like(r.Product!.Title, $"%{term}%") ||
                EF.Functions.Like(r.User!.Name, $"%{term}%"));
        }

        var rows = await query
            .OrderByDescending(r => r.CreatedAt)
            .Take(Math.Clamp(take, 1, 300))
            .ToListAsync();

        return Ok(rows.Select(r => new AdminReviewDto
        {
            Id = r.Id,
            ProductId = r.ProductId,
            ProductTitle = r.Product?.Title ?? "(deleted product)",
            CustomerId = r.UserId,
            CustomerName = r.User?.Name ?? "(deleted account)",
            Rating = r.Rating,
            Body = r.Body,
            ImageUrl = r.ImageUrl,
            VerifiedPurchase = r.VerifiedPurchase,
            IsHidden = r.IsHidden,
            CreatedAt = r.CreatedAt,
        }));
    }

    /// <summary>
    /// Hide or show a review.
    ///
    /// Hiding rather than deleting: the row stays, so a moderation decision can
    /// be reversed and a pattern of abuse from one account is still visible.
    /// Hidden reviews are excluded from the product's rating.
    /// </summary>
    [HttpPut("{id:int}/hidden")]
    public async Task<IActionResult> SetHidden(int id, [FromQuery] bool value)
    {
        var review = await _db.Reviews.FindAsync(id);
        if (review is null) return NotFound($"No review with id {id}.");

        review.IsHidden = value;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Delete permanently, including any attached photo.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var review = await _db.Reviews.FindAsync(id);
        if (review is null) return NotFound($"No review with id {id}.");

        var image = review.ImageUrl;
        _db.Reviews.Remove(review);
        await _db.SaveChangesAsync();

        if (!string.IsNullOrWhiteSpace(image)) _images.Delete(image);
        return NoContent();
    }
}
