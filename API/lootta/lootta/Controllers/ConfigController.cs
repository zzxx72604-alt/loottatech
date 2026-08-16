using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using lootta.Data;
using lootta.Models;
using lootta.Services;

namespace lootta.Controllers;

/// <summary>
/// The economy dials. Reading is open, because the shop has to tell customers
/// what a play costs. Writing is admin only.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ConfigController : ControllerBase
{
    private readonly LoottaDbContext _db;
    private readonly EconomyService _economy;

    public ConfigController(LoottaDbContext db, EconomyService economy)
    {
        _db = db;
        _economy = economy;
    }

    [HttpGet]
    public async Task<ActionResult<EconomyConfig>> Get() => Ok(await _economy.GetAsync());

    /// <summary>
    /// Update the economy. Takes effect immediately for everyone — no restart,
    /// no redeploy. That is the whole point of storing it in the database.
    /// </summary>
    [HttpPut]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<EconomyConfig>> Update(EconomyConfig dto)
    {
        var config = await _economy.GetAsync();

        config.CoinsPerDollar = dto.CoinsPerDollar;
        config.PlayCost = dto.PlayCost;
        config.FlyerCoinsPerPoint = dto.FlyerCoinsPerPoint;
        config.FlyerMaxPerRound = dto.FlyerMaxPerRound;
        config.CoinsPerVoucherDollar = dto.CoinsPerVoucherDollar;
        config.VoucherMinSpendMultiplier = dto.VoucherMinSpendMultiplier;
        config.VoucherExpiryDays = dto.VoucherExpiryDays;

        config.BrowserPlays = dto.BrowserPlays;
        config.BronzeItems = dto.BronzeItems;
        config.BronzePlays = dto.BronzePlays;
        config.SilverItems = dto.SilverItems;
        config.SilverPlays = dto.SilverPlays;
        config.GoldItems = dto.GoldItems;
        config.GoldPlays = dto.GoldPlays;
        config.WelcomeCoins = dto.WelcomeCoins;

        config.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(config);
    }
}
