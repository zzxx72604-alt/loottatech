using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Dtos;
using lootta.Models;

namespace lootta.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly LoottaDbContext _db;

    public OrdersController(LoottaDbContext db) => _db = db;

    /// <summary>Place an order. Open to guests — no account needed.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<OrderDto>> Create(CreateOrderDto dto)
    {
        if (dto.Items.Count == 0)
            return BadRequest("Your cart is empty.");

        var order = new Order
        {
            OrderNumber = await GenerateOrderNumberAsync(),
            CustomerName = dto.CustomerName.Trim(),
            Phone = dto.Phone.Trim(),
            Address = dto.Address.Trim(),
            DeliveryOption = DeliveryPricing.Parse(dto.DeliveryOption),
            Note = dto.Note?.Trim() ?? string.Empty,
            Status = OrderStatus.Pending
        };

        decimal subtotal = 0;

        foreach (var line in dto.Items)
        {
            var product = await _db.Products
                .Include(p => p.Images)
                .FirstOrDefaultAsync(p => p.Id == line.ProductId);

            if (product is null)
                return BadRequest($"Product {line.ProductId} is no longer available.");

            if (!product.IsActive)
                return BadRequest($"\"{product.Title}\" is no longer for sale.");

            if (product.Stock <= 0)
                return BadRequest($"\"{product.Title}\" is out of stock.");

            // Never take more than the shop actually has.
            var quantity = Math.Clamp(line.Quantity, 1, product.Stock);

            // Price comes from the DATABASE, never from the request body.
            subtotal += product.Price * quantity;

            order.Items.Add(new OrderItem
            {
                ProductId = product.Id,
                Title = product.Title,
                Image = product.Images.OrderByDescending(i => i.IsPrimary)
                                      .Select(i => i.Url).FirstOrDefault() ?? string.Empty,
                Condition = product.Condition.ToApi(),
                UnitPrice = product.Price,
                Quantity = quantity
            });

            // A second-hand unit must not be sold twice.
            product.Stock -= quantity;
            product.UpdatedAt = DateTime.UtcNow;
        }

        order.Subtotal = subtotal;
        order.DeliveryFee = DeliveryPricing.FeeFor(order.DeliveryOption);
        order.Discount = 0;
        order.Total = order.Subtotal + order.DeliveryFee - order.Discount;

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetByNumber),
            new { orderNumber = order.OrderNumber }, order.ToDto());
    }

    /// <summary>Admin: every order, newest first.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<OrderSummaryDto>>> GetAll([FromQuery] string? status)
    {
        var query = _db.Orders.Include(o => o.Items).AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && OrderMapping.TryParseStatus(status, out var parsed))
            query = query.Where(o => o.Status == parsed);

        var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
        return Ok(orders.Select(o => o.ToSummary()));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDto>> GetById(int id)
    {
        var order = await _db.Orders.Include(o => o.Items).AsNoTracking()
                                    .FirstOrDefaultAsync(o => o.Id == id);

        return order is null ? NotFound($"No order with id {id}.") : Ok(order.ToDto());
    }

    /// <summary>Customers track an order using the code on their receipt.</summary>
    [HttpGet("number/{orderNumber}")]
    public async Task<ActionResult<OrderDto>> GetByNumber(string orderNumber)
    {
        var code = orderNumber.Trim().ToUpperInvariant();

        var order = await _db.Orders.Include(o => o.Items).AsNoTracking()
                                    .FirstOrDefaultAsync(o => o.OrderNumber == code);

        return order is null ? NotFound($"No order with number {code}.") : Ok(order.ToDto());
    }

    /// <summary>Admin: move an order along. Cancelling puts the stock back.</summary>
    [HttpPut("{id:int}/status")]
    public async Task<ActionResult<OrderDto>> UpdateStatus(int id, UpdateOrderStatusDto dto)
    {
        if (!OrderMapping.TryParseStatus(dto.Status, out var status))
            return BadRequest($"Unknown status '{dto.Status}'. Valid: {string.Join(", ", OrderMapping.StatusNames)}");

        var order = await _db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null) return NotFound($"No order with id {id}.");

        var wasCancelled = order.Status == OrderStatus.Cancelled;

        // Cancelling returns the units to stock, so they can be sold again.
        if (status == OrderStatus.Cancelled && !wasCancelled)
        {
            foreach (var item in order.Items.Where(i => i.ProductId.HasValue))
            {
                var product = await _db.Products.FindAsync(item.ProductId!.Value);
                if (product is not null) product.Stock += item.Quantity;
            }
        }
        // Un-cancelling takes them back out again.
        else if (wasCancelled && status != OrderStatus.Cancelled)
        {
            foreach (var item in order.Items.Where(i => i.ProductId.HasValue))
            {
                var product = await _db.Products.FindAsync(item.ProductId!.Value);
                if (product is not null) product.Stock = Math.Max(0, product.Stock - item.Quantity);
            }
        }

        order.Status = status;
        order.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(order.ToDto());
    }

    /// <summary>The list of statuses, so the admin UI never hardcodes them.</summary>
    [HttpGet("statuses")]
    public ActionResult<IEnumerable<string>> GetStatuses() => Ok(OrderMapping.StatusNames);

    /* --------------------------------------------------------------------- */

    private async Task<string> GenerateOrderNumberAsync()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
        var random = Random.Shared;

        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = "LT-" + new string(Enumerable.Range(0, 6)
                .Select(_ => alphabet[random.Next(alphabet.Length)]).ToArray());

            if (!await _db.Orders.AnyAsync(o => o.OrderNumber == code))
                return code;
        }

        // Astronomically unlikely, but never return a duplicate.
        return "LT-" + DateTime.UtcNow.Ticks.ToString()[^8..];
    }
}
