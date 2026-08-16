using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

public enum UserRole
{
    Customer,
    Admin
}

public class User
{
    public int Id { get; set; }

    [Required, MaxLength(160)]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// BCrypt hash — never the password itself, and never returned by any API
    /// response. BCrypt salts each hash automatically, so two people with the
    /// same password still get different hashes.
    /// </summary>
    [Required, MaxLength(200)]
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>
    /// Assigned by the SERVER only. Registration always creates a Customer,
    /// whatever the request body claims — that's what stops anyone posting
    /// {"role":"Admin"} and promoting themselves.
    /// </summary>
    public UserRole Role { get; set; } = UserRole.Customer;

    [MaxLength(30)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(300)]
    public string Address { get; set; } = string.Empty;

    // ---- rewards ----
    public int Coins { get; set; }

    /// <summary>Last day the customer played, used for the streak bonus.</summary>
    public DateTime? LastPlayUtc { get; set; }

    /// <summary>Consecutive days played. A longer streak pays a bigger bonus.</summary>
    public int PlayStreak { get; set; }

    /// <summary>Highest score in Lootta Flyer.</summary>
    public int BestScore { get; set; }

    /// <summary>Plays already used today. Resets when the date changes.</summary>
    public int PlaysUsedToday { get; set; }

    /// <summary>Which day PlaysUsedToday refers to.</summary>
    public DateTime? PlaysDate { get; set; }

    /// <summary>
    /// One free play for a brand-new account, so someone can try the arcade
    /// before buying. After that, plays are earned by ordering.
    /// </summary>
    public bool WelcomePlayUsed { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Voucher> Vouchers { get; set; } = new List<Voucher>();
}
