namespace lootta.Dtos;

/// <summary>
/// Everything the admin dashboard needs, in ONE request.
///
/// The alternative — letting Angular fetch all products and all orders and add
/// them up in the browser — works with 10 products and falls over with 10,000.
/// Aggregation belongs in the database, which is built for it.
/// </summary>
public class DashboardDto
{
    public decimal TotalRevenue { get; set; }
    public decimal RevenueThisWeek { get; set; }

    public int OrderCount { get; set; }
    public int PendingCount { get; set; }
    public int CompletedCount { get; set; }
    public int CancelledCount { get; set; }

    public int ProductCount { get; set; }
    public int ActiveProductCount { get; set; }
    public int OutOfStockCount { get; set; }

    public decimal StockValue { get; set; }

    public List<StatRowDto> LowStock { get; set; } = new();
    public List<StatRowDto> BestSellers { get; set; } = new();
    public List<OrderSummaryDto> RecentOrders { get; set; } = new();
    public List<StatusCountDto> ByStatus { get; set; } = new();
}

public class StatRowDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Image { get; set; } = string.Empty;
    /// <summary>Stock remaining, or units sold, depending on the list.</summary>
    public int Value { get; set; }
    public decimal Amount { get; set; }
}

public class StatusCountDto
{
    public string Status { get; set; } = string.Empty;
    public int Count { get; set; }
}
