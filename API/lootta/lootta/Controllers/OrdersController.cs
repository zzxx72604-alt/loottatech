using System.Globalization;
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
    private readonly NotificationService _notifications;
    private readonly ImageService _images;

    /// <summary>
    /// Money inside a message, always in US dollars.
    ///
    /// ":C" formats with whatever locale the machine happens to run under, so
    /// the same build prints "$5.00" on one computer and "¥5" on another. The
    /// shop prices in dollars, so the symbol is fixed here instead of being
    /// inherited from the marker's Windows settings.
    /// </summary>
    private static string Money(decimal amount) =>
        "$" + amount.ToString("#,##0.00", CultureInfo.InvariantCulture);

    public OrdersController(
        LoottaDbContext db,
        EconomyService economy,
        NotificationService notifications,
        ImageService images)
    {
        _images = images;
        _db = db;
        _economy = economy;
        _notifications = notifications;
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
            PaymentMethod = PaymentMethods.Parse(dto.PaymentMethod),
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
                return BadRequest($"That voucher needs a subtotal of at least {Money(voucher.MinSpend)}.");

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
         *
         * The amount is worked out now and PAID WHEN THE ORDER ARRIVES, not
         * here. Paying at checkout would let somebody order, spend the coins in
         * the arcade, and then ask for their money back — the coins would
         * already be gone. Nothing is owed until the customer has the goods.
         */
        if (userId is not null)
        {
            var config = await _economy.GetAsync();
            order.CoinsEarned = EconomyService.CoinsForSpend(order.Total, config);
        }

        await _db.SaveChangesAsync();

        if (voucher is not null)
        {
            voucher.OrderId = order.Id;
            await _db.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetByNumber),
            new { orderNumber = order.OrderNumber },
            order.ToDto(viewerOwnsOrder: order.UserId is not null));
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
        var order = await _db.Orders.Include(o => o.Items).Include(o => o.RefundPhotos).AsNoTracking()
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
                preview.VoucherMessage = $"Spend at least {Money(voucher.MinSpend)} to use this voucher.";
            else
            {
                preview.Discount = voucher.DiscountFor(subtotal);
                preview.VoucherApplied = true;
                preview.VoucherMessage = $"{Money(voucher.Value)} off applied.";
            }
        }

        preview.Total = preview.Subtotal + preview.DeliveryFee - preview.Discount;
        preview.CoinsEarned = userId is null
            ? 0
            : EconomyService.CoinsForSpend(preview.Total, config);

        return Ok(preview);
    }

    /// <summary>
    /// The payment methods offered.
    ///
    /// Served by the API so the checkout page cannot offer something the shop
    /// does not accept — and so adding a provider later is a server change,
    /// not a redeploy of the front end.
    /// </summary>
    [HttpGet("payment-methods")]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<object>>> PaymentMethodList()
    {
        /*
         * The enum lists what the code can handle; the settings table says
         * which of those the shop currently offers. A method with no row yet
         * counts as on, so adding one in code does not silently switch it off
         * for a shop that has been running for a while.
         */
        var settings = await _db.PaymentMethodSettings.AsNoTracking()
            .ToDictionaryAsync(s => s.Method, s => s);

        var offered = PaymentMethods.All
            .Select((o, index) =>
            {
                settings.TryGetValue(o.Value.ToString(), out var saved);
                return new
                {
                    option = o,
                    enabled = saved?.IsEnabled ?? true,
                    order = saved?.SortOrder ?? index,
                };
            })
            .Where(row => row.enabled)
            .OrderBy(row => row.order)
            .Select(row => new
            {
                value = row.option.Value.ToString(),
                label = row.option.Label,
                note = row.option.Note,
                group = row.option.Group,
            });

        return Ok(offered);
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

        var order = await _db.Orders.Include(o => o.Items).Include(o => o.RefundPhotos).AsNoTracking()
                                    .FirstOrDefaultAsync(o => o.OrderNumber == code);

        if (order is null) return NotFound($"No order with number {code}.");

        /*
         * No [Authorize] on purpose: a guest who checked out without an
         * account still has to be able to track their parcel.
         *
         * But an order code alone does not prove who you are, so an
         * unidentified caller gets the tracking view with the contact
         * details masked. The buyer, once signed in, and staff see the
         * order in full.
         */
        var userId = CurrentUserIdOrNull();
        var isOwner = userId is not null && order.UserId == userId;
        var isStaff = User.IsInRole(nameof(UserRole.Admin));

        return Ok(isOwner || isStaff ? order.ToDto(viewerOwnsOrder: isOwner) : order.ToTrackingDto());
    }

    /// <summary>Admin: move an order along. Cancelling puts the stock back.</summary>
    [HttpPut("{id:int}/status")]
    [Authorize(Policy = "CanManageOrders")]
    public async Task<ActionResult<OrderDto>> UpdateStatus(int id, UpdateOrderStatusDto dto)
    {
        if (!OrderMapping.TryParseStatus(dto.Status, out var status))
            return BadRequest($"Unknown status '{dto.Status}'. Valid: {string.Join(", ", OrderMapping.StatusNames)}");

        var order = await LoadForRefundAsync(id);
        if (order is null) return NotFound($"No order with id {id}.");

        var wasCancelled = order.Status == OrderStatus.Cancelled;

        // Cancelling returns the units to stock, so they can be sold again.
        if (status == OrderStatus.Cancelled && !wasCancelled)
        {
            await UnwindAsync(order);
        }
        // Arriving is what earns the coins. Held until now, paid once.
        else if (status == OrderStatus.Completed && !order.CoinsCredited && order.CoinsEarned > 0)
        {
            await PayCoinsAsync(order);
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

        // Queued, not saved separately: the status change and the notification
        // land together or not at all.
        _notifications.OrderStatusChanged(order);

        await _db.SaveChangesAsync();

        return Ok(order.ToDto());
    }

    /// <summary>
    /// Puts back what an order took: stock on the shelf, coins in the wallet.
    ///
    /// Shared by cancelling and by approving a refund, because they are the
    /// same event as far as the shop's numbers are concerned — one is asked
    /// for by the shop and the other by the customer.
    /// </summary>
    private async Task UnwindAsync(Order order)
    {
        // Only take back coins that were actually handed over. An order that
        // never arrived was never paid any, and subtracting them anyway would
        // quietly rob the customer of coins earned elsewhere.
        if (order.CoinsCredited && order.UserId is not null && order.CoinsEarned > 0)
        {
            var buyer = await _db.Users.FindAsync(order.UserId.Value);
            if (buyer is not null) buyer.Coins = Math.Max(0, buyer.Coins - order.CoinsEarned);
            order.CoinsCredited = false;
        }

        foreach (var item in order.Items.Where(i => i.ProductId.HasValue))
        {
            var product = await _db.Products.FindAsync(item.ProductId!.Value);
            if (product is not null) product.Stock += item.Quantity;
        }
    }

    /// <summary>Pays the coins an arrived order earned. Once.</summary>
    private async Task PayCoinsAsync(Order order)
    {
        if (order.UserId is null) return;

        var buyer = await _db.Users.FindAsync(order.UserId.Value);
        if (buyer is null) return;

        buyer.Coins += order.CoinsEarned;
        order.CoinsCredited = true;
    }

    /* ---------------------------------------------------------------- */
    /*  Refunds                                                          */
    /* ---------------------------------------------------------------- */

    /// <summary>
    /// The customer asks for their money back.
    ///
    /// Nothing is decided here. The request is recorded on the order and every
    /// admin is told; a person answers it. A refund moves real money, and no
    /// rule this shop could write would be safe to apply on its own.
    /// </summary>
    [HttpPost("{id:int}/refund")]
    [Authorize]
    public async Task<ActionResult<OrderDto>> RequestRefund(int id, RefundRequestDto dto)
    {
        var order = await LoadForRefundAsync(id);
        if (order is null) return NotFound($"No order with id {id}.");

        // A guest order has no owner to check against, so the code alone would
        // be enough for a stranger to unwind somebody else's purchase.
        if (order.UserId is null || order.UserId != CurrentUserIdOrNull())
            return StatusCode(StatusCodes.Status403Forbidden, "That isn't your order.");

        if (order.Refund == RefundState.Requested)
            return BadRequest("You've already asked for a refund on this order. We're looking at it.");

        if (order.Refund is RefundState.ReturnPending or RefundState.ReturnArranged)
            return BadRequest("A refund on this order is already agreed and under way.");

        if (order.Refund == RefundState.Refunded)
            return BadRequest("This order has already been refunded.");

        if (order.Status == OrderStatus.Cancelled)
            return BadRequest("This order was cancelled, so there is nothing to refund.");

        var reason = (dto.Reason ?? string.Empty).Trim();
        if (reason.Length < 5)
            return BadRequest("Tell us briefly what went wrong, so we can sort it out.");

        order.Refund = RefundState.Requested;
        order.RefundReason = reason.Length > 300 ? reason[..300] : reason;
        order.RefundRequestedAt = DateTime.UtcNow;
        order.RefundDecidedAt = null;
        order.UpdatedAt = DateTime.UtcNow;

        await _notifications.RefundRequestedAsync(order);
        await _db.SaveChangesAsync();

        return Ok(order.ToDto(viewerOwnsOrder: true));
    }

    /// <summary>
    /// Attach a photo to an open request. Up to three.
    ///
    /// Words alone leave the shop taking somebody's account of the damage on
    /// trust, which is fine right up until two accounts disagree. Only while
    /// the request is still open: evidence added after a decision would be
    /// evidence for a decision already made.
    /// </summary>
    [HttpPost("{id:int}/refund/photos")]
    [Authorize]
    public async Task<ActionResult<OrderDto>> AddRefundPhoto(int id, IFormFile file)
    {
        var order = await LoadForRefundAsync(id);
        if (order is null) return NotFound($"No order with id {id}.");

        if (order.UserId is null || order.UserId != CurrentUserIdOrNull())
            return StatusCode(StatusCodes.Status403Forbidden, "That isn't your order.");

        if (order.Refund != RefundState.Requested)
            return BadRequest("Photos can only be added while the request is open.");

        if (order.RefundPhotos.Count >= 3)
            return BadRequest("Three photos is the limit — pick the clearest ones.");

        if (file is null) return BadRequest("No file was sent.");

        var saved = await _images.SaveAsync(file, $"refund-{order.Id}-{Guid.NewGuid():N}"[..28]);
        if (!saved.Ok) return BadRequest(saved.Error);

        order.RefundPhotos.Add(new RefundPhoto { Path = saved.BasePath });
        order.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(order.ToDto(viewerOwnsOrder: true));
    }

    /// <summary>
    /// The shop answers a refund request.
    ///
    /// Where it goes next depends on who is holding the item. If it never
    /// arrived, there is nothing to send back: the order is unwound and the
    /// money returned there and then. If the customer has it, the refund waits
    /// until it is back — the shop is not in the business of paying for goods
    /// and letting them keep the goods too.
    /// </summary>
    [HttpPut("{id:int}/refund")]
    [Authorize(Policy = "CanManageOrders")]
    public async Task<ActionResult<OrderDto>> DecideRefund(int id, RefundDecisionDto dto)
    {
        var order = await LoadForRefundAsync(id);
        if (order is null) return NotFound($"No order with id {id}.");

        if (order.Refund != RefundState.Requested)
            return BadRequest("There is no open refund request on this order.");

        order.RefundDecidedAt = DateTime.UtcNow;
        order.UpdatedAt = DateTime.UtcNow;

        if (!dto.Approve)
        {
            order.Refund = RefundState.Declined;
        }
        else if (order.Status == OrderStatus.Completed)
        {
            // Delivered. It has to come back before the money goes out.
            order.Refund = RefundState.ReturnPending;
        }
        else
        {
            // Still with the shop or in transit: stop it and pay the customer.
            await RefundNowAsync(order);
        }

        _notifications.RefundDecided(order);
        await _db.SaveChangesAsync();

        return Ok(order.ToDto());
    }

    /// <summary>
    /// The customer says how the item is coming back.
    ///
    /// Their choice, not the shop's: someone who cannot get to the shop should
    /// not lose a refund over it, and someone who works next door should not
    /// wait three days for a courier.
    /// </summary>
    [HttpPost("{id:int}/refund/return")]
    [Authorize]
    public async Task<ActionResult<OrderDto>> ArrangeReturn(int id, ReturnArrangementDto dto)
    {
        var order = await LoadForRefundAsync(id);
        if (order is null) return NotFound($"No order with id {id}.");

        if (order.UserId is null || order.UserId != CurrentUserIdOrNull())
            return StatusCode(StatusCodes.Status403Forbidden, "That isn't your order.");

        if (order.Refund != RefundState.ReturnPending && order.Refund != RefundState.ReturnArranged)
            return BadRequest("There is no approved return waiting on this order.");

        if (!Enum.TryParse<ReturnMethod>(dto.Method, ignoreCase: true, out var method))
            return BadRequest("Choose either DropOff or CourierPickup.");

        var address = (dto.Address ?? string.Empty).Trim();

        if (method == ReturnMethod.CourierPickup && address.Length < 5)
            return BadRequest("A courier needs somewhere to collect from.");

        order.ReturnMethod = method;
        order.ReturnAddress = address.Length > 300 ? address[..300] : address;

        var note = (dto.Note ?? string.Empty).Trim();
        order.ReturnNote = note.Length > 300 ? note[..300] : note;

        order.Refund = RefundState.ReturnArranged;
        order.ReturnArrangedAt = DateTime.UtcNow;
        order.UpdatedAt = DateTime.UtcNow;

        await _notifications.ReturnArrangedAsync(order);
        await _db.SaveChangesAsync();

        return Ok(order.ToDto(viewerOwnsOrder: true));
    }

    /// <summary>
    /// The item is back on the counter: pay the customer.
    ///
    /// A person confirms this rather than a courier status, because the shop
    /// is signing off on what actually turned up in the box.
    /// </summary>
    [HttpPut("{id:int}/refund/received")]
    [Authorize(Policy = "CanManageOrders")]
    public async Task<ActionResult<OrderDto>> ConfirmReturned(int id)
    {
        var order = await LoadForRefundAsync(id);
        if (order is null) return NotFound($"No order with id {id}.");

        if (order.Refund != RefundState.ReturnPending && order.Refund != RefundState.ReturnArranged)
            return BadRequest("This order is not waiting on a return.");

        await RefundNowAsync(order);
        order.UpdatedAt = DateTime.UtcNow;

        _notifications.RefundDecided(order);
        await _db.SaveChangesAsync();

        return Ok(order.ToDto());
    }

    /// <summary>
    /// Money back: unwind the order and close the request.
    ///
    /// The order is marked cancelled because a refunded order is not one the
    /// shop still owes anything on, and the stock is on the shelf again.
    /// </summary>
    private async Task RefundNowAsync(Order order)
    {
        if (order.Status != OrderStatus.Cancelled)
        {
            await UnwindAsync(order);
            order.Status = OrderStatus.Cancelled;
        }

        order.Refund = RefundState.Refunded;
        order.RefundedAt = DateTime.UtcNow;
    }

    private Task<Order?> LoadForRefundAsync(int id) =>
        _db.Orders
            .Include(o => o.Items)
            .Include(o => o.RefundPhotos)
            .FirstOrDefaultAsync(o => o.Id == id);

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
