using System.ComponentModel.DataAnnotations;

namespace lootta.Dtos;

public class RegisterDto
{
    [Required, MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [Required, EmailAddress, MaxLength(160)]
    public string Email { get; set; } = string.Empty;

    /// <summary>Typed twice to catch typos. Checked on the server as well as in Angular.</summary>
    [Required, EmailAddress, MaxLength(160)]
    public string ConfirmEmail { get; set; } = string.Empty;

    [Required, MinLength(6), MaxLength(100)]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string ConfirmPassword { get; set; } = string.Empty;

    // NOTE: there is deliberately no Role property here. Registration always
    // creates a Customer, so nobody can promote themselves by editing the body.
}

public class LoginDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

/// <summary>
/// An existing Admin creating another Admin. Requires an admin token — this
/// is the only route to the Admin role, and it can never be reached by
/// someone who isn't already one.
/// </summary>
public class CreateAdminDto
{
    [Required, MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [Required, EmailAddress, MaxLength(160)]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(6), MaxLength(100)]
    public string Password { get; set; } = string.Empty;
}

/// <summary>Changing your OWN password. The current one must be proved.</summary>
public class ChangePasswordDto
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required, MinLength(6), MaxLength(100)]
    public string NewPassword { get; set; } = string.Empty;

    [Required]
    public string ConfirmNewPassword { get; set; } = string.Empty;
}

/// <summary>An admin resetting someone else's password — no current one needed.</summary>
public class ResetPasswordDto
{
    [Required, MinLength(6), MaxLength(100)]
    public string NewPassword { get; set; } = string.Empty;
}

public class ChangeRoleDto
{
    /// <summary>"Customer" or "Admin".</summary>
    [Required]
    public string Role { get; set; } = string.Empty;
}

/// <summary>Account row for the admin user list. No password hash, ever.</summary>
public class UserRowDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int Coins { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public int OrderCount { get; set; }
}

/// <summary>
/// Everything the admin needs about one customer, on one screen: who they are,
/// what they've bought, and their arcade standing.
/// </summary>
public class CustomerDetailDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }

    // ---- shopping ----
    public int OrderCount { get; set; }
    public int ItemsBought { get; set; }
    public decimal TotalSpent { get; set; }
    public DateTime? LastOrderAt { get; set; }

    // ---- arcade ----
    public int Coins { get; set; }
    public string Tier { get; set; } = string.Empty;
    public int PlaysPerDay { get; set; }
    public int PlaysUsedToday { get; set; }
    public int BestScore { get; set; }
    public int PlayStreak { get; set; }
    public int RoundsPlayed { get; set; }
    public int VouchersOwned { get; set; }
    public int VouchersUsed { get; set; }

    public List<CustomerOrderRowDto> Orders { get; set; } = new();
}

public class CustomerOrderRowDto
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public decimal TotalPrice { get; set; }
    public int ItemCount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

/// <summary>What the API returns after login. Note: no password, ever.</summary>
public class AuthResultDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int Coins { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}
