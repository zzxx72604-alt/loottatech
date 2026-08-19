using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

public enum NotificationKind
{
    Order,
    Review,
    Reward,
    System
}

/// <summary>
/// A message for one customer.
///
/// Written when something happens TO them — an order moves, a review is
/// hidden, a code is redeemed. Not a log of everything the shop does: a
/// notification nobody would act on is just noise, and noise trains people to
/// ignore the bell.
/// </summary>
public class Notification
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    public NotificationKind Kind { get; set; } = NotificationKind.System;

    [Required, MaxLength(120)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(400)]
    public string Body { get; set; } = string.Empty;

    /// <summary>Where clicking it should go, e.g. "/order/LT-7K3QA2".</summary>
    [MaxLength(200)]
    public string Link { get; set; } = string.Empty;

    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
