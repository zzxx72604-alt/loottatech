namespace lootta.Models;

/// <summary>
/// How many arcade plays a customer gets each day.
///
/// The allowance comes from how many items they have bought in total, so the
/// arcade rewards buying rather than replacing it. Someone who never orders
/// cannot farm coins — which also means there is nothing to gain by cheating
/// at the game.
/// </summary>
public static class PlayTiers
{
    public record Tier(string Name, int MinItems, int PlaysPerDay);

    public static readonly Tier[] All =
    {
        new("Browser", 0, 0),
        new("Bronze", 1, 1),
        new("Silver", 5, 2),
        new("Gold", 20, 4),
    };

    public static Tier For(int lifetimeItems) =>
        All.Last(t => lifetimeItems >= t.MinItems);

    /// <summary>The next tier up, or null when already at the top.</summary>
    public static Tier? Next(int lifetimeItems)
    {
        var current = For(lifetimeItems);
        var index = Array.IndexOf(All, current);
        return index >= 0 && index < All.Length - 1 ? All[index + 1] : null;
    }
}
