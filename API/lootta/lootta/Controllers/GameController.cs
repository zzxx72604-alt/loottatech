using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Dtos;
using lootta.Models;

namespace lootta.Controllers;

/// <summary>
/// The LoottaTech arcade.
///
/// PLAYS ARE EARNED BY BUYING. How many items a customer has ordered in total
/// sets how many plays they get each day. That single rule does more for
/// fairness than any anti-cheat could: there is nothing to gain from faking a
/// score, because you cannot get a play without placing a real order.
///
/// A play can be spent on either game:
///   • the wheel  — pure luck, the server picks the wedge
///   • Lootta Flyer — skill, the score decides the coins
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GameController : ControllerBase
{
    private readonly LoottaDbContext _db;

    public GameController(LoottaDbContext db) => _db = db;

    /// <summary>The wheel's wedges, in order. The UI draws these labels.</summary>
    private static readonly int[] Wheel = { 10, 20, 30, 50, 75, 100, 150, 5 };

    /// <summary>Matching weights — small prizes common, 150 rare.</summary>
    private static readonly int[] Weights = { 24, 22, 18, 14, 10, 7, 2, 3 };

    private const int CoinsPerPoint = 3;
    private const int MaxCoinsPerRound = 200;

    /// <summary>Fastest a point can legitimately be scored, in seconds.</summary>
    private const double MinSecondsPerPoint = 0.7;
    private const int MaxRoundMinutes = 20;

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /* ------------------------------------------------------------- state */

    [HttpGet]
    public async Task<ActionResult<ArcadeStateDto>> GetState()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        RollDayIfNeeded(user);
        await _db.SaveChangesAsync();

        var items = await LifetimeItemsAsync(user.Id);
        var tier = PlayTiers.For(items);
        var next = PlayTiers.Next(items);

        return Ok(new ArcadeStateDto
        {
            Balance = user.Coins,
            Streak = user.PlayStreak,
            BestScore = user.BestScore,
            LifetimeItems = items,
            Tier = tier.Name,
            PlaysPerDay = tier.PlaysPerDay,
            PlaysLeftToday = PlaysLeft(user, tier),
            HasWelcomePlay = !user.WelcomePlayUsed,
            NextTier = next?.Name,
            ItemsToNextTier = next is null ? 0 : Math.Max(0, next.MinItems - items),
            Wheel = Wheel.ToList(),
            CoinsPerPoint = CoinsPerPoint,
        });
    }

    /* -------------------------------------------------------- wheel spin */

    /// <summary>Spend a play on the wheel. The server picks the prize.</summary>
    [HttpPost("spin")]
    public async Task<ActionResult<SpinResultDto>> Spin()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var consumed = await TryConsumePlayAsync(user);
        if (consumed is not null) return BadRequest(consumed);

        var index = PickWeightedIndex();
        var won = Wheel[index];
        var bonus = ApplyDailyStreak(user);

        user.Coins += won + bonus;
        await _db.SaveChangesAsync();

        var tier = PlayTiers.For(await LifetimeItemsAsync(user.Id));

        return Ok(new SpinResultDto
        {
            PrizeIndex = index,
            CoinsWon = won,
            DailyBonus = bonus,
            Balance = user.Coins,
            Streak = user.PlayStreak,
            PlaysLeftToday = PlaysLeft(user, tier),
            Message = bonus > 0
                ? $"{won} coins, plus {bonus} for playing today."
                : $"You won {won} coins.",
        });
    }

    /* ------------------------------------------------------ lootta flyer */

    /// <summary>Spend a play and begin a round. Consumed up front, so a bad round can't be retried.</summary>
    [HttpPost("start")]
    public async Task<ActionResult<GameStartDto>> Start()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var consumed = await TryConsumePlayAsync(user);
        if (consumed is not null) return BadRequest(consumed);

        // Clear any abandoned rounds for this player.
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

        var tier = PlayTiers.For(await LifetimeItemsAsync(user.Id));

        return Ok(new GameStartDto
        {
            Token = session.Token,
            CoinsPerPoint = CoinsPerPoint,
            PlaysLeftToday = PlaysLeft(user, tier),
            BestScore = user.BestScore,
        });
    }

    /// <summary>Submit the score when the player crashes.</summary>
    [HttpPost("finish")]
    public async Task<ActionResult<GameResultDto>> Finish(GameFinishDto dto)
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var session = await _db.GameSessions
            .FirstOrDefaultAsync(g => g.Token == dto.Token && g.UserId == user.Id);

        if (session is null) return BadRequest("Unknown round. Start a new one.");
        if (session.IsFinished) return BadRequest("That round has already been counted.");

        var elapsed = (DateTime.UtcNow - session.StartedAt).TotalSeconds;
        if (elapsed > MaxRoundMinutes * 60)
            return BadRequest("That round took too long to submit.");

        var score = Math.Max(0, dto.Score);

        /*
         * The plausibility check. The browser runs the game, so it reports the
         * score — but it cannot fake how long the round took, because the start
         * time was recorded here. Claiming 50 points in 4 seconds is rejected.
         */
        if (elapsed < score * MinSecondsPerPoint)
        {
            session.FinishedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return BadRequest($"That score isn't possible in {elapsed:0.0} seconds.");
        }

        var earned = Math.Min(score * CoinsPerPoint, MaxCoinsPerRound);
        var bonus = ApplyDailyStreak(user);
        var record = score > user.BestScore;

        user.Coins += earned + bonus;
        if (record) user.BestScore = score;

        session.FinishedAt = DateTime.UtcNow;
        session.Score = score;
        session.CoinsAwarded = earned + bonus;

        await _db.SaveChangesAsync();

        var tier = PlayTiers.For(await LifetimeItemsAsync(user.Id));

        return Ok(new GameResultDto
        {
            Score = score,
            CoinsEarned = earned,
            DailyBonus = bonus,
            Balance = user.Coins,
            BestScore = user.BestScore,
            Streak = user.PlayStreak,
            PlaysLeftToday = PlaysLeft(user, tier),
            NewRecord = record,
            Message = score == 0
                ? "No points that time."
                : $"{score} point{(score == 1 ? "" : "s")} — {earned} coins"
                  + (bonus > 0 ? $", plus {bonus} for playing today." : "."),
        });
    }

    /* ----------------------------------------------------------- helpers */

    /// <summary>Total items this customer has ever bought, cancelled orders excluded.</summary>
    private async Task<int> LifetimeItemsAsync(int userId) =>
        await _db.OrderItems
            .Where(i => i.Order!.UserId == userId && i.Order.Status != OrderStatus.Cancelled)
            .SumAsync(i => (int?)i.Quantity) ?? 0;

    private static int PlaysLeft(User user, PlayTiers.Tier tier)
    {
        var earned = tier.PlaysPerDay + (user.WelcomePlayUsed ? 0 : 1);
        return Math.Max(0, earned - user.PlaysUsedToday);
    }

    /// <summary>Takes one play, or returns the reason it can't.</summary>
    private async Task<string?> TryConsumePlayAsync(User user)
    {
        RollDayIfNeeded(user);

        var items = await LifetimeItemsAsync(user.Id);
        var tier = PlayTiers.For(items);

        if (PlaysLeft(user, tier) <= 0)
        {
            var next = PlayTiers.Next(items);
            return tier.PlaysPerDay == 0
                ? "Buy an item to unlock daily plays in the arcade."
                : next is null
                    ? "You've used all of today's plays. Come back tomorrow."
                    : $"You've used all {tier.PlaysPerDay} of today's plays. "
                      + $"Buy {next.MinItems - items} more item(s) to reach {next.Name} and get {next.PlaysPerDay} a day.";
        }

        // The welcome play is spent first, so it is used exactly once ever.
        if (!user.WelcomePlayUsed) user.WelcomePlayUsed = true;

        user.PlaysUsedToday++;
        return null;
    }

    /// <summary>First play of the day pays a streak bonus. Returns the amount.</summary>
    private static int ApplyDailyStreak(User user)
    {
        var today = DateTime.UtcNow.Date;
        if (user.LastPlayUtc?.Date == today) return 0;

        user.PlayStreak = user.LastPlayUtc?.Date == today.AddDays(-1) ? user.PlayStreak + 1 : 1;
        user.LastPlayUtc = DateTime.UtcNow;

        return 5 + Math.Min(user.PlayStreak - 1, 5) * 3;   // 5 up to 20
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
