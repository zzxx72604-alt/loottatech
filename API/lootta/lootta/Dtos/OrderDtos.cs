using System.ComponentModel.DataAnnotations;
using lootta.Models;

namespace lootta.Dtos;

/// <summary>
/// What the customer's checkout sends.
///
/// Note what is NOT here: prices and totals. The client sends product ids and
/// quantities only. The server looks up the real price. Otherwise anyone could
/// POST a $1 total for a $319 laptop.
/// </summary>
public class CreateOrderDto
{
    [Required, MinLength(1, ErrorMessage = "Your cart is empty.")]
    public List<CreateOrderItemDto> Items { get; set; } = new();

    [Required, MaxLength(120)]
    public string CustomerName { get; set; } = string.Empty;

    [Required, MaxLength(30)]
    public string Phone { get; set; } = string.Empty;

    [Required, MaxLength(300)]
    public string Address { get; set; } = string.Empty;

    /// <summary>"Standard Delivery" | "Same-Day Delivery" | "Store Pickup"</summary>
    public string DeliveryOption { get; set; } = "Standard Delivery";

    [MaxLength(300)]
    public string Note { get; set; } = string.Empty;

    /// <summary>"ABAPay", "Visa", "WingBank"… See /api/orders/payment-methods.</summary>
    public string PaymentMethod { get; set; } = "ABAPay";

    /// <summary>Optional voucher CODE only. The server looks up its value.</summary>
    [MaxLength(20)]
    public string VoucherCode { get; set; } = string.Empty;
}

public class CreateOrderItemDto
{
    public int ProductId { get; set; }

    [Range(1, 99)]
    public int Quantity { get; set; } = 1;
}

/// <summary>
/// What an order WOULD cost. Same rules as creating one, but nothing is saved.
///
/// This exists so the checkout page can show the discount the moment a voucher
/// code is typed, instead of the customer finding out only after ordering.
/// The browser still never calculates the discount itself.
/// </summary>
public class OrderPreviewDto
{
    public decimal Subtotal { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }

    public int CoinsEarned { get; set; }

    public bool VoucherApplied { get; set; }
    public string VoucherMessage { get; set; } = string.Empty;
}

public class OrderItemDto
{
    public int? ProductId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Image { get; set; } = string.Empty;
    public string Condition { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }
}

