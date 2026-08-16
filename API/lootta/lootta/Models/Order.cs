using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

public class Order
{
    public int Id { get; set; }

    /// <summary>Short code the customer quotes, e.g. "LT-7K3QA2".</summary>
    [Required, MaxLength(20)]
    public string OrderNumber { get; set; } = string.Empty;

    // ---- who and where ----
    [Required, MaxLength(120)]
    public string CustomerName { get; set; } = string.Empty;

    [Required, MaxLength(30)]
    public string Phone { get; set; } = string.Empty;

    [Required, MaxLength(300)]
    public string Address { get; set; } = string.Empty;

    public DeliveryOption DeliveryOption { get; set; } = DeliveryOption.Standard;

    [MaxLength(300)]
    public string Note { get; set; } = string.Empty;

    // ---- money: every figure is calculated on the server ----
    public decimal Subtotal { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }

    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
}

/// <summary>
/// A line in an order is a SNAPSHOT of the product at purchase time.
///
/// Title, image and price are copied, not referenced. If the shop later drops
/// the price or renames the item, old orders must still show what the customer
/// actually agreed to pay — referencing the live product would rewrite history.
/// </summary>
public class OrderItem
{
    public int Id { get; set; }

    public int OrderId { get; set; }
    public Order? Order { get; set; }

    /// <summary>
    /// Nullable on purpose. If the admin deletes a product, this becomes NULL
    /// and the order survives with its snapshot intact.
    /// </summary>
    public int? ProductId { get; set; }
    public Product? Product { get; set; }

    [Required, MaxLength(160)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(400)]
    public string Image { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Condition { get; set; } = string.Empty;

    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }

    public decimal LineTotal => UnitPrice * Quantity;
}
