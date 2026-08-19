using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Dtos;
using lootta.Models;

namespace lootta.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly LoottaDbContext _db;

    public ReportsController(LoottaDbContext db) => _db = db;

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>The reasons a customer can pick from, by target type.</summary>
    [HttpGet("reasons")]
    [AllowAnonymous]
    public ActionResult<IEnumerable<string>> Reasons([FromQuery] string target) =>
        Ok(target.Equals("Review", StringComparison.OrdinalIgnoreCase)
            ? ReportReasons.ForReview
            : ReportReasons.ForProduct);

    /// <summary>Flag a product or a review for the shop to look at.</summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create(CreateReportDto dto)
    {
        if (!Enum.TryParse<ReportTarget>(dto.Target, ignoreCase: true, out var target))
            return BadRequest("Target must be Product or Review.");

        var exists = target == ReportTarget.Product
            ? await _db.Products.AnyAsync(p => p.Id == dto.TargetId)
            : await _db.Reviews.AnyAsync(r => r.Id == dto.TargetId);

        if (!exists) return NotFound("That item no longer exists.");

        var userId = CurrentUserId;

        // Reporting twice is not stronger evidence, so say so plainly rather
        // than silently creating a duplicate.
        if (await _db.Reports.AnyAsync(r =>
                r.ReporterId == userId && r.Target == target && r.TargetId == dto.TargetId))
        {
            return BadRequest("You've already reported this. We're looking at it.");
        }

        _db.Reports.Add(new Report
        {
            ReporterId = userId,
            Target = target,
            TargetId = dto.TargetId,
            Reason = dto.Reason.Trim(),
            Details = dto.Details.Trim(),
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    /* ------------------------------------------------------------- admin */

    /// <summary>The moderation queue. Open reports first.</summary>
    [HttpGet]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<IEnumerable<ReportDto>>> Get([FromQuery] bool openOnly = true)
    {
        var query = _db.Reports.Include(r => r.Reporter).AsNoTracking().AsQueryable();
        if (openOnly) query = query.Where(r => r.Status == ReportStatus.Open);

        var rows = await query
            .OrderByDescending(r => r.CreatedAt)
            .Take(200)
            .ToListAsync();

        // Labels are resolved in two batched lookups rather than one query per
        // report, which would be N+1 all over again.
        var productIds = rows.Where(r => r.Target == ReportTarget.Product).Select(r => r.TargetId).ToList();
        var reviewIds = rows.Where(r => r.Target == ReportTarget.Review).Select(r => r.TargetId).ToList();

        var products = await _db.Products
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Title);

        var reviews = await _db.Reviews
            .Where(r => reviewIds.Contains(r.Id))
            .ToDictionaryAsync(r => r.Id, r => r.Body);

        return Ok(rows.Select(r => new ReportDto
        {
            Id = r.Id,
            Target = r.Target.ToString(),
            TargetId = r.TargetId,
            TargetLabel = r.Target == ReportTarget.Product
                ? products.GetValueOrDefault(r.TargetId, "(deleted product)")
                : Shorten(reviews.GetValueOrDefault(r.TargetId, "(deleted review)")),
            Reason = r.Reason,
            Details = r.Details,
            Status = r.Status.ToString(),
            Resolution = r.Resolution,
            ReporterId = r.ReporterId,
            ReporterName = r.Reporter?.Name ?? "(deleted account)",
            CreatedAt = r.CreatedAt,
            ResolvedAt = r.ResolvedAt,
        }));
    }

    /// <summary>Close a report with a decision. The report itself is kept.</summary>
    [HttpPut("{id:int}/resolve")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Resolve(int id, ResolveReportDto dto)
    {
        if (!Enum.TryParse<ReportStatus>(dto.Status, ignoreCase: true, out var status)
            || status == ReportStatus.Open)
        {
            return BadRequest("Status must be Actioned or Dismissed.");
        }

        var report = await _db.Reports.FindAsync(id);
        if (report is null) return NotFound($"No report with id {id}.");

        report.Status = status;
        report.Resolution = dto.Resolution.Trim();
        report.ResolvedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static string Shorten(string text) =>
        text.Length <= 70 ? text : text[..70].TrimEnd() + "…";
}