public class OrderDto
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;

    public string CustomerName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string DeliveryOption { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;

    public decimal Subtotal { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Discount { get; set; }
    public decimal TotalPrice { get; set; }

    public string VoucherCode { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public bool IsPaid { get; set; }

    public string Status { get; set; } = string.Empty;

    /// <summary>None | Requested | Approved | Declined.</summary>
    public string Refund { get; set; } = "None";

    /// <summary>Why the customer asked. Withheld from a guest holding the code.</summary>
    public string RefundReason { get; set; } = string.Empty;

    public DateTime? RefundRequestedAt { get; set; }
    public DateTime? RefundDecidedAt { get; set; }

    /// <summary>True only for the customer who placed the order, and only
    /// while a request would actually be accepted.</summary>
    public bool CanRequestRefund { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<OrderItemDto> Items { get; set; } = new();
}

/// <summary>Compact shape for the admin order table.</summary>
public class OrderSummaryDto
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string DeliveryOption { get; set; } = string.Empty;
    public decimal TotalPrice { get; set; }
    public int ItemCount { get; set; }
    public string Status { get; set; } = string.Empty;

    /// <summary>None | Requested | Approved | Declined.</summary>
    public string Refund { get; set; } = "None";

    public string RefundReason { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

/// <summary>A customer asking for their money back.</summary>
public class RefundRequestDto
{
    [Required, MaxLength(300)]
    public string Reason { get; set; } = string.Empty;
}

/// <summary>An admin answering that request.</summary>
public class RefundDecisionDto
{
    public bool Approve { get; set; }
}

public class UpdateOrderStatusDto
{
    /// <summary>Pending | Confirmed | Preparing | Shipping | Completed | Cancelled</summary>
    [Required]
    public string Status { get; set; } = string.Empty;
}

public static class OrderMapping
{
    public static readonly string[] StatusNames =
        Enum.GetNames(typeof(OrderStatus));

    public static bool TryParseStatus(string? value, out OrderStatus status) =>
        Enum.TryParse(value, ignoreCase: true, out status);

    /// <param name="viewerOwnsOrder">
    /// True only when the person asking placed this order themselves. It
    /// decides whether the page may offer a refund button, which is a
    /// question about the viewer rather than about the order.
    /// </param>
    public static OrderDto ToDto(this Order order, bool viewerOwnsOrder = false) => new()
    {
        Id = order.Id,
        OrderNumber = order.OrderNumber,
        CustomerName = order.CustomerName,
        Phone = order.Phone,
        Address = order.Address,
        DeliveryOption = DeliveryPricing.Label(order.DeliveryOption),
        Note = order.Note,
        VoucherCode = order.VoucherCode,
        PaymentMethod = PaymentMethods.Label(order.PaymentMethod),
        IsPaid = order.IsPaid,
        Subtotal = order.Subtotal,
        DeliveryFee = order.DeliveryFee,
        Discount = order.Discount,
        TotalPrice = order.Total,
        Status = order.Status.ToString(),
        Refund = order.Refund.ToString(),
        RefundReason = order.RefundReason,
        RefundRequestedAt = order.RefundRequestedAt,
        RefundDecidedAt = order.RefundDecidedAt,
        CanRequestRefund = viewerOwnsOrder
                           && order.Refund == RefundState.None
                           && order.Status != OrderStatus.Cancelled,
        CreatedAt = order.CreatedAt,
        Items = order.Items.Select(i => new OrderItemDto
        {
            ProductId = i.ProductId,
            Title = i.Title,
            Image = i.Image,
            Condition = i.Condition,
            Price = i.UnitPrice,
            Quantity = i.Quantity,
            LineTotal = i.UnitPrice * i.Quantity
        }).ToList()
    };

    /// <summary>
    /// The tracking view of an order, for a caller we cannot identify.
    ///
    /// Anyone holding the code from a receipt may look an order up — that is
    /// the point of guest tracking, and parcel couriers work the same way.
    /// What they must not receive is a delivery address, because the code
    /// would then be enough to learn where a stranger lives.
    ///
    /// Status, items and totals are what somebody tracking a parcel actually
    /// needs, so those stay in full. Only the contact details are reduced.
    /// </summary>
    public static OrderDto ToTrackingDto(this Order order)
    {
        var dto = order.ToDto();

        dto.CustomerName = MaskName(order.CustomerName);
        dto.Phone = MaskPhone(order.Phone);
        dto.Address = MaskAddress(order.Address);

        // Free text written by the buyer. It could contain anything, so it
        // is not shown to anyone who has not proved who they are — the same
        // goes for whatever they said when asking for their money back.
        dto.Note = string.Empty;
        dto.RefundReason = string.Empty;

        return dto;
    }

    /// <summary>"Dara Kim" becomes "Dara K." — recognisable, not identifying.</summary>
    private static string MaskName(string name)
    {
        var parts = name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return string.Empty;
        if (parts.Length == 1) return parts[0];

        return $"{parts[0]} {parts[^1][..1]}.";
    }

    /// <summary>Shows enough of a number to recognise, not enough to reuse.</summary>
    private static string MaskPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length < 5) return digits.Length == 0 ? string.Empty : "•••";

        return $"{digits[..1]}***-{digits[^4..]}";
    }

    /// <summary>
    /// Keeps only the last segment, which is normally the city.
    ///
    /// Enough to confirm the parcel is heading to the right town; not enough
    /// to put a street and house number in front of a stranger.
    /// </summary>
    private static string MaskAddress(string address)
    {
        if (string.IsNullOrWhiteSpace(address)) return string.Empty;

        var parts = address.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length <= 1 ? "•••" : $"••• {parts[^1]}";
    }

    public static OrderSummaryDto ToSummary(this Order order) => new()
    {
        Id = order.Id,
        OrderNumber = order.OrderNumber,
        CustomerName = order.CustomerName,
        Phone = order.Phone,
        DeliveryOption = DeliveryPricing.Label(order.DeliveryOption),
        TotalPrice = order.Total,
        ItemCount = order.Items.Sum(i => i.Quantity),
        Status = order.Status.ToString(),
        Refund = order.Refund.ToString(),
        RefundReason = order.RefundReason,
        CreatedAt = order.CreatedAt
    };
}
