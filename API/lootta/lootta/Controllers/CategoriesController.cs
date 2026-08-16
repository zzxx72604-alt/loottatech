using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Dtos;
using lootta.Models;

namespace lootta.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly LoottaDbContext _db;

    public CategoriesController(LoottaDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<CategoryDto>>> GetAll()
    {
        var categories = await _db.Categories
            .AsNoTracking()
            .OrderBy(c => c.SortOrder)
            .Select(c => new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Slug = c.Slug,
                SortOrder = c.SortOrder,
                ProductCount = c.Products.Count(p => p.IsActive)
            })
            .ToListAsync();

        return Ok(categories);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CategoryDto>> GetById(int id)
    {
        var category = await _db.Categories
            .AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Slug = c.Slug,
                SortOrder = c.SortOrder,
                ProductCount = c.Products.Count(p => p.IsActive)
            })
            .FirstOrDefaultAsync();

        return category is null ? NotFound($"No category with id {id}.") : Ok(category);
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<CategoryDto>> Create(CategoryWriteDto dto)
    {
        if (await _db.Categories.AnyAsync(c => c.Slug == dto.Slug))
            return BadRequest($"A category with slug '{dto.Slug}' already exists.");

        var category = new Category
        {
            Name = dto.Name.Trim(),
            Slug = dto.Slug.Trim().ToLowerInvariant(),
            SortOrder = dto.SortOrder
        };

        _db.Categories.Add(category);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = category.Id },
            new CategoryDto { Id = category.Id, Name = category.Name, Slug = category.Slug, SortOrder = category.SortOrder });
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(int id, CategoryWriteDto dto)
    {
        var category = await _db.Categories.FindAsync(id);
        if (category is null) return NotFound($"No category with id {id}.");

        category.Name = dto.Name.Trim();
        category.Slug = dto.Slug.Trim().ToLowerInvariant();
        category.SortOrder = dto.SortOrder;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Refused if the category still holds products — the database enforces
    /// this too (DeleteBehavior.Restrict), but a clear message beats a 500.
    /// </summary>
    [HttpDelete("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await _db.Categories
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category is null) return NotFound($"No category with id {id}.");

        if (category.Products.Any())
            return BadRequest($"'{category.Name}' still has {category.Products.Count} product(s). Move or delete them first.");

        _db.Categories.Remove(category);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
