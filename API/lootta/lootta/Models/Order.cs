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

    /// <summary>
    /// How the customer intends to pay. No money moves at checkout — the shop
    /// collects before the parcel leaves.
    /// </summary>
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.ABAPay;

    /// <summary>Always false today. The column exists so a real provider can
    /// set it later without a schema change.</summary>
    public bool IsPaid { get; set; }

    [MaxLength(300)]
    public string Note { get; set; } = string.Empty;

    // ---- money: every figure is calculated on the server ----
    public decimal Subtotal { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }

    /// <summary>Set when a signed-in customer ordered. Guests leave it null.</summary>
    public int? UserId { get; set; }
    public User? User { get; set; }

    /// <summary>The voucher that produced <see cref="Discount"/>, if any.</summary>
    public int? VoucherId { get; set; }

    [MaxLength(20)]
    public string VoucherCode { get; set; } = string.Empty;

    /// <summary>
    /// Coins this order is worth. Held, not paid, until the parcel arrives.
    /// </summary>
    public int CoinsEarned { get; set; }

    /// <summary>
    /// Whether those coins have actually reached the customer's balance.
    ///
    /// They are paid when the order is completed, not when it is placed. An
    /// order that never arrives, or comes back as a refund, must not leave
    /// coins behind it — and without this flag, marking an order completed
    /// twice would pay them twice.
    /// </summary>
    public bool CoinsCredited { get; set; }

    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    // ---- refunds: asked for by the customer, decided by a person ----

    public RefundState Refund { get; set; } = RefundState.None;

    /// <summary>Evidence the customer attached. Up to three.</summary>
    public ICollection<RefundPhoto> RefundPhotos { get; set; } = new List<RefundPhoto>();

    /// <summary>In the customer's own words. Empty until they ask.</summary>
    [MaxLength(300)]
    public string RefundReason { get; set; } = string.Empty;

    public DateTime? RefundRequestedAt { get; set; }
    public DateTime? RefundDecidedAt { get; set; }
    public DateTime? RefundedAt { get; set; }

    // ---- getting a delivered item back before the money goes out ----

    public ReturnMethod? ReturnMethod { get; set; }

    /// <summary>Where the courier collects, when that is the arrangement.</summary>
    [MaxLength(300)]
    public string ReturnAddress { get; set; } = string.Empty;

    /// <summary>Anything else the customer wants the shop to know.</summary>
    [MaxLength(300)]
    public string ReturnNote { get; set; } = string.Empty;

    public DateTime? ReturnArrangedAt { get; set; }

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
