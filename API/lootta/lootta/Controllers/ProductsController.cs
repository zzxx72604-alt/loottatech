using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Dtos;
using lootta.Models;
using lootta.Services;

namespace lootta.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly LoottaDbContext _db;
    private readonly ImageService _images;

    public ProductsController(LoottaDbContext db, ImageService images)
    {
        _db = db;
        _images = images;
    }

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

    /// <summary>Create a product. Admin only.</summary>
    [HttpPost]
    [Authorize(Policy = "CanManageProducts")]
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
    [Authorize(Policy = "CanManageProducts")]
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
    [Authorize(Policy = "CanManageProducts")]
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
    [Authorize(Policy = "CanManageProducts")]
    public async Task<IActionResult> SetActive(int id, [FromQuery] bool value)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is null) return NotFound($"No product with id {id}.");

        product.IsActive = value;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /* ============================================================ images */

    /// <summary>
    /// Upload a photo for a product. Multipart form data, one file per call.
    ///
    /// The server crops it square and writes three sizes — the browser sends a
    /// 4000px phone photo, the shop serves a 480px webp. That conversion has to
    /// happen here; a client could always skip it.
    /// </summary>
    [HttpPost("{id:int}/images")]
    [Authorize(Policy = "CanManageProducts")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<ProductImageDto>> UploadImage(int id, IFormFile file)
    {
        var product = await _db.Products.Include(p => p.Images)
                                        .FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return NotFound($"No product with id {id}.");
        if (file is null) return BadRequest("No file was sent.");

        var result = await _images.SaveAsync(file, product.Title);
        if (!result.Ok) return BadRequest(result.Error);

        var image = new ProductImage
        {
            FileName = result.FileName,
            Url = result.BasePath,
            // First photo uploaded becomes the card image automatically.
            IsPrimary = product.Images.Count == 0,
            SortOrder = product.Images.Count,
        };

        product.Images.Add(image);
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new ProductImageDto
        {
            Id = image.Id,
            Url = image.Url,
            IsPrimary = image.IsPrimary,
            SortOrder = image.SortOrder,
        });
    }

    /// <summary>Replace one photo, keeping its position and primary flag.</summary>
    [HttpPut("{id:int}/images/{imageId:int}")]
    [Authorize(Policy = "CanManageProducts")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<ProductImageDto>> ReplaceImage(int id, int imageId, IFormFile file)
    {
        var product = await _db.Products.Include(p => p.Images)
                                        .FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return NotFound($"No product with id {id}.");

        var image = product.Images.FirstOrDefault(i => i.Id == imageId);
        if (image is null) return NotFound($"No image with id {imageId} on that product.");
        if (file is null) return BadRequest("No file was sent.");

        var result = await _images.SaveAsync(file, product.Title);
        if (!result.Ok) return BadRequest(result.Error);

        // Only remove the old files once the new ones exist, so a failed
        // upload can never leave the product with no photo at all.
        var oldPath = image.Url;

        image.Url = result.BasePath;
        image.FileName = result.FileName;
        image.UploadedAt = DateTime.UtcNow;
        product.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        _images.Delete(oldPath);

        return Ok(new ProductImageDto
        {
            Id = image.Id,
            Url = image.Url,
            IsPrimary = image.IsPrimary,
            SortOrder = image.SortOrder,
        });
    }

    [HttpDelete("{id:int}/images/{imageId:int}")]
    [Authorize(Policy = "CanManageProducts")]
    public async Task<IActionResult> DeleteImage(int id, int imageId)
    {
        var product = await _db.Products.Include(p => p.Images)
                                        .FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return NotFound($"No product with id {id}.");

        var image = product.Images.FirstOrDefault(i => i.Id == imageId);
        if (image is null) return NotFound($"No image with id {imageId} on that product.");

        var wasPrimary = image.IsPrimary;
        var path = image.Url;

        product.Images.Remove(image);
        _db.Remove(image);

        // Never leave a product without a card image.
        if (wasPrimary && product.Images.Count > 0)
            product.Images.OrderBy(i => i.SortOrder).First().IsPrimary = true;

        await _db.SaveChangesAsync();
        _images.Delete(path);

        return NoContent();
    }

    /// <summary>Choose which photo appears on the product card.</summary>
    [HttpPut("{id:int}/images/{imageId:int}/primary")]
    [Authorize(Policy = "CanManageProducts")]
    public async Task<IActionResult> SetPrimary(int id, int imageId)
    {
        var product = await _db.Products.Include(p => p.Images)
                                        .FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return NotFound($"No product with id {id}.");
        if (product.Images.All(i => i.Id != imageId))
            return NotFound($"No image with id {imageId} on that product.");

        foreach (var image in product.Images) image.IsPrimary = image.Id == imageId;

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
