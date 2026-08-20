using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Dtos;
using lootta.Models;

namespace lootta.Controllers;

/// <summary>
/// The wording and shortcuts the shop owner controls.
///
/// Reads are public because the customer site needs them on every page load.
/// Writes are admin-only. Keeping both in one controller means the shape the
/// admin saves is provably the shape the shop reads back.
/// </summary>
[ApiController]
[Route("api/store")]
public class StoreContentController : ControllerBase
{
    private readonly LoottaDbContext _db;

    public StoreContentController(LoottaDbContext db) => _db = db;

    /* ------------------------------------------------------- quick tags */

    /// <summary>The shortcut row under the search box. Active tags only.</summary>
    [HttpGet("tags")]
    public async Task<ActionResult<IEnumerable<QuickTagDto>>> GetTags()
    {
        var tags = await _db.QuickTags.AsNoTracking()
            .Where(t => t.IsActive)
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Id)
            .Select(t => new QuickTagDto
            {
                Id = t.Id,
                Label = t.Label,
                Query = t.Query,
                SortOrder = t.SortOrder,
                IsActive = t.IsActive,
            })
            .ToListAsync();

        return Ok(tags);
    }

    /// <summary>Admin: every tag, including the hidden ones.</summary>
    [HttpGet("tags/all")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<IEnumerable<QuickTagDto>>> GetAllTags()
    {
        var tags = await _db.QuickTags.AsNoTracking()
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Id)
            .Select(t => new QuickTagDto
            {
                Id = t.Id,
                Label = t.Label,
                Query = t.Query,
                SortOrder = t.SortOrder,
                IsActive = t.IsActive,
            })
            .ToListAsync();

        return Ok(tags);
    }

    [HttpPost("tags")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<QuickTagDto>> CreateTag(QuickTagWriteDto dto)
    {
        var label = dto.Label.Trim();

        if (await _db.QuickTags.AnyAsync(t => t.Label == label))
            return BadRequest($"A tag called '{label}' already exists.");

        var tag = new QuickTag
        {
            Label = label,
            // An empty query means "search for the label", which is what an
            // admin typing only a label almost always means.
            Query = string.IsNullOrWhiteSpace(dto.Query) ? label : dto.Query.Trim(),
            SortOrder = dto.SortOrder,
            IsActive = dto.IsActive,
        };

        _db.QuickTags.Add(tag);
        await _db.SaveChangesAsync();

        return Ok(new QuickTagDto
        {
            Id = tag.Id,
            Label = tag.Label,
            Query = tag.Query,
            SortOrder = tag.SortOrder,
            IsActive = tag.IsActive,
        });
    }

    [HttpPut("tags/{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> UpdateTag(int id, QuickTagWriteDto dto)
    {
        var tag = await _db.QuickTags.FindAsync(id);
        if (tag is null) return NotFound($"No tag with id {id}.");

        var label = dto.Label.Trim();

        if (await _db.QuickTags.AnyAsync(t => t.Label == label && t.Id != id))
            return BadRequest($"A tag called '{label}' already exists.");

        tag.Label = label;
        tag.Query = string.IsNullOrWhiteSpace(dto.Query) ? label : dto.Query.Trim();
        tag.SortOrder = dto.SortOrder;
        tag.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("tags/{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> DeleteTag(int id)
    {
        var tag = await _db.QuickTags.FindAsync(id);
        if (tag is null) return NotFound($"No tag with id {id}.");

        // Nothing references a tag, so this one really is a delete.
        _db.QuickTags.Remove(tag);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /* -------------------------------------------------------- shop text */

    /// <summary>
    /// Every editable string, as a flat object the browser can index.
    ///
    /// Returned as one dictionary rather than a list so the customer site can
    /// write text['hero.headline'] without searching an array on every render.
    /// </summary>
    [HttpGet("text")]
    public async Task<ActionResult<Dictionary<string, string>>> GetText()
    {
        var saved = await _db.SiteTexts.AsNoTracking()
            .ToDictionaryAsync(t => t.Key, t => t.Value);

        // Defaults fill any gap, so a fresh database still reads properly and
        // a key added in code later does not render as an empty heading.
        var result = new Dictionary<string, string>();

        foreach (var entry in SiteTextKeys.All)
        {
            result[entry.Key] = saved.TryGetValue(entry.Key, out var value) && !string.IsNullOrWhiteSpace(value)
                ? value
                : entry.Default;
        }

        return Ok(result);
    }

    /// <summary>Admin: the same strings, with their descriptions, for editing.</summary>
    [HttpGet("text/all")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<IEnumerable<SiteTextDto>>> GetTextForAdmin()
    {
        var saved = await _db.SiteTexts.AsNoTracking()
            .ToDictionaryAsync(t => t.Key, t => t.Value);

        var rows = SiteTextKeys.All
            .OrderBy(e => e.SortOrder)
            .Select(e => new SiteTextDto
            {
                Key = e.Key,
                Value = saved.TryGetValue(e.Key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : e.Default,
                Description = e.Description,
                DefaultValue = e.Default,
            });

        return Ok(rows);
    }

    /// <summary>Admin: save changed wording. Unknown keys are ignored.</summary>
    [HttpPut("text")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> UpdateText(Dictionary<string, string> values)
    {
        var known = SiteTextKeys.All.ToDictionary(e => e.Key);

        foreach (var (key, value) in values)
        {
            // Ignoring unknown keys rather than failing: it keeps an older
            // admin build from breaking against a newer API, and stops the
            // table filling with junk keys.
            if (!known.TryGetValue(key, out var entry)) continue;

            var row = await _db.SiteTexts.FindAsync(key);

            if (row is null)
            {
                _db.SiteTexts.Add(new SiteText
                {
                    Key = key,
                    Value = value.Trim(),
                    Description = entry.Description,
                    SortOrder = entry.SortOrder,
                });
            }
            else
            {
                row.Value = value.Trim();
            }
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    /* --------------------------------------------------- payment methods */

    /// <summary>Admin: every method the code supports, and whether it is offered.</summary>
    [HttpGet("payment-methods")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<IEnumerable<PaymentMethodSettingDto>>> GetPaymentMethods()
    {
        var settings = await _db.PaymentMethodSettings.AsNoTracking()
            .ToDictionaryAsync(s => s.Method, s => s);

        var rows = PaymentMethods.All.Select((option, index) =>
        {
            var key = option.Value.ToString();
            settings.TryGetValue(key, out var saved);

            return new PaymentMethodSettingDto
            {
                Method = key,
                Label = option.Label,
                Note = option.Note,
                Group = option.Group,
                // Anything with no row yet counts as on, so adding a method in
                // code does not silently switch it off for an existing shop.
                IsEnabled = saved?.IsEnabled ?? true,
                SortOrder = saved?.SortOrder ?? index,
            };
        });

        return Ok(rows.OrderBy(r => r.SortOrder));
    }

    [HttpPut("payment-methods")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> UpdatePaymentMethods(List<PaymentMethodSettingWriteDto> dto)
    {
        var valid = PaymentMethods.All.Select(o => o.Value.ToString()).ToHashSet();

        if (dto.Count(row => valid.Contains(row.Method) && row.IsEnabled) == 0)
            return BadRequest("At least one payment method has to stay switched on, or nobody can check out.");

        foreach (var row in dto)
        {
            if (!valid.Contains(row.Method)) continue;

            var setting = await _db.PaymentMethodSettings.FindAsync(row.Method);

            if (setting is null)
            {
                _db.PaymentMethodSettings.Add(new PaymentMethodSetting
                {
                    Method = row.Method,
                    IsEnabled = row.IsEnabled,
                    SortOrder = row.SortOrder,
                });
            }
            else
            {
                setting.IsEnabled = row.IsEnabled;
                setting.SortOrder = row.SortOrder;
            }
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }
}
