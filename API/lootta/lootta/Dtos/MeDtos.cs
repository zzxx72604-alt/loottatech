using System.ComponentModel.DataAnnotations;
namespace lootta.Dtos;

public class ProfileDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    /// <summary>Masked, e.g. "0***-3457". The full number is never sent back.</summary>
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Gender { get; set; } = string.Empty;
    public string AvatarUrl { get; set; } = string.Empty;
    public DateTime MemberSince { get; set; }

    public int Coins { get; set; }
    public int BestScore { get; set; }
    public int PlayStreak { get; set; }

    public int OrderCount { get; set; }
    public int ItemsBought { get; set; }
    public decimal TotalSpent { get; set; }

    public int LikeCount { get; set; }
    public int SaveCount { get; set; }
}

/// <summary>Every product id this customer has liked or saved, in one payload.</summary>
public class InteractionStateDto
{
    public List<int> Liked { get; set; } = new();
    public List<int> Saved { get; set; } = new();
}

public class ToggleResultDto
{
    public int ProductId { get; set; }
    public bool Liked { get; set; }
    public bool Saved { get; set; }
    public int LikeCount { get; set; }
}

/// <summary>
/// Editable account details.
///
/// Email is deliberately absent: changing the address you sign in with is a
/// security action, not a preference, and belongs behind password confirmation.
/// </summary>
public class UpdateProfileDto
{
    [Required, MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(30)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(300)]
    public string Address { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Gender { get; set; } = string.Empty;
}

/// <summary>Unmasked details, returned only to the account owner for editing.</summary>
public class EditableProfileDto
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Gender { get; set; } = string.Empty;
    public string AvatarUrl { get; set; } = string.Empty;
}
