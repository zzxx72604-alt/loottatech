using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Dtos;
using lootta.Models;

namespace lootta.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly LoottaDbContext _db;

    public ProductsController(LoottaDbContext db) => _db = db;

    /// <summary>List products, with optional search and category filters.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<ProductListDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ProductListDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] int? categoryId,
        [FromQuery] bool includeInactive = false)
    {
        var query = _db.Products
            .Include(p => p.Category)
            .Include(p => p.Images)
            .AsNoTracking()          // read-only, so skip change tracking
            .AsQueryable();

        // Customers only ever see active products. The admin app opts in.
        if (!includeInactive)
            query = query.Where(p => p.IsActive);

        if (categoryId is > 0)
            query = query.Where(p => p.CategoryId == categoryId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(p =>
                EF.Functions.Like(p.Title, $"%{term}%") ||
                EF.Functions.Like(p.Brand, $"%{term}%"));
        }

        var products = await query
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return Ok(products.Select(ToListDto));
    }

    /// <summary>One product, with specs and every image.</summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(ProductDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductDetailDto>> GetById(int id)
    {
        var product = await _db.Products
            .Include(p => p.Category)
            .Include(p => p.Images)
            .Include(p => p.Specs)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return NotFound($"No product with id {id}.");

        return Ok(ToDetailDto(product));
    }

    /// <summary>Create a product. Admin only once JWT is added.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ProductDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProductDetailDto>> Create(ProductWriteDto dto)
    {
        if (!await _db.Categories.AnyAsync(c => c.Id == dto.CategoryId))
            return BadRequest($"Category {dto.CategoryId} does not exist.");

        var product = new Product();
        Apply(dto, product);

        _db.Products.Add(product);
        await _db.SaveChangesAsync();

        await _db.Entry(product).Reference(p => p.Category).LoadAsync();
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, ToDetailDto(product));
    }

    /// <summary>Replace a product's editable fields.</summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(ProductDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductDetailDto>> Update(int id, ProductWriteDto dto)
    {
        var product = await _db.Products
            .Include(p => p.Specs)
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return NotFound($"No product with id {id}.");

        if (!await _db.Categories.AnyAsync(c => c.Id == dto.CategoryId))
            return BadRequest($"Category {dto.CategoryId} does not exist.");

        Apply(dto, product);
        product.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        await _db.Entry(product).Reference(p => p.Category).LoadAsync();

        return Ok(ToDetailDto(product));
    }

    /// <summary>
    /// Delete a product. Images and specs go with it (cascade), but the
    /// files on disk are removed too so nothing is orphaned.
    /// </summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await _db.Products
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return NotFound($"No product with id {id}.");

        _db.Products.Remove(product);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Hide or show a product without deleting it.</summary>
    [HttpPut("{id:int}/active")]
    public async Task<IActionResult> SetActive(int id, [FromQuery] bool value)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is null) return NotFound($"No product with id {id}.");

        product.IsActive = value;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /* ------------------------------------------------------------ mapping */

    private static void Apply(ProductWriteDto dto, Product product)
    {
        product.Title = dto.Title.Trim();
        product.Brand = dto.Brand.Trim();
        product.CategoryId = dto.CategoryId;
        product.Condition = ConditionMap.FromApi(dto.Condition);
        product.Price = dto.Price;
        product.OriginalPrice = dto.OriginalPrice;
        product.Stock = dto.Stock;
        product.WarrantyMonths = dto.WarrantyMonths;
        product.Tested = dto.Tested;
        product.IsActive = dto.IsActive;
        product.Description = dto.Description;
        product.FlawNotes = dto.FlawNotes;

        // Specs are replaced wholesale — simpler than diffing, and the list
        // is always short.
        product.Specs.Clear();
        var order = 0;
        foreach (var spec in dto.Specs.Where(s => !string.IsNullOrWhiteSpace(s.Key)))
        {
            product.Specs.Add(new ProductSpec
            {
                Key = spec.Key.Trim(),
                Value = spec.Value.Trim(),
                SortOrder = order++
            });
        }
    }

    private static ProductListDto ToListDto(Product p) => new()
    {
        Id = p.Id,
        Title = p.Title,
        Brand = p.Brand,
        Category = p.Category?.Name ?? string.Empty,
        CategoryId = p.CategoryId,
        Condition = p.Condition.ToApi(),
        Price = p.Price,
        OriginalPrice = p.OriginalPrice,
        Stock = p.Stock,
        WarrantyMonths = p.WarrantyMonths,
        Tested = p.Tested,
        WatchCount = p.WatchCount,
        IsActive = p.IsActive,
        Images = p.Images.OrderByDescending(i => i.IsPrimary)
                         .ThenBy(i => i.SortOrder)
                         .Select(i => i.Url)
                         .ToList()
    };

    private static ProductDetailDto ToDetailDto(Product p)
    {
        var dto = new ProductDetailDto
        {
            Id = p.Id,
            Title = p.Title,
            Brand = p.Brand,
            Category = p.Category?.Name ?? string.Empty,
            CategoryId = p.CategoryId,
            Condition = p.Condition.ToApi(),
            Price = p.Price,
            OriginalPrice = p.OriginalPrice,
            Stock = p.Stock,
            WarrantyMonths = p.WarrantyMonths,
            Tested = p.Tested,
            WatchCount = p.WatchCount,
            IsActive = p.IsActive,
            Description = p.Description,
            FlawNotes = p.FlawNotes,
            Images = p.Images.OrderByDescending(i => i.IsPrimary)
                             .ThenBy(i => i.SortOrder)
                             .Select(i => i.Url)
                             .ToList(),
            ImageDetails = p.Images.OrderByDescending(i => i.IsPrimary)
                                   .ThenBy(i => i.SortOrder)
                                   .Select(i => new ProductImageDto
                                   {
                                       Id = i.Id,
                                       Url = i.Url,
                                       IsPrimary = i.IsPrimary,
                                       SortOrder = i.SortOrder
                                   }).ToList(),
            Specs = p.Specs.OrderBy(s => s.SortOrder)
                           .Select(s => new SpecDto { Key = s.Key, Value = s.Value })
                           .ToList()
        };
        return dto;
    }
}
