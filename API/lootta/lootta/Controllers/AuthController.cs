using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Dtos;
using lootta.Models;
using lootta.Services;

namespace lootta.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]   // slows down password guessing
public class AuthController : ControllerBase
{
    private readonly LoottaDbContext _db;
    private readonly TokenService _tokens;

    public AuthController(LoottaDbContext db, TokenService tokens)
    {
        _db = db;
        _tokens = tokens;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResultDto>> Register(RegisterDto dto)
    {
        if (!string.Equals(dto.Email, dto.ConfirmEmail, StringComparison.OrdinalIgnoreCase))
            return BadRequest("The two email addresses don't match.");

        if (dto.Password != dto.ConfirmPassword)
            return BadRequest("The two passwords don't match.");

        var email = dto.Email.Trim().ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return BadRequest("An account with that email already exists.");

        var user = new User
        {
            Name = dto.Name.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            Role = UserRole.Customer,   // always. never taken from the request.
            Coins = 50,                 // welcome bonus
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(ToResult(user));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResultDto>> Login(LoginDto dto)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Same message whether the email is unknown or the password is wrong,
        // so the response can't be used to discover which emails are registered.
        if (user is null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            return BadRequest("Email or password is incorrect.");

        if (!user.IsActive)
            return BadRequest("This account has been disabled.");

        return Ok(ToResult(user));
    }

    /// <summary>Who am I? Used by both Angular apps to restore state on reload.</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<AuthResultDto>> Me()
    {
        var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FindAsync(id);
        if (user is null) return Unauthorized();

        return Ok(ToResult(user));
    }

    /// <summary>
    /// Change your own password.
    ///
    /// The current password must be supplied even though you are already
    /// signed in — otherwise anyone who walked up to an unlocked laptop could
    /// take the account permanently.
    /// </summary>
    [HttpPut("password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordDto dto)
    {
        if (dto.NewPassword != dto.ConfirmNewPassword)
            return BadRequest("The two new passwords don't match.");

        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
            return BadRequest("Your current password is incorrect.");

        if (BCrypt.Net.BCrypt.Verify(dto.NewPassword, user.PasswordHash))
            return BadRequest("The new password must be different from the old one.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        await _db.SaveChangesAsync();

        // The existing token stays valid until it expires. Rotating tokens on
        // password change would be the stricter choice; noted as a limitation.
        return NoContent();
    }

    /* ==================================================== admin only ==== */

    /// <summary>
    /// Create another Admin. Only an existing Admin can call this, so the
    /// very first admin has to come from the database seed — there is no way
    /// to bootstrap one from outside.
    /// </summary>
    [HttpPost("admin")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<UserRowDto>> CreateAdmin(CreateAdminDto dto)
    {
        var email = dto.Email.Trim().ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return BadRequest("An account with that email already exists.");

        var user = new User
        {
            Name = dto.Name.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            Role = UserRole.Admin,
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(ToRow(user, 0));
    }

    /// <summary>
    /// Accounts, with an optional search across name and email.
    ///
    /// Filtering happens in SQL, not in Angular — with 10,000 customers you do
    /// not want to send the whole table to a browser so it can hide most of it.
    /// </summary>
    [HttpGet("users")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<IEnumerable<UserRowDto>>> Users([FromQuery] string? search)
    {
        var query = _db.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();

            // A bare number is treated as an account id, the way a game
            // support tool lets you paste a player id straight in.
            if (int.TryParse(term, out var id))
            {
                query = query.Where(u => u.Id == id
                                      || EF.Functions.Like(u.Name, $"%{term}%")
                                      || EF.Functions.Like(u.Email, $"%{term}%"));
            }
            else
            {
                query = query.Where(u => EF.Functions.Like(u.Name, $"%{term}%")
                                      || EF.Functions.Like(u.Email, $"%{term}%"));
            }
        }

        var rows = await query
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new UserRowDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Role = u.Role.ToString(),
                Coins = u.Coins,
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt,
                OrderCount = _db.Orders.Count(o => o.UserId == u.Id),
            })
            .ToListAsync();

        return Ok(rows);
    }

    /// <summary>One customer in full — profile, spending and arcade standing.</summary>
    [HttpGet("users/{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<CustomerDetailDto>> Customer(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound($"No user with id {id}.");

        var orders = await _db.Orders
            .Include(o => o.Items)
            .Where(o => o.UserId == id)
            .OrderByDescending(o => o.CreatedAt)
            .AsNoTracking()
            .ToListAsync();

        var counted = orders.Where(o => o.Status != OrderStatus.Cancelled).ToList();
        var itemsBought = counted.Sum(o => o.Items.Sum(i => i.Quantity));
        var tier = PlayTiers.For(itemsBought);

        var vouchers = await _db.Vouchers.Where(v => v.UserId == id).ToListAsync();

        return Ok(new CustomerDetailDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role.ToString(),
            Phone = user.Phone,
            Address = user.Address,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,

            OrderCount = orders.Count,
            ItemsBought = itemsBought,
            TotalSpent = counted.Sum(o => o.Total),
            LastOrderAt = orders.FirstOrDefault()?.CreatedAt,

            Coins = user.Coins,
            Tier = tier.Name,
            PlaysPerDay = tier.PlaysPerDay,
            PlaysUsedToday = user.PlaysDate?.Date == DateTime.UtcNow.Date ? user.PlaysUsedToday : 0,
            BestScore = user.BestScore,
            PlayStreak = user.PlayStreak,
            RoundsPlayed = await _db.GameSessions.CountAsync(g => g.UserId == id && g.FinishedAt != null),
            VouchersOwned = vouchers.Count,
            VouchersUsed = vouchers.Count(v => v.UsedAt != null),

            Orders = orders.Select(o => new CustomerOrderRowDto
            {
                Id = o.Id,
                OrderNumber = o.OrderNumber,
                TotalPrice = o.Total,
                ItemCount = o.Items.Sum(i => i.Quantity),
                Status = o.Status.ToString(),
                CreatedAt = o.CreatedAt,
            }).ToList(),
        });
    }

    /// <summary>Promote or demote an account.</summary>
    [HttpPut("users/{id:int}/role")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> ChangeRole(int id, ChangeRoleDto dto)
    {
        if (!Enum.TryParse<UserRole>(dto.Role, ignoreCase: true, out var role))
            return BadRequest("Role must be Customer or Admin.");

        // Guard against locking yourself out of your own admin panel.
        if (id == CurrentUserId && role != UserRole.Admin)
            return BadRequest("You can't remove your own admin access.");

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound($"No user with id {id}.");

        user.Role = role;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Reset someone's password. For a customer who is locked out, or a staff
    /// member who forgot theirs — there is no email recovery in this project.
    /// </summary>
    [HttpPut("users/{id:int}/password")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> ResetPassword(int id, ResetPasswordDto dto)
    {
        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound($"No user with id {id}.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>Disable an account without deleting it or its order history.</summary>
    [HttpPut("users/{id:int}/active")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> SetActive(int id, [FromQuery] bool value)
    {
        if (id == CurrentUserId && !value)
            return BadRequest("You can't disable your own account.");

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound($"No user with id {id}.");

        user.IsActive = value;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /* ------------------------------------------------------------ helpers */

    private int CurrentUserId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

    private static UserRowDto ToRow(User u, int orderCount) => new()
    {
        Id = u.Id,
        Name = u.Name,
        Email = u.Email,
        Role = u.Role.ToString(),
        Coins = u.Coins,
        IsActive = u.IsActive,
        CreatedAt = u.CreatedAt,
        OrderCount = orderCount,
    };

    private AuthResultDto ToResult(User user) => new()
    {
        Id = user.Id,
        Name = user.Name,
        Email = user.Email,
        Role = user.Role.ToString(),
        Coins = user.Coins,
        Token = _tokens.Create(user),
        ExpiresAt = DateTime.UtcNow.AddDays(7),
    };
}
