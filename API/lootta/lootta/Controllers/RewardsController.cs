using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Dtos;
using lootta.Models;

namespace lootta.Controllers;

/// <summary>
/// Lootta Coins: earned by playing Lootta Flyer, spent on discount vouchers.
///
/// This controller owns the BALANCE and the VOUCHERS. Earning happens in
/// GameController. Either way the browser never decides a number — it sends a
/// score or a voucher key, and the server works out what that is worth.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RewardsController : ControllerBase
{
    private readonly LoottaDbContext _db;

    public RewardsController(LoottaDbContext db) => _db = db;

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<RewardStateDto>> GetState()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var vouchers = await _db.Vouchers
            .Where(v => v.UserId == user.Id)
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync();

        return Ok(new RewardStateDto
        {
            Balance = user.Coins,
            Streak = user.PlayStreak,
            BestScore = user.BestScore,
            Catalog = VoucherCatalog.All.Select(o => new VoucherOptionDto
            {
                Key = o.Key,
                Label = o.Label,
                Description = o.Description,
                CoinCost = o.CoinCost,
                Affordable = user.Coins >= o.CoinCost
            }).ToList(),
            Vouchers = vouchers.Select(ToDto).ToList()
        });
    }

    /// <summary>Swap coins for a voucher. Deducting and creating happen together.</summary>
    [HttpPost("redeem")]
    public async Task<ActionResult<VoucherDto>> Redeem(RedeemDto dto)
    {
        var option = VoucherCatalog.Find(dto.Key);
        if (option is null) return BadRequest("Unknown reward.");

        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        if (user.Coins < option.CoinCost)
            return BadRequest($"You need {option.CoinCost - user.Coins} more coins.");

        var voucher = new Voucher
        {
            Code = await GenerateCodeAsync(),
            UserId = user.Id,
            Type = option.Type,
            Value = option.Value,
            MinSpend = option.MinSpend,
            MaxDiscount = option.MaxDiscount,
            CoinCost = option.CoinCost,
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        };

        // One SaveChanges for both — the coins can never be taken without the
        // voucher being created, or the other way round.
        user.Coins -= option.CoinCost;
        _db.Vouchers.Add(voucher);
        await _db.SaveChangesAsync();

        return Ok(ToDto(voucher));
    }

    /* ------------------------------------------------------------ helpers */

    private async Task<string> GenerateCodeAsync()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = "LC-" + new string(Enumerable.Range(0, 6)
                .Select(_ => alphabet[Random.Shared.Next(alphabet.Length)]).ToArray());

            if (!await _db.Vouchers.AnyAsync(v => v.Code == code)) return code;
        }
        return "LC-" + DateTime.UtcNow.Ticks.ToString()[^8..];
    }

    private static VoucherDto ToDto(Voucher v) => new()
    {
        Id = v.Id,
        Code = v.Code,
        Label = v.Type == VoucherType.Fixed ? $"${v.Value:0.##} off" : $"{v.Value:0.##}% off",
        Type = v.Type.ToString(),
        Value = v.Value,
        MinSpend = v.MinSpend,
        ExpiresAt = v.ExpiresAt,
        Usable = v.IsUsable,
        UsedAt = v.UsedAt
    };
}
