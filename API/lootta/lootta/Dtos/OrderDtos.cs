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

    public string Status { get; set; } = string.Empty;
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
    public DateTime CreatedAt { get; set; }
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

    public static OrderDto ToDto(this Order order) => new()
    {
        Id = order.Id,
        OrderNumber = order.OrderNumber,
        CustomerName = order.CustomerName,
        Phone = order.Phone,
        Address = order.Address,
        DeliveryOption = DeliveryPricing.Label(order.DeliveryOption),
        Note = order.Note,
        VoucherCode = order.VoucherCode,
        Subtotal = order.Subtotal,
        DeliveryFee = order.DeliveryFee,
        Discount = order.Discount,
        TotalPrice = order.Total,
        Status = order.Status.ToString(),
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
        CreatedAt = order.CreatedAt
    };
}
