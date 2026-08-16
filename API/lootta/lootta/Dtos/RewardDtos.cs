using System.ComponentModel.DataAnnotations;
using lootta.Models;

namespace lootta.Dtos;

public class GameStartDto
{
    /// <summary>Send this back with the score. Ties the round to a start time.</summary>
    public string Token { get; set; } = string.Empty;
    public int CoinsPerPoint { get; set; }
    public int PlaysLeftToday { get; set; }
    public int BestScore { get; set; }
}

public class SpinResultDto
{
    /// <summary>Which wedge the wheel lands on. The server chose it.</summary>
    public int PrizeIndex { get; set; }
    public int CoinsWon { get; set; }
    public int DailyBonus { get; set; }
    public int Balance { get; set; }
    public int Streak { get; set; }
    public int PlaysLeftToday { get; set; }
    public string Message { get; set; } = string.Empty;
}

/// <summary>The arcade's state: what you've earned and what you can play.</summary>
public class ArcadeStateDto
{
    public int Balance { get; set; }
    public int Streak { get; set; }
    public int BestScore { get; set; }

    public int LifetimeItems { get; set; }
    public string Tier { get; set; } = string.Empty;
    public int PlaysPerDay { get; set; }
    public int PlaysLeftToday { get; set; }
    public bool HasWelcomePlay { get; set; }

    /// <summary>Next tier's name and how many more items are needed.</summary>
    public string? NextTier { get; set; }
    public int ItemsToNextTier { get; set; }

    public List<int> Wheel { get; set; } = new();
    public int CoinsPerPoint { get; set; }
}

public class GameFinishDto
{
    [Required]
    public string Token { get; set; } = string.Empty;

    [Range(0, 10_000)]
    public int Score { get; set; }
}

public class GameResultDto
{
    public int Score { get; set; }
    public int CoinsEarned { get; set; }
    public int DailyBonus { get; set; }
    public int Balance { get; set; }
    public int BestScore { get; set; }
    public int Streak { get; set; }
    public int PlaysLeftToday { get; set; }
    public bool NewRecord { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class RewardStateDto
{
    public int Balance { get; set; }
    public int Streak { get; set; }
    public int BestScore { get; set; }
    public List<VoucherOptionDto> Catalog { get; set; } = new();
    public List<VoucherDto> Vouchers { get; set; } = new();
}

public class VoucherOptionDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int CoinCost { get; set; }
    public bool Affordable { get; set; }
}

public class VoucherDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public decimal MinSpend { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool Usable { get; set; }
    public DateTime? UsedAt { get; set; }
}

public class RedeemDto
{
    [Required]
    public string Key { get; set; } = string.Empty;
}

/// <summary>
/// The shop's reward catalogue.
///
/// Deliberately modest — a few dollars off, with a minimum spend. Vouchers are
/// here to make buying feel rewarding, not to be a way of getting things free.
/// Percentage discounts were removed for the same reason.
/// </summary>
public static class VoucherCatalog
{
    public record Option(string Key, string Label, string Description, int CoinCost,
                         VoucherType Type, decimal Value, decimal MinSpend, decimal MaxDiscount);

    public static readonly Option[] All =
    {
        new("save1", "$1 off", "On orders over $15",  60, VoucherType.Fixed, 1m, 15m, 0m),
        new("save2", "$2 off", "On orders over $25", 150, VoucherType.Fixed, 2m, 25m, 0m),
        new("save3", "$3 off", "On orders over $40", 320, VoucherType.Fixed, 3m, 40m, 0m),
        new("save5", "$5 off", "On orders over $70", 600, VoucherType.Fixed, 5m, 70m, 0m),
    };

    public static Option? Find(string key) =>
        All.FirstOrDefault(o => o.Key.Equals(key, StringComparison.OrdinalIgnoreCase));
}
