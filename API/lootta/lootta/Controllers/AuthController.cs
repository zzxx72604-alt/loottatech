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

    /// <summary>Every account, for the admin app's Customers screen.</summary>
    [HttpGet("users")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<IEnumerable<UserRowDto>>> Users()
    {
        var rows = await _db.Users
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
