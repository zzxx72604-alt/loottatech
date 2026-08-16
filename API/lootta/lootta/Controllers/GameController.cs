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
/// The LoottaTech arcade.
///
/// The loop is a gacha economy with a genuine sink:
///
///     spend money  →  earn coins  →  PAY coins to play  →  win coins  →  buy vouchers
///
/// Paying to play is what makes it a game rather than a giveaway. Coins drain,
/// so a voucher has to be worked towards. Two limits keep it honest:
///   • a play costs coins, so grinding has a price
///   • daily plays are capped by how much you've bought overall
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GameController : ControllerBase
{
    private readonly LoottaDbContext _db;
    private readonly EconomyService _economy;

    public GameController(LoottaDbContext db, EconomyService economy)
    {
        _db = db;
        _economy = economy;
    }

    /// <summary>Wheel wedges, as multiples of the play cost. Index matters — the UI draws these.</summary>
    private static readonly double[] WheelMultipliers = { 0.2, 0.5, 0.8, 1.0, 1.5, 2.0, 4.0, 0.3 };

    /// <summary>Weights: losing rounds are common, a 4× jackpot is rare.</summary>
    private static readonly int[] Weights = { 20, 20, 18, 15, 12, 8, 2, 5 };

    private const double MinSecondsPerPoint = 0.7;
    private const int MaxRoundMinutes = 20;

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /* ------------------------------------------------------------- state */

    [HttpGet]
    public async Task<ActionResult<ArcadeStateDto>> GetState()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var config = await _economy.GetAsync();
        RollDayIfNeeded(user);
        await _db.SaveChangesAsync();

        var items = await _economy.LifetimeItemsAsync(user.Id);
        var tier = config.TierFor(items);
        var next = config.NextTier(items);

        return Ok(new ArcadeStateDto
        {
            Balance = user.Coins,
            Streak = user.PlayStreak,
            BestScore = user.BestScore,

            LifetimeItems = items,
            Tier = tier.Name,
            PlaysPerDay = tier.PlaysPerDay,
            PlaysLeftToday = PlaysLeft(user, tier.PlaysPerDay),
            BonusPlays = user.BonusPlays,
            HasWelcomePlay = false,

            NextTier = next?.Name,
            ItemsToNextTier = next is null ? 0 : Math.Max(0, next.Value.MinItems - items),

            PlayCost = config.PlayCost,
            CanAfford = user.Coins >= config.PlayCost,
            CoinsPerPoint = config.FlyerCoinsPerPoint,
            CoinsPerDollar = config.CoinsPerDollar,
            Wheel = WheelMultipliers.Select(m => (int)Math.Round(config.PlayCost * m)).ToList(),
        });
    }

    /* ------------------------------------------------------------- wheel */

    [HttpPost("spin")]
    public async Task<ActionResult<SpinResultDto>> Spin()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var config = await _economy.GetAsync();
        var refusal = await TrySpendPlayAsync(user, config);
        if (refusal is not null) return BadRequest(refusal);

        var index = PickWeightedIndex();
        var won = (int)Math.Round(config.PlayCost * WheelMultipliers[index]);

        user.Coins += won;
        await _db.SaveChangesAsync();

        var tier = config.TierFor(await _economy.LifetimeItemsAsync(user.Id));
        var net = won - config.PlayCost;

        return Ok(new SpinResultDto
        {
            PrizeIndex = index,
            CoinsWon = won,
            PlayCost = config.PlayCost,
            Balance = user.Coins,
            Streak = user.PlayStreak,
            PlaysLeftToday = PlaysLeft(user, tier.PlaysPerDay),
            Message = net > 0
                ? $"Won {won} coins — up {net} on the spin."
                : net == 0
                    ? $"Won {won} coins — exactly your stake back."
                    : $"Won {won} coins — down {-net} this time.",
        });
    }

    /* ------------------------------------------------------ lootta flyer */

    [HttpPost("start")]
    public async Task<ActionResult<GameStartDto>> Start()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var config = await _economy.GetAsync();
        var refusal = await TrySpendPlayAsync(user, config);
        if (refusal is not null) return BadRequest(refusal);

        var stale = await _db.GameSessions
            .Where(g => g.UserId == user.Id && g.FinishedAt == null)
            .ToListAsync();
        _db.GameSessions.RemoveRange(stale);

        var session = new GameSession
        {
            Token = Guid.NewGuid().ToString("N"),
            UserId = user.Id,
            StartedAt = DateTime.UtcNow,
        };

        _db.GameSessions.Add(session);
        await _db.SaveChangesAsync();

        var tier = config.TierFor(await _economy.LifetimeItemsAsync(user.Id));

        return Ok(new GameStartDto
        {
            Token = session.Token,
            CoinsPerPoint = config.FlyerCoinsPerPoint,
            PlayCost = config.PlayCost,
            Balance = user.Coins,
            PlaysLeftToday = PlaysLeft(user, tier.PlaysPerDay),
            BestScore = user.BestScore,
        });
    }

    [HttpPost("finish")]
    public async Task<ActionResult<GameResultDto>> Finish(GameFinishDto dto)
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var config = await _economy.GetAsync();

        var session = await _db.GameSessions
            .FirstOrDefaultAsync(g => g.Token == dto.Token && g.UserId == user.Id);

        if (session is null) return BadRequest("Unknown round. Start a new one.");
        if (session.IsFinished) return BadRequest("That round has already been counted.");

        var elapsed = (DateTime.UtcNow - session.StartedAt).TotalSeconds;
        if (elapsed > MaxRoundMinutes * 60)
            return BadRequest("That round took too long to submit.");

        var score = Math.Max(0, dto.Score);

        // The browser runs the game so it reports the score, but it cannot fake
        // how long the round took — the start time was recorded here.
        if (elapsed < score * MinSecondsPerPoint)
        {
            session.FinishedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return BadRequest($"That score isn't possible in {elapsed:0.0} seconds.");
        }

        var earned = Math.Min(score * config.FlyerCoinsPerPoint, config.FlyerMaxPerRound);
        var record = score > user.BestScore;

        user.Coins += earned;
        if (record) user.BestScore = score;

        session.FinishedAt = DateTime.UtcNow;
        session.Score = score;
        session.CoinsAwarded = earned;

        await _db.SaveChangesAsync();

        var tier = config.TierFor(await _economy.LifetimeItemsAsync(user.Id));
        var net = earned - config.PlayCost;

        return Ok(new GameResultDto
        {
            Score = score,
            CoinsEarned = earned,
            PlayCost = config.PlayCost,
            Balance = user.Coins,
            BestScore = user.BestScore,
            Streak = user.PlayStreak,
            PlaysLeftToday = PlaysLeft(user, tier.PlaysPerDay),
            NewRecord = record,
            Message = score == 0
                ? $"No points — that round cost you {config.PlayCost} coins."
                : $"{score} point{(score == 1 ? "" : "s")} — {earned} coins"
                  + (net > 0 ? $", up {net} on the round." : net == 0 ? ", breaking even." : $", down {-net}."),
        });
    }

    /* ----------------------------------------------------------- helpers */

    /// <summary>Daily allowance still unused, plus any admin-granted bonus pool.</summary>
    private static int PlaysLeft(User user, int playsPerDay) =>
        Math.Max(0, playsPerDay - user.PlaysUsedToday) + user.BonusPlays;

    /// <summary>
    /// Takes a daily play AND the coin stake, or explains why it can't.
    /// Both are checked before either is deducted.
    /// </summary>
    private async Task<string?> TrySpendPlayAsync(User user, EconomyConfig config)
    {
        RollDayIfNeeded(user);

        var items = await _economy.LifetimeItemsAsync(user.Id);
        var tier = config.TierFor(items);

        if (tier.PlaysPerDay == 0 && user.BonusPlays <= 0)
            return "Buy something from the shop to unlock the arcade.";

        if (PlaysLeft(user, tier.PlaysPerDay) <= 0)
        {
            var next = config.NextTier(items);
            return next is null
                ? "You've used all of today's plays. Come back tomorrow."
                : $"You've used all {tier.PlaysPerDay} of today's plays. Buy "
                  + $"{next.Value.MinItems - items} more item(s) to reach {next.Value.Name} "
                  + $"and get {next.Value.PlaysPerDay} a day.";
        }

        if (user.Coins < config.PlayCost)
            return $"A play costs {config.PlayCost} coins and you have {user.Coins}. "
                 + $"Shopping earns {config.CoinsPerDollar} coins per dollar.";

        user.Coins -= config.PlayCost;

        // Use the daily allowance first; only then dip into granted bonus plays.
        if (user.PlaysUsedToday < tier.PlaysPerDay) user.PlaysUsedToday++;
        else user.BonusPlays--;

        // Streak is a record of playing, not a payout — the coins come from the game.
        var today = DateTime.UtcNow.Date;
        if (user.LastPlayUtc?.Date != today)
        {
            user.PlayStreak = user.LastPlayUtc?.Date == today.AddDays(-1) ? user.PlayStreak + 1 : 1;
            user.LastPlayUtc = DateTime.UtcNow;
        }

        return null;
    }

    private static void RollDayIfNeeded(User user)
    {
        var today = DateTime.UtcNow.Date;
        if (user.PlaysDate?.Date != today)
        {
            user.PlaysUsedToday = 0;
            user.PlaysDate = today;
        }
    }

    private static int PickWeightedIndex()
    {
        var total = Weights.Sum();
        var roll = Random.Shared.Next(total);
        var running = 0;

        for (var i = 0; i < Weights.Length; i++)
        {
            running += Weights[i];
            if (roll < running) return i;
        }
        return 0;
    }
}
