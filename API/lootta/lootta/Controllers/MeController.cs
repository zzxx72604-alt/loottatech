using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Dtos;
using lootta.Models;
using lootta.Services;

namespace lootta.Controllers;

/// <summary>
/// Everything about the signed-in customer: their likes, their saved items,
/// and their profile summary.
///
/// Routed under /api/me so no endpoint takes a user id from the caller. You
/// can only ever read your own data, which removes the whole IDOR problem
/// rather than guarding against it one endpoint at a time.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MeController : ControllerBase
{
    private readonly LoottaDbContext _db;
    private readonly ImageService _images;

    public MeController(LoottaDbContext db, ImageService images)
    {
        _db = db;
        _images = images;
    }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /* ------------------------------------------------------------ profile */

    [HttpGet("profile")]
    public async Task<ActionResult<ProfileDto>> Profile()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var orders = await _db.Orders
            .Where(o => o.UserId == user.Id && o.Status != OrderStatus.Cancelled)
            .Include(o => o.Items)
            .AsNoTracking()
            .ToListAsync();

        var itemsBought = orders.Sum(o => o.Items.Sum(i => i.Quantity));

        return Ok(new ProfileDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Phone = MaskPhone(user.Phone),
            Address = user.Address,
            Gender = user.Gender,
            AvatarUrl = user.AvatarUrl,
            MemberSince = user.CreatedAt,

            Coins = user.Coins,
            BestScore = user.BestScore,
            PlayStreak = user.PlayStreak,

            OrderCount = orders.Count,
            ItemsBought = itemsBought,
            TotalSpent = orders.Sum(o => o.Total),

            LikeCount = await _db.ProductInteractions.CountAsync(i => i.UserId == user.Id && i.Liked),
            SaveCount = await _db.ProductInteractions.CountAsync(i => i.UserId == user.Id && i.Saved),
        });
    }

    /// <summary>
    /// The same details, unmasked, for the settings form.
    ///
    /// Separate from /profile on purpose: the display version masks the phone
    /// number, and an edit form needs the real one. Two shapes rather than one
    /// that sometimes lies.
    /// </summary>
    [HttpGet("editable")]
    public async Task<ActionResult<EditableProfileDto>> Editable()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        return Ok(new EditableProfileDto
        {
            Name = user.Name,
            Email = user.Email,
            Phone = user.Phone,
            Address = user.Address,
            Gender = user.Gender,
            AvatarUrl = user.AvatarUrl,
        });
    }

    /// <summary>Update the editable details. Email and password live in Security.</summary>
    [HttpPut("profile")]
    public async Task<ActionResult<EditableProfileDto>> Update(UpdateProfileDto dto)
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        user.Name = dto.Name.Trim();
        user.Phone = dto.Phone.Trim();
        user.Address = dto.Address.Trim();
        user.Gender = dto.Gender.Trim();

        await _db.SaveChangesAsync();

        return Ok(new EditableProfileDto
        {
            Name = user.Name,
            Email = user.Email,
            Phone = user.Phone,
            Address = user.Address,
            Gender = user.Gender,
            AvatarUrl = user.AvatarUrl,
        });
    }

    /// <summary>Upload or replace the profile picture.</summary>
    [HttpPost("avatar")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<EditableProfileDto>> Avatar(IFormFile file)
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();
        if (file is null) return BadRequest("No file was sent.");

        // Same pipeline as product photos: cropped square, three sizes.
        var result = await _images.SaveAsync(file, $"avatar-{user.Id}");
        if (!result.Ok) return BadRequest(result.Error);

        var old = user.AvatarUrl;
        user.AvatarUrl = result.BasePath;
        await _db.SaveChangesAsync();

        // Remove the previous file only once the new one is safely stored.
        if (!string.IsNullOrWhiteSpace(old)) _images.Delete(old);

        return Ok(new EditableProfileDto
        {
            Name = user.Name,
            Email = user.Email,
            Phone = user.Phone,
            Address = user.Address,
            Gender = user.Gender,
            AvatarUrl = user.AvatarUrl,
        });
    }

    /* -------------------------------------------------------------- lists */

    [HttpGet("likes")]
    public async Task<ActionResult<IEnumerable<ProductListDto>>> Likes() =>
        Ok(await InteractedProductsAsync(i => i.Liked, i => i.LikedAt));

    [HttpGet("saves")]
    public async Task<ActionResult<IEnumerable<ProductListDto>>> Saves() =>
        Ok(await InteractedProductsAsync(i => i.Saved, i => i.SavedAt));

    /// <summary>
    /// The ids the customer has liked and saved.
    ///
    /// Fetched once when the app starts so every product card can show the
    /// right state without asking per card — one request instead of forty.
    /// </summary>
    [HttpGet("interactions")]
    public async Task<ActionResult<InteractionStateDto>> Interactions()
    {
        var rows = await _db.ProductInteractions
            .Where(i => i.UserId == CurrentUserId && (i.Liked || i.Saved))
            .AsNoTracking()
            .ToListAsync();

        return Ok(new InteractionStateDto
        {
            Liked = rows.Where(r => r.Liked).Select(r => r.ProductId).ToList(),
            Saved = rows.Where(r => r.Saved).Select(r => r.ProductId).ToList(),
        });
    }

    /* ------------------------------------------------------------ toggles */

    [HttpPost("likes/{productId:int}")]
    public Task<ActionResult<ToggleResultDto>> ToggleLike(int productId) =>
        ToggleAsync(productId, like: true);

    [HttpPost("saves/{productId:int}")]
    public Task<ActionResult<ToggleResultDto>> ToggleSave(int productId) =>
        ToggleAsync(productId, like: false);

    /* ----------------------------------------------------------- internals */

    private async Task<ActionResult<ToggleResultDto>> ToggleAsync(int productId, bool like)
    {
        if (!await _db.Products.AnyAsync(p => p.Id == productId))
            return NotFound($"No product with id {productId}.");

        var row = await _db.ProductInteractions
            .FirstOrDefaultAsync(i => i.UserId == CurrentUserId && i.ProductId == productId);

        if (row is null)
        {
            row = new ProductInteraction { UserId = CurrentUserId, ProductId = productId };
            _db.ProductInteractions.Add(row);
        }

        if (like)
        {
            row.Liked = !row.Liked;
            row.LikedAt = row.Liked ? DateTime.UtcNow : null;
        }
        else
        {
            row.Saved = !row.Saved;
            row.SavedAt = row.Saved ? DateTime.UtcNow : null;
        }

        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new ToggleResultDto
        {
            ProductId = productId,
            Liked = row.Liked,
            Saved = row.Saved,
            LikeCount = await _db.ProductInteractions.CountAsync(i => i.ProductId == productId && i.Liked),
        });
    }

    private async Task<List<ProductListDto>> InteractedProductsAsync(
        System.Linq.Expressions.Expression<Func<ProductInteraction, bool>> filter,
        Func<ProductInteraction, DateTime?> orderKey)
    {
        var rows = await _db.ProductInteractions
            .Where(i => i.UserId == CurrentUserId)
            .Where(filter)
            .Include(i => i.Product!).ThenInclude(p => p.Images)
            .Include(i => i.Product!).ThenInclude(p => p.Category)
            .AsNoTracking()
            .ToListAsync();

        return rows
            .OrderByDescending(orderKey)
            .Where(r => r.Product is not null)
            .Select(r => ProductMapping.ToListDto(r.Product!))
            .ToList();
    }

    /// <summary>Shows enough of a number to recognise, not enough to reuse.</summary>
    private static string MaskPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length < 5) return digits;

        return $"{digits[..1]}***-{digits[^4..]}";
    }
}
