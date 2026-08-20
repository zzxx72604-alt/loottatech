namespace lootta.Models;

/// <summary>
/// The stages a LoottaTech order moves through.
/// Stored as text so the column is readable in DBeaver.
/// </summary>
public enum OrderStatus
{
    Pending,
    Confirmed,
    Preparing,
    Shipping,
    Completed,
    Cancelled
}

/// <summary>
/// Where an order stands with the customer's money.
///
/// Separate from <see cref="OrderStatus"/> on purpose: an order can be on its
/// way and refused, or completed and refunded, and squeezing both into one
/// column would lose whichever half was written second.
/// </summary>
public enum RefundState
{
    None,

    /// <summary>Asked for. Nobody has looked at it yet.</summary>
    Requested,

    /// <summary>Looked at and turned down.</summary>
    Declined,

    /// <summary>
    /// Agreed, but the customer already has the item, so it has to come back
    /// before the money goes out. They say how it is travelling.
    /// </summary>
    ReturnPending,

    /// <summary>They said how. The shop is waiting for the parcel.</summary>
    ReturnArranged,

    /// <summary>Money returned. The end of the road either way.</summary>
    Refunded
}

/// <summary>How a returned item gets back to the shop.</summary>
public enum ReturnMethod
{
    /// <summary>The customer brings it in.</summary>
    DropOff,

    /// <summary>The shop sends a courier to collect it.</summary>
    CourierPickup
}

public enum DeliveryOption
{
    Standard,
    SameDay,
    Pickup
}

public static class DeliveryPricing
{
    /// <summary>Delivery fees live on the server so the client cannot invent one.</summary>
    public static decimal FeeFor(DeliveryOption option) => option switch
    {
        DeliveryOption.Standard => 2m,
        DeliveryOption.SameDay => 5m,
        DeliveryOption.Pickup => 0m,
        _ => 2m
    };

    public static string Label(DeliveryOption option) => option switch
    {
        DeliveryOption.Standard => "Standard Delivery",
        DeliveryOption.SameDay => "Same-Day Delivery",
        DeliveryOption.Pickup => "Store Pickup",
        _ => "Standard Delivery"
    };

    public static DeliveryOption Parse(string? value) => (value ?? "").Replace("-", "").Replace(" ", "").ToLowerInvariant() switch
    {
        "sameday" or "samedaydelivery" => DeliveryOption.SameDay,
        "pickup" or "storepickup" => DeliveryOption.Pickup,
        _ => DeliveryOption.Standard
    };
}
