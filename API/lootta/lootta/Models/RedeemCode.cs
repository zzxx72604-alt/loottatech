using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

/// <summary>
/// A code the admin creates and the customer types into the arcade.
///
/// Separate from <see cref="Voucher"/> on purpose:
///   • a Voucher is money off an order, used at checkout
///   • a RedeemCode tops up the ARCADE — coins, plays, or both
///
/// One code can be handed to many people (MaxUses), but each account may only
/// use it once — tracked by <see cref="RedeemCodeUse"/>.
/// </summary>
public class RedeemCode
{
    public int Id { get; set; }

    /// <summary>Typed by hand, so it is short and avoids look-alike characters.</summary>
    [Required, MaxLength(24)]
    public string Code { get; set; } = string.Empty;

    [Range(0, 1_000_000)]
    public int Coins { get; set; }

    [Range(0, 10_000)]
    public int Plays { get; set; }

    /// <summary>How many accounts may redeem it in total. 0 means unlimited.</summary>
    [Range(0, 100_000)]
    public int MaxUses { get; set; } = 1;

    public int UsedCount { get; set; }

    /// <summary>Shown to the customer when it works, e.g. "Launch week bonus".</summary>
    [MaxLength(120)]
    public string Label { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(30);

    public ICollection<RedeemCodeUse> Uses { get; set; } = new List<RedeemCodeUse>();

    public bool IsExpired => DateTime.UtcNow > ExpiresAt;
    public bool IsExhausted => MaxUses > 0 && UsedCount >= MaxUses;
    public bool IsUsable => IsActive && !IsExpired && !IsExhausted;
}

/// <summary>One account redeeming one code. Stops the same person using it twice.</summary>
public class RedeemCodeUse
{
    public int Id { get; set; }

    public int RedeemCodeId { get; set; }
    public RedeemCode? RedeemCode { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    public DateTime UsedAt { get; set; } = DateTime.UtcNow;
}
