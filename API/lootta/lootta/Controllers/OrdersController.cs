using System.Security.Claims;
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
public class OrdersController : ControllerBase
{
    private readonly LoottaDbContext _db;
    private readonly EconomyService _economy;

    public OrdersController(LoottaDbContext db, EconomyService economy)
    {
        _db = db;
        _economy = economy;
    }

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

        // Signed in? Attach the order to the account. Guests stay anonymous.
        var userId = CurrentUserIdOrNull();
        order.UserId = userId;

        /*
         * Voucher discounts are worked out HERE, from the voucher row in the
         * database. The browser only ever sends a code. Sending an amount
         * would let anyone give themselves any discount they liked.
         */
        Voucher? voucher = null;
        if (!string.IsNullOrWhiteSpace(dto.VoucherCode))
        {
            var code = dto.VoucherCode.Trim().ToUpperInvariant();
            voucher = await _db.Vouchers.FirstOrDefaultAsync(v => v.Code == code);

            if (voucher is null)
                return BadRequest($"Voucher {code} does not exist.");
            // A null owner means a public promo code — anyone may use it.
            if (voucher.UserId is not null && voucher.UserId != userId)
                return BadRequest("That voucher belongs to another account.");
            if (voucher.IsSpent)
                return BadRequest("That voucher has already been used.");
            if (voucher.IsExpired)
                return BadRequest("That voucher has expired.");
            if (subtotal < voucher.MinSpend)
                return BadRequest($"That voucher needs a subtotal of at least {voucher.MinSpend:C}.");

            order.Discount = voucher.DiscountFor(subtotal);
            order.VoucherCode = voucher.Code;
            order.VoucherId = voucher.Id;
        }

        order.Total = order.Subtotal + order.DeliveryFee - order.Discount;

        _db.Orders.Add(order);

        // Burn the voucher in the same save as the order, so it can never be
        // spent twice even if two requests arrive together.
        if (voucher is not null)
        {
            voucher.UsedAt = DateTime.UtcNow;
        }

        /*
         * Shopping is how coins enter the economy. Coins are awarded on the
         * amount actually paid, so a discount doesn't earn coins on money that
         * was never spent. Guests earn nothing — there's no account to hold it.
         */
        if (userId is not null)
        {
            var config = await _economy.GetAsync();
            var buyer = await _db.Users.FindAsync(userId.Value);
            if (buyer is not null)
            {
                order.CoinsEarned = EconomyService.CoinsForSpend(order.Total, config);
                buyer.Coins += order.CoinsEarned;
            }
        }

        await _db.SaveChangesAsync();

        if (voucher is not null)
        {
            voucher.OrderId = order.Id;
            await _db.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetByNumber),
            new { orderNumber = order.OrderNumber }, order.ToDto());
    }

    /// <summary>Admin: every order, newest first.</summary>
    [HttpGet]
    [Authorize(Policy = "CanManageOrders")]
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

    /// <summary>
    /// Price an order without placing it, so the checkout page can show the
    /// voucher discount the moment a code is typed.
    ///
    /// Same rules as creating an order, nothing saved. The browser still never
    /// calculates the discount itself — it only displays what the server says.
    /// </summary>
    [HttpPost("preview")]
    [ProducesResponseType(typeof(OrderPreviewDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<OrderPreviewDto>> Preview(CreateOrderDto dto)
    {
        var config = await _economy.GetAsync();
        var userId = CurrentUserIdOrNull();

        decimal subtotal = 0;

        foreach (var line in dto.Items)
        {
            var product = await _db.Products.AsNoTracking()
                                            .FirstOrDefaultAsync(p => p.Id == line.ProductId);
            if (product is null) continue;

            var quantity = Math.Clamp(line.Quantity, 1, Math.Max(1, product.Stock));
            subtotal += product.Price * quantity;
        }

        var option = DeliveryPricing.Parse(dto.DeliveryOption);

        var preview = new OrderPreviewDto
        {
            Subtotal = subtotal,
            DeliveryFee = DeliveryPricing.FeeFor(option),
        };

        if (!string.IsNullOrWhiteSpace(dto.VoucherCode))
        {
            var code = dto.VoucherCode.Trim().ToUpperInvariant();
            var voucher = await _db.Vouchers.AsNoTracking()
                                            .FirstOrDefaultAsync(v => v.Code == code);

            if (voucher is null)
                preview.VoucherMessage = "That code doesn't exist.";
            else if (voucher.UserId is not null && voucher.UserId != userId)
                preview.VoucherMessage = "That voucher belongs to another account.";
            else if (voucher.UsedAt is not null)
                preview.VoucherMessage = "That voucher has already been used.";
            else if (DateTime.UtcNow > voucher.ExpiresAt)
                preview.VoucherMessage = "That voucher has expired.";
            else if (subtotal < voucher.MinSpend)
                preview.VoucherMessage = $"Spend at least {voucher.MinSpend:C} to use this voucher.";
            else
            {
                preview.Discount = voucher.DiscountFor(subtotal);
                preview.VoucherApplied = true;
                preview.VoucherMessage = $"{voucher.Value:C} off applied.";
            }
        }

        preview.Total = preview.Subtotal + preview.DeliveryFee - preview.Discount;
        preview.CoinsEarned = userId is null
            ? 0
            : EconomyService.CoinsForSpend(preview.Total, config);

        return Ok(preview);
    }

    /// <summary>Orders belonging to the signed-in customer.</summary>
    [HttpGet("mine")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<OrderSummaryDto>>> Mine()
    {
        var userId = CurrentUserIdOrNull();
        var orders = await _db.Orders
            .Include(o => o.Items)
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .AsNoTracking()
            .ToListAsync();

        return Ok(orders.Select(o => o.ToSummary()));
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
    [Authorize(Policy = "CanManageOrders")]
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
            // Take back the coins it paid out, or cancelling would be free money.
            if (order.UserId is not null && order.CoinsEarned > 0)
            {
                var buyer = await _db.Users.FindAsync(order.UserId.Value);
                if (buyer is not null) buyer.Coins = Math.Max(0, buyer.Coins - order.CoinsEarned);
            }

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

    /// <summary>The signed-in user's id, or null for a guest.</summary>
    private int? CurrentUserIdOrNull()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(claim, out var id) ? id : null;
    }

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
