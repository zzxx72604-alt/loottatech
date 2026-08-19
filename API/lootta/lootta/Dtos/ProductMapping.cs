using lootta.Models;

namespace lootta.Dtos;

/// <summary>
/// Product to DTO, in one place.
///
/// Both ProductsController and MeController return product lists. Duplicating
/// the mapping is how two endpoints quietly start returning different shapes.
/// </summary>
public static class ProductMapping
{
    public static ProductListDto ToListDto(Product p) => new()
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
        Images = p.Images.OrderByDescending(i => i.IsPrimary)
                         .ThenBy(i => i.SortOrder)
                         .Select(i => i.Url)
                         .ToList()
    };
}
