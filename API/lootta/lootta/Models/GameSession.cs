using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

/// <summary>
/// One attempt at the Lootta Flyer game.
///
/// The row is created BEFORE play starts, so the server knows exactly when the
/// attempt began. When the score is submitted we can check whether it was
/// physically achievable in that time — the browser can lie about its score,
/// but it cannot lie about how long the round actually took.
/// </summary>
public class GameSession
{
    public int Id { get; set; }

    /// <summary>Random token the client sends back. Not guessable.</summary>
    [Required, MaxLength(40)]
    public string Token { get; set; } = string.Empty;

    public int UserId { get; set; }
    public User? User { get; set; }

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAt { get; set; }

    public int Score { get; set; }
    public int CoinsAwarded { get; set; }

    /// <summary>A session can only be cashed in once.</summary>
    public bool IsFinished => FinishedAt.HasValue;
}
