using System.ComponentModel.DataAnnotations;
using lootta.Models;

namespace lootta.Dtos;

public class GameStartDto
{
    /// <summary>Send this back with the score. Ties the round to a start time.</summary>
    public string Token { get; set; } = string.Empty;
    public int CoinsPerPoint { get; set; }
    public int PlayCost { get; set; }
    public int Balance { get; set; }
    public int PlaysLeftToday { get; set; }
    public int BestScore { get; set; }
}

public class SpinResultDto
{
    /// <summary>Which wedge the wheel lands on. The server chose it.</summary>
    public int PrizeIndex { get; set; }
    public int CoinsWon { get; set; }
    public int PlayCost { get; set; }
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
    public int BonusPlays { get; set; }
    public bool HasWelcomePlay { get; set; }

    /// <summary>Next tier's name and how many more items are needed.</summary>
    public string? NextTier { get; set; }
    public int ItemsToNextTier { get; set; }

    // ---- the economy, so the UI never hardcodes a number ----
    public int PlayCost { get; set; }
    public bool CanAfford { get; set; }
    public int CoinsPerPoint { get; set; }
    public int CoinsPerDollar { get; set; }

    /// <summary>Coin value of each wheel wedge, in drawing order.</summary>
    public List<int> Wheel { get; set; } = new();

    /// <summary>
    /// Relative chance of each wedge, same order as Wheel.
    ///
    /// Sent so the UI can size each slice by its real probability — a rare
    /// jackpot gets a thin sliver, a common small prize gets a wide one. A
    /// wheel with equal slices and unequal odds is quietly dishonest.
    /// </summary>
    public List<int> WheelWeights { get; set; } = new();
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
    public int PlayCost { get; set; }
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
    public decimal Value { get; set; }
    public int CoinCost { get; set; }
    public bool Affordable { get; set; }
}

/// <summary>An admin minting a voucher by hand, for testing or a promotion.</summary>
public class AdminVoucherDto
{
    [Range(0.5, 500)]
    public decimal Value { get; set; } = 1;

    [Range(0, 10_000)]
    public decimal MinSpend { get; set; }

    [Range(1, 365)]
    public int ExpiryDays { get; set; } = 30;

    /// <summary>Leave null for a public code anyone can use.</summary>
    public int? UserId { get; set; }

    [Range(1, 50)]
    public int Count { get; set; } = 1;
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

    /// <summary>Null means a public promo code usable by anyone.</summary>
    public int? UserId { get; set; }
    public bool IsAdminIssued { get; set; }
}

/// <summary>An admin topping up an account, for testing or compensation.</summary>
public class AdminGrantDto
{
    [Range(1, int.MaxValue)]
    public int UserId { get; set; }

    [Range(0, 1_000_000)]
    public int Coins { get; set; }

    [Range(0, 10_000)]
    public int Plays { get; set; }

    [MaxLength(200)]
    public string Reason { get; set; } = string.Empty;
}

public class GrantResultDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Coins { get; set; }
    public int BonusPlays { get; set; }
    public string Message { get; set; } = string.Empty;
}

/// <summary>Admin creating an arcade top-up code.</summary>
public class CreateRedeemCodeDto
{
    [Range(0, 1_000_000)]
    public int Coins { get; set; }

    [Range(0, 10_000)]
    public int Plays { get; set; }

    /// <summary>How many accounts may use it. 0 = unlimited.</summary>
    [Range(0, 100_000)]
    public int MaxUses { get; set; } = 1;

    [MaxLength(120)]
    public string Label { get; set; } = string.Empty;

    [Range(1, 365)]
    public int ExpiryDays { get; set; } = 30;

    /// <summary>Optional custom code. Left blank, one is generated.</summary>
    [MaxLength(24)]
    public string? Code { get; set; }
}

public class RedeemCodeDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public int Coins { get; set; }
    public int Plays { get; set; }
    public int MaxUses { get; set; }
    public int UsedCount { get; set; }
    public string Label { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool Usable { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>A customer typing a code into the arcade.</summary>
public class UseCodeDto
{
    [Required, MaxLength(24)]
    public string Code { get; set; } = string.Empty;
}

public class UseCodeResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int CoinsAdded { get; set; }
    public int PlaysAdded { get; set; }
    public int Balance { get; set; }
    public int BonusPlays { get; set; }
}

public class RedeemDto
{
    [Required]
    public string Key { get; set; } = string.Empty;
}

