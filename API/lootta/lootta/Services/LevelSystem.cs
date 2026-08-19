namespace lootta.Services;

/// <summary>
/// Customer levels, derived from what they have actually bought.
///
/// EXP is NOT a stored column. It is calculated from spend and items, so it
/// can never disagree with the orders behind it — the same reasoning as
/// computing a product's rating from its reviews rather than storing a number
/// somebody could edit.
///
/// The trade-off: EXP falls if an order is cancelled. That is correct. A level
/// earned by a refunded purchase was not earned.
/// </summary>
public static class LevelSystem
{
    public record Tier(int Level, string Title, int RequiredExp, string Frame);

    /// <summary>
    /// Ten dollars spent is roughly one level early on, slowing as it climbs.
    /// Items count too, so buying several cheap things is also progress.
    /// </summary>
    public static int ExpFor(decimal totalSpent, int itemsBought) =>
        (int)Math.Floor(totalSpent) + itemsBought * 20;

    public static readonly Tier[] Tiers =
    {
        new(1, "Browser",   0,    "none"),
        new(2, "Buyer",     100,  "bronze"),
        new(3, "Regular",   300,  "silver"),
        new(4, "Collector", 700,  "gold"),
        new(5, "Curator",   1500, "emerald"),
        new(6, "Legend",    3000, "aurora"),
    };

    public static Tier TierFor(int exp) => Tiers.Last(t => exp >= t.RequiredExp);

    public static Tier? NextTier(int exp)
    {
        var current = TierFor(exp);
        var index = Array.IndexOf(Tiers, current);
        return index >= 0 && index < Tiers.Length - 1 ? Tiers[index + 1] : null;
    }

    /// <summary>Progress through the current level, 0 to 100.</summary>
    public static int ProgressPercent(int exp)
    {
        var current = TierFor(exp);
        var next = NextTier(exp);

        if (next is null) return 100;

        var span = next.RequiredExp - current.RequiredExp;
        if (span <= 0) return 100;

        return Math.Clamp((int)Math.Round((exp - current.RequiredExp) * 100.0 / span), 0, 100);
    }
}
