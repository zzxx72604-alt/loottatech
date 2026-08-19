namespace lootta.Services;

/// <summary>
/// Badges, computed from what the customer has actually done.
///
/// Like EXP and product ratings, nothing here is stored. An achievement is a
/// QUESTION asked of the existing data, not a row somebody could insert. That
/// means it can never be out of step with reality, and adding a new badge is a
/// few lines here rather than a migration and a backfill.
///
/// The cost is that a badge can un-earn itself if an order is cancelled. That
/// is the honest behaviour.
/// </summary>
public static class Achievements
{
    /// <summary>Everything a badge might be measured against.</summary>
    public record Stats(
        int Orders,
        int Items,
        decimal Spent,
        int Reviews,
        int Likes,
        int Saves,
        int BestScore,
        int PlayStreak,
        int Level,
        int Coins,
        int VouchersRedeemed);

    public record Badge(
        string Key,
        string Title,
        string Description,
        string Icon,
        int Goal,
        int Current)
    {
        public bool Earned => Current >= Goal;

        /// <summary>Progress towards the goal, capped at 100.</summary>
        public int Percent => Goal <= 0 ? 100 : Math.Min(100, (int)Math.Round(Current * 100.0 / Goal));
    }

    public static IReadOnlyList<Badge> For(Stats s) => new List<Badge>
    {
        // ---- shopping ----
        new("first-order",  "First order",     "Buy anything from LoottaTech",        "🛍️", 1,   s.Orders),
        new("five-orders",  "Regular",         "Place five orders",                   "📦", 5,   s.Orders),
        new("ten-items",    "Collector",       "Buy ten items in total",              "🧰", 10,  s.Items),
        new("spender-100",  "Hundred club",    "Spend $100 across your orders",       "💵", 100, (int)s.Spent),
        new("spender-500",  "Serious kit",     "Spend $500 across your orders",       "💎", 500, (int)s.Spent),

        // ---- community ----
        new("first-review", "First words",     "Write your first review",             "✍️", 1,   s.Reviews),
        new("five-reviews", "Trusted voice",   "Write five reviews",                  "🗣️", 5,   s.Reviews),
        new("ten-likes",    "Good taste",      "Like ten products",                   "❤️", 10,  s.Likes),
        new("ten-saves",    "Wishlister",      "Save ten products for later",         "⭐", 10,  s.Saves),

        // ---- arcade ----
        new("first-play",   "Coin dropped",    "Earn your first coins in the arcade", "◎",  1,   s.Coins),
        new("flyer-10",     "Steady hands",    "Score 10 in Lootta Flyer",            "🕹️", 10,  s.BestScore),
        new("flyer-25",     "Ace pilot",       "Score 25 in Lootta Flyer",            "🏆", 25,  s.BestScore),
        new("streak-3",     "Three in a row",  "Play three days running",             "🔥", 3,   s.PlayStreak),
        new("voucher-1",    "Bargain hunter",  "Redeem a voucher with coins",         "🎟️", 1,   s.VouchersRedeemed),

        // ---- standing ----
        new("level-3",      "Getting known",   "Reach level 3",                       "🥈", 3,   s.Level),
        new("level-5",      "Curator",         "Reach level 5",                       "🥇", 5,   s.Level),
    };
}
