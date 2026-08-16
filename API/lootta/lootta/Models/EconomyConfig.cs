using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

/// <summary>
/// Every tunable number in the rewards economy, in one row of the database.
///
/// These are NOT constants in code. Balancing a game economy means changing
/// numbers repeatedly, and a redeploy per change is unworkable. The admin edits
/// them in the browser, and both the arcade and checkout pick them up at once.
/// </summary>
public class EconomyConfig
{
    /// <summary>Always 1 — this table holds a single configuration row.</summary>
    public int Id { get; set; } = 1;

    // ---- earning ----

    /// <summary>Coins granted per dollar spent. 40 means a $10 order pays 400.</summary>
    [Range(0, 10_000)]
    public int CoinsPerDollar { get; set; } = 40;

    // ---- playing ----

    /// <summary>Coins deducted to start a round. This is what stops infinite grinding.</summary>
    [Range(0, 100_000)]
    public int PlayCost { get; set; } = 50;

    /// <summary>Coins won per obstacle passed in Lootta Flyer.</summary>
    [Range(0, 1_000)]
    public int FlyerCoinsPerPoint { get; set; } = 8;

    /// <summary>Most coins one round of Flyer can pay out.</summary>
    [Range(0, 100_000)]
    public int FlyerMaxPerRound { get; set; } = 400;

    // ---- spending ----

    /// <summary>Coins needed per $1 of voucher value. 300 means a $1 voucher costs 300.</summary>
    [Range(1, 100_000)]
    public int CoinsPerVoucherDollar { get; set; } = 300;

    /// <summary>Minimum order subtotal, as a multiple of the voucher's value.</summary>
    [Range(1, 100)]
    public int VoucherMinSpendMultiplier { get; set; } = 10;

    [Range(1, 365)]
    public int VoucherExpiryDays { get; set; } = 30;

    // ---- daily play allowance, by lifetime items bought ----

    /// <summary>
    /// Plays for someone who hasn't bought anything yet.
    ///
    /// Deliberately NOT zero. Coins are already the real gate — you can't get
    /// them without buying or redeeming a code — so a hard lock on top just
    /// makes the arcade look broken to a first-time visitor.
    /// </summary>
    [Range(0, 100)] public int BrowserPlays { get; set; } = 5;

    [Range(0, 100)] public int BronzeItems { get; set; } = 1;
    [Range(0, 100)] public int BronzePlays { get; set; } = 1;

    [Range(0, 1000)] public int SilverItems { get; set; } = 5;
    [Range(0, 100)] public int SilverPlays { get; set; } = 2;

    [Range(0, 1000)] public int GoldItems { get; set; } = 20;
    [Range(0, 100)] public int GoldPlays { get; set; } = 4;

    /// <summary>Coins given to a brand-new account so it can try one round.</summary>
    [Range(0, 100_000)]
    public int WelcomeCoins { get; set; } = 100;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>The tier ladder, built from the configured numbers.</summary>
    public (string Name, int MinItems, int PlaysPerDay)[] Tiers() => new[]
    {
        ("Browser", 0, BrowserPlays),
        ("Bronze", BronzeItems, BronzePlays),
        ("Silver", SilverItems, SilverPlays),
        ("Gold", GoldItems, GoldPlays),
    };

    public (string Name, int MinItems, int PlaysPerDay) TierFor(int lifetimeItems) =>
        Tiers().Last(t => lifetimeItems >= t.MinItems);

    public (string Name, int MinItems, int PlaysPerDay)? NextTier(int lifetimeItems)
    {
        var tiers = Tiers();
        var current = TierFor(lifetimeItems);
        var index = Array.IndexOf(tiers, current);
        return index >= 0 && index < tiers.Length - 1 ? tiers[index + 1] : null;
    }
}
