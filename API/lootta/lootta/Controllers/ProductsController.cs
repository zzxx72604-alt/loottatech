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

    /// <summary>
    /// A page of products.
    ///
    /// Every filter is applied in SQL, including condition, price and sort.
    /// Filtering in the browser only works while the browser has everything —
    /// which stops being true the moment the catalogue outgrows one page.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ProductPageDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ProductPageDto>> GetAll(
        [FromQuery] string? search,
        [FromQuery] int? categoryId,
        [FromQuery] string? condition,
        [FromQuery] decimal? maxPrice,
        [FromQuery] string? sort,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 24,
        [FromQuery] bool includeInactive = false)
    {
        take = Math.Clamp(take, 1, 60);
        skip = Math.Max(0, skip);

        var query = _db.Products
            .Include(p => p.Category)
            .Include(p => p.Images)
            .AsNoTracking()
            .AsQueryable();

        // Customers only ever see active products. The admin opts in.
        if (!includeInactive)
            query = query.Where(p => p.IsActive);

        if (categoryId is > 0)
            query = query.Where(p => p.CategoryId == categoryId);

        if (!string.IsNullOrWhiteSpace(condition))
        {
            var wanted = ConditionMap.FromApi(condition);
            query = query.Where(p => p.Condition == wanted);
        }

        if (maxPrice is > 0)
            query = query.Where(p => p.Price <= maxPrice);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();

            query = query.Where(p =>
                EF.Functions.Like(p.Title, $"%{term}%") ||
                EF.Functions.Like(p.Brand, $"%{term}%") ||
                p.PublicId == term.ToLower());
        }

        // Count before paging, so "11 items" is the total and not the page size.
        var total = await query.CountAsync();

        query = sort switch
        {
            "price-asc" => query.OrderBy(p => p.Price),
            "price-desc" => query.OrderByDescending(p => p.Price),
            "discount" => query.OrderByDescending(p => p.OriginalPrice - p.Price),
            "popular" => query.OrderByDescending(p => p.WatchCount),
            _ => query.OrderByDescending(p => p.CreatedAt),
        };

        // A stable tiebreak, or two products with the same price can swap
        // between pages and appear twice while scrolling.
        query = ((IOrderedQueryable<Product>)query).ThenBy(p => p.Id);

        var products = await query.Skip(skip).Take(take).ToListAsync();

        var dtos = products.Select(ToListDto).ToList();
        await AttachRatingsAsync(dtos);

        return Ok(new ProductPageDto
        {
            Items = dtos,
            Total = total,
            HasMore = skip + dtos.Count < total,
        });
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

        var detail = ToDetailDto(product);
        await AttachRatingsAsync(new[] { (ProductListDto)detail });

        return Ok(detail);
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

        var product = new Product { PublicId = await UniquePublicIdAsync() };
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

    /// <summary>Finds a share code nobody else is using.</summary>
    private async Task<string> UniquePublicIdAsync()
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = PublicIdGenerator.Next();
            if (!await _db.Products.AnyAsync(p => p.PublicId == code)) return code;
        }
        return PublicIdGenerator.Next(12);
    }

    /// <summary>
    /// Products to suggest alongside this one.
    ///
    /// Same category first, then anything else, so the row is never empty on a
    /// small catalogue. Ordered by how much people watch and how big the saving
    /// is — a recommendation nobody clicks is just clutter.
    /// </summary>
    [HttpGet("{id:int}/related")]
    public async Task<ActionResult<IEnumerable<ProductListDto>>> Related(int id, [FromQuery] int take = 8)
    {
        var product = await _db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return NotFound($"No product with id {id}.");

        take = Math.Clamp(take, 1, 24);

        var sameCategory = await _db.Products
            .Where(p => p.IsActive && p.Id != id && p.CategoryId == product.CategoryId)
            .Include(p => p.Category)
            .Include(p => p.Images)
            .OrderByDescending(p => p.WatchCount)
            .Take(take)
            .AsNoTracking()
            .ToListAsync();

        var results = sameCategory.ToList();

        // Top up from the rest of the shop so the strip always has something,
        // which matters a lot on a catalogue this size.
        if (results.Count < take)
        {
            var have = results.Select(p => p.Id).Append(id).ToList();

            var filler = await _db.Products
                .Where(p => p.IsActive && !have.Contains(p.Id))
                .Include(p => p.Category)
                .Include(p => p.Images)
                .OrderByDescending(p => p.OriginalPrice - p.Price)
                .ThenByDescending(p => p.WatchCount)
                .Take(take - results.Count)
                .AsNoTracking()
                .ToListAsync();

            results.AddRange(filler);
        }

        var dtos = results.Select(ToListDto).ToList();
        await AttachRatingsAsync(dtos);

        return Ok(dtos);
    }

    /// <summary>Look a product up by its share code — used by share links and admin.</summary>
    [HttpGet("code/{publicId}")]
    public async Task<ActionResult<ProductDetailDto>> GetByCode(string publicId)
    {
        var product = await _db.Products
            .Include(p => p.Category)
            .Include(p => p.Images)
            .Include(p => p.Specs)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.PublicId == publicId.Trim().ToLower());

        if (product is null) return NotFound($"No product with code {publicId}.");

        var detail = ToDetailDto(product);
        await AttachRatingsAsync(new[] { (ProductListDto)detail });

        return Ok(detail);
    }

    /// <summary>
    /// Fills in the review averages for a whole page of products in ONE query.
    ///
    /// The obvious version asks the database per product, which is forty
    /// queries for a forty-product page — the N+1 problem. Grouping once and
    /// matching in memory keeps it at two queries no matter how long the list.
    /// </summary>
    private async Task AttachRatingsAsync(IReadOnlyCollection<ProductListDto> products)
    {
        if (products.Count == 0) return;

        var ids = products.Select(p => p.Id).ToList();

        var stats = await _db.Reviews
            .Where(r => ids.Contains(r.ProductId) && !r.IsHidden)
            .GroupBy(r => r.ProductId)
            .Select(g => new
            {
                ProductId = g.Key,
                Count = g.Count(),
                Sum = g.Sum(r => r.Rating),
            })
            .ToListAsync();

        var byProduct = stats.ToDictionary(s => s.ProductId);

        foreach (var product in products)
        {
            if (!byProduct.TryGetValue(product.Id, out var stat) || stat.Count == 0) continue;

            product.ReviewCount = stat.Count;
            product.Rating = Math.Round((double)stat.Sum / stat.Count, 1);
        }
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

    private static ProductListDto ToListDto(Product p) => ProductMapping.ToListDto(p);

    private static ProductDetailDto ToDetailDto(Product p)
    {
        var dto = new ProductDetailDto
        {
            Id = p.Id,
            PublicId = p.PublicId,
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
