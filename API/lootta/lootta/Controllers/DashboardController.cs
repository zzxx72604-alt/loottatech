using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Dtos;
using lootta.Models;

namespace lootta.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "AdminOnly")]
public class DashboardController : ControllerBase
{
    private readonly LoottaDbContext _db;

    public DashboardController(LoottaDbContext db) => _db = db;

    /// <summary>Shop statistics for the admin home page.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(DashboardDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardDto>> Get()
    {
        var weekAgo = DateTime.UtcNow.AddDays(-7);

        // Cancelled orders never count as revenue.
        var earning = _db.Orders.Where(o => o.Status != OrderStatus.Cancelled);

        var dto = new DashboardDto
        {
            TotalRevenue = await earning.SumAsync(o => (decimal?)o.Total) ?? 0,
            RevenueThisWeek = await earning.Where(o => o.CreatedAt >= weekAgo)
                                           .SumAsync(o => (decimal?)o.Total) ?? 0,

            OrderCount = await _db.Orders.CountAsync(),
            PendingCount = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Pending),
            CompletedCount = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Completed),
            CancelledCount = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Cancelled),

            ProductCount = await _db.Products.CountAsync(),
            ActiveProductCount = await _db.Products.CountAsync(p => p.IsActive),
            OutOfStockCount = await _db.Products.CountAsync(p => p.Stock == 0),

            // What the shelves are worth at current prices.
            StockValue = await _db.Products.SumAsync(p => (decimal?)(p.Price * p.Stock)) ?? 0,
        };

        // ---- orders grouped by status, for the small bar chart ----
        var grouped = await _db.Orders
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        dto.ByStatus = Enum.GetValues<OrderStatus>()
            .Select(s => new StatusCountDto
            {
                Status = s.ToString(),
                Count = grouped.FirstOrDefault(g => g.Status == s)?.Count ?? 0
            })
            .ToList();

        // ---- items running out ----
        dto.LowStock = await _db.Products
            .Where(p => p.IsActive && p.Stock <= 1)
            .OrderBy(p => p.Stock).ThenBy(p => p.Title)
            .Take(6)
            .Select(p => new StatRowDto
            {
                Id = p.Id,
                Title = p.Title,
                Image = p.Images.OrderByDescending(i => i.IsPrimary).Select(i => i.Url).FirstOrDefault() ?? "",
                Value = p.Stock,
                Amount = p.Price
            })
            .ToListAsync();

        // ---- best sellers, from actual order lines ----
        dto.BestSellers = await _db.OrderItems
            .Where(i => i.Order!.Status != OrderStatus.Cancelled && i.ProductId != null)
            .GroupBy(i => new { i.ProductId, i.Title, i.Image })
            .Select(g => new StatRowDto
            {
                Id = g.Key.ProductId!.Value,
                Title = g.Key.Title,
                Image = g.Key.Image,
                Value = g.Sum(i => i.Quantity),
                Amount = g.Sum(i => i.UnitPrice * i.Quantity)
            })
            .OrderByDescending(r => r.Value)
            .Take(6)
            .ToListAsync();

        // ---- latest orders ----
        var recent = await _db.Orders
            .Include(o => o.Items)
            .OrderByDescending(o => o.CreatedAt)
            .Take(6)
            .ToListAsync();

        dto.RecentOrders = recent.Select(o => o.ToSummary()).ToList();

        return Ok(dto);
    }
}
