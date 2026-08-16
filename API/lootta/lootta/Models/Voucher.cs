using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

public enum VoucherType
{
    /// <summary>A flat amount off, e.g. $5.</summary>
    Fixed,
    /// <summary>A percentage off the subtotal, e.g. 10%.</summary>
    Percent
}

/// <summary>
/// A discount bought with Lootta Coins.
///
/// The voucher lives in the DATABASE, and checkout applies it on the SERVER.
/// If the discount were calculated in Angular, anyone could open DevTools and
/// give themselves 90% off — same reason order prices are looked up server-side.
/// </summary>
public class Voucher
{
    public int Id { get; set; }

    [Required, MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    public int UserId { get; set; }
    public User? User { get; set; }

    public VoucherType Type { get; set; }

    /// <summary>Dollars for Fixed, percent for Percent.</summary>
    public decimal Value { get; set; }

    /// <summary>Order subtotal must reach this before the voucher applies.</summary>
    public decimal MinSpend { get; set; }

    /// <summary>Ceiling on a percentage voucher, so 10% off can't be unlimited.</summary>
    public decimal MaxDiscount { get; set; }

    public int CoinCost { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(30);

    /// <summary>Set the moment it is used — a voucher works exactly once.</summary>
    public DateTime? UsedAt { get; set; }
    public int? OrderId { get; set; }

    public bool IsSpent => UsedAt.HasValue;
    public bool IsExpired => DateTime.UtcNow > ExpiresAt;
    public bool IsUsable => !IsSpent && !IsExpired;

    /// <summary>Works out the real discount for a given subtotal.</summary>
    public decimal DiscountFor(decimal subtotal)
    {
        if (!IsUsable || subtotal < MinSpend) return 0;

        var raw = Type == VoucherType.Fixed
            ? Value
            : subtotal * (Value / 100m);

        if (MaxDiscount > 0) raw = Math.Min(raw, MaxDiscount);

        // Never let a discount exceed the order itself.
        return Math.Round(Math.Min(raw, subtotal), 2);
    }
}
