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
/// Coin balance and vouchers.
///
/// Prices come from EconomyConfig, so the admin can retune the whole shop
/// without a code change. Earning happens in GameController and at checkout.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RewardsController : ControllerBase
{
    private readonly LoottaDbContext _db;
    private readonly EconomyService _economy;

    public RewardsController(LoottaDbContext db, EconomyService economy)
    {
        _db = db;
        _economy = economy;
    }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<RewardStateDto>> GetState()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var config = await _economy.GetAsync();

        var vouchers = await _db.Vouchers
            .Where(v => v.UserId == user.Id)
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync();

        return Ok(new RewardStateDto
        {
            Balance = user.Coins,
            Streak = user.PlayStreak,
            BestScore = user.BestScore,
            Catalog = EconomyService.VoucherTiers(config).Select(t => new VoucherOptionDto
            {
                Key = t.Key,
                Label = $"${t.Value:0.##} off",
                Description = $"On orders over ${t.MinSpend:0.##}",
                Value = t.Value,
                CoinCost = t.CoinCost,
                Affordable = user.Coins >= t.CoinCost,
            }).ToList(),
            Vouchers = vouchers.Select(ToDto).ToList(),
        });
    }

    /// <summary>Swap coins for a voucher. Deducting and creating happen together.</summary>
    [HttpPost("redeem")]
    public async Task<ActionResult<VoucherDto>> Redeem(RedeemDto dto)
    {
        var config = await _economy.GetAsync();
        var tier = EconomyService.FindTier(dto.Key, config);
        if (tier is null) return BadRequest("Unknown reward.");

        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        if (user.Coins < tier.CoinCost)
            return BadRequest($"You need {tier.CoinCost - user.Coins} more coins.");

        var voucher = new Voucher
        {
            Code = await GenerateCodeAsync(),
            UserId = user.Id,
            Type = VoucherType.Fixed,
            Value = tier.Value,
            MinSpend = tier.MinSpend,
            MaxDiscount = 0,
            CoinCost = tier.CoinCost,
            ExpiresAt = DateTime.UtcNow.AddDays(config.VoucherExpiryDays),
        };

        // One save for both, so coins can never leave without a voucher arriving.
        user.Coins -= tier.CoinCost;
        _db.Vouchers.Add(voucher);
        await _db.SaveChangesAsync();

        return Ok(ToDto(voucher));
    }

    /* ------------------------------------------------------- admin tools */

    /// <summary>
    /// Mint vouchers by hand. Useful for promotions, and for testing the
    /// checkout discount without grinding coins first.
    /// </summary>
    [HttpPost("admin/generate")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<IEnumerable<VoucherDto>>> Generate(AdminVoucherDto dto)
    {
        if (dto.UserId is not null && !await _db.Users.AnyAsync(u => u.Id == dto.UserId))
            return BadRequest($"No user with id {dto.UserId}.");

        var created = new List<Voucher>();

        for (var i = 0; i < dto.Count; i++)
        {
            var voucher = new Voucher
            {
                Code = await GenerateCodeAsync(),
                UserId = dto.UserId,          // null = a public code anyone can use
                IsAdminIssued = true,
                Type = VoucherType.Fixed,
                Value = dto.Value,
                MinSpend = dto.MinSpend,
                MaxDiscount = 0,
                CoinCost = 0,
                ExpiresAt = DateTime.UtcNow.AddDays(dto.ExpiryDays),
            };

            _db.Vouchers.Add(voucher);
            created.Add(voucher);
        }

        await _db.SaveChangesAsync();
        return Ok(created.Select(ToDto));
    }

    /// <summary>
    /// Top up an account with coins and/or extra plays.
    ///
    /// Built for testing — granting 999 plays lets you exercise the arcade
    /// without placing 250 orders first. Also doubles as a compensation tool
    /// if a customer loses a round to a bug.
    /// </summary>
    [HttpPost("admin/grant")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<GrantResultDto>> Grant(AdminGrantDto dto)
    {
        var user = await _db.Users.FindAsync(dto.UserId);
        if (user is null) return NotFound($"No user with id {dto.UserId}.");

        user.Coins += dto.Coins;
        user.BonusPlays += dto.Plays;

        await _db.SaveChangesAsync();

        var parts = new List<string>();
        if (dto.Coins > 0) parts.Add($"{dto.Coins} coins");
        if (dto.Plays > 0) parts.Add($"{dto.Plays} plays");

        return Ok(new GrantResultDto
        {
            UserId = user.Id,
            Name = user.Name,
            Coins = user.Coins,
            BonusPlays = user.BonusPlays,
            Message = parts.Count == 0
                ? "Nothing granted."
                : $"Granted {string.Join(" and ", parts)} to {user.Name}.",
        });
    }

    /// <summary>Every voucher in the shop, for the admin screen.</summary>
    [HttpGet("admin/all")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<IEnumerable<VoucherDto>>> All()
    {
        var vouchers = await _db.Vouchers
            .OrderByDescending(v => v.CreatedAt)
            .Take(200)
            .AsNoTracking()
            .ToListAsync();

        return Ok(vouchers.Select(ToDto));
    }

    /* ================================================ arcade top-up codes */

    /// <summary>
    /// Redeem an arcade code typed by the customer.
    ///
    /// Every rule is checked here, not in Angular: does it exist, is it active,
    /// has it expired, is it used up, and has THIS account already used it.
    /// </summary>
    [HttpPost("code")]
    public async Task<ActionResult<UseCodeResultDto>> UseCode(UseCodeDto dto)
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var code = dto.Code.Trim().ToUpperInvariant();

        var entry = await _db.RedeemCodes
            .Include(c => c.Uses)
            .FirstOrDefaultAsync(c => c.Code == code);

        if (entry is null)
            return BadRequest("That code doesn't exist.");
        if (!entry.IsActive)
            return BadRequest("That code has been switched off.");
        if (entry.IsExpired)
            return BadRequest("That code has expired.");
        if (entry.IsExhausted)
            return BadRequest("That code has been fully claimed.");
        if (entry.Uses.Any(u => u.UserId == user.Id))
            return BadRequest("You've already used that code.");

        user.Coins += entry.Coins;
        user.BonusPlays += entry.Plays;

        entry.UsedCount++;
        entry.Uses.Add(new RedeemCodeUse { UserId = user.Id });

        await _db.SaveChangesAsync();

        var parts = new List<string>();
        if (entry.Coins > 0) parts.Add($"{entry.Coins} coins");
        if (entry.Plays > 0) parts.Add($"{entry.Plays} plays");

        return Ok(new UseCodeResultDto
        {
            Success = true,
            CoinsAdded = entry.Coins,
            PlaysAdded = entry.Plays,
            Balance = user.Coins,
            BonusPlays = user.BonusPlays,
            Message = parts.Count == 0
                ? "Code accepted."
                : $"{string.Join(" and ", parts)} added" +
                  (string.IsNullOrWhiteSpace(entry.Label) ? "." : $" — {entry.Label}."),
        });
    }

    /// <summary>Admin: create an arcade top-up code.</summary>
    [HttpPost("admin/codes")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<RedeemCodeDto>> CreateCode(CreateRedeemCodeDto dto)
    {
        if (dto.Coins == 0 && dto.Plays == 0)
            return BadRequest("A code must give coins, plays, or both.");

        var code = string.IsNullOrWhiteSpace(dto.Code)
            ? await GenerateArcadeCodeAsync()
            : dto.Code.Trim().ToUpperInvariant();

        if (await _db.RedeemCodes.AnyAsync(c => c.Code == code))
            return BadRequest($"Code {code} already exists.");

        var entry = new RedeemCode
        {
            Code = code,
            Coins = dto.Coins,
            Plays = dto.Plays,
            MaxUses = dto.MaxUses,
            Label = dto.Label.Trim(),
            ExpiresAt = DateTime.UtcNow.AddDays(dto.ExpiryDays),
        };

        _db.RedeemCodes.Add(entry);
        await _db.SaveChangesAsync();

        return Ok(ToDto(entry));
    }

    [HttpGet("admin/codes")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<IEnumerable<RedeemCodeDto>>> Codes()
    {
        var codes = await _db.RedeemCodes
            .OrderByDescending(c => c.CreatedAt)
            .Take(100)
            .AsNoTracking()
            .ToListAsync();

        return Ok(codes.Select(ToDto));
    }

    /// <summary>Switch a code off without deleting it, so its history survives.</summary>
    [HttpPut("admin/codes/{id:int}/active")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> SetCodeActive(int id, [FromQuery] bool value)
    {
        var entry = await _db.RedeemCodes.FindAsync(id);
        if (entry is null) return NotFound($"No code with id {id}.");

        entry.IsActive = value;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /* ----------------------------------------------------------- helpers */

    private async Task<string> GenerateArcadeCodeAsync()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = "PLAY-" + new string(Enumerable.Range(0, 5)
                .Select(_ => alphabet[Random.Shared.Next(alphabet.Length)]).ToArray());

            if (!await _db.RedeemCodes.AnyAsync(c => c.Code == code)) return code;
        }
        return "PLAY-" + DateTime.UtcNow.Ticks.ToString()[^6..];
    }

    private static RedeemCodeDto ToDto(RedeemCode c) => new()
    {
        Id = c.Id,
        Code = c.Code,
        Coins = c.Coins,
        Plays = c.Plays,
        MaxUses = c.MaxUses,
        UsedCount = c.UsedCount,
        Label = c.Label,
        IsActive = c.IsActive,
        Usable = c.IsUsable,
        ExpiresAt = c.ExpiresAt,
        CreatedAt = c.CreatedAt,
    };


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
        Label = $"${v.Value:0.##} off",
        Type = v.Type.ToString(),
        Value = v.Value,
        MinSpend = v.MinSpend,
        ExpiresAt = v.ExpiresAt,
        Usable = v.IsUsable,
        UsedAt = v.UsedAt,
        UserId = v.UserId,
        IsAdminIssued = v.IsAdminIssued,
    };
}
