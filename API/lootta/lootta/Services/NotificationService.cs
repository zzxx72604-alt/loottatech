using lootta.Data;
using lootta.Models;

namespace lootta.Services;

/// <summary>
/// Writes notifications. One place, so the wording and links stay consistent
/// wherever an event happens.
/// </summary>
public class NotificationService
{
    private readonly LoottaDbContext _db;

    public NotificationService(LoottaDbContext db) => _db = db;

    /// <summary>
    /// Queues a notification. Does NOT save — the caller saves it in the same
    /// transaction as the thing that caused it, so an order can never move
    /// without its notification, or vice versa.
    /// </summary>
    public void Add(int userId, NotificationKind kind, string title, string body, string link = "")
    {
        _db.Notifications.Add(new Notification
        {
            UserId = userId,
            Kind = kind,
            Title = title,
            Body = body,
            Link = link,
        });
    }

    /// <summary>Plain-English wording for each order status.</summary>
    public void OrderStatusChanged(Order order)
    {
        if (order.UserId is null) return;   // guest orders have nobody to tell

        var (title, body) = order.Status switch
        {
            OrderStatus.Confirmed =>
                ("Order confirmed", "We've accepted your order and are getting it ready."),
            OrderStatus.Preparing =>
                ("Order being prepared", "Your items are being checked and packed."),
            OrderStatus.Shipping =>
                ("Order on the way", "Your order has left the shop."),
            OrderStatus.Completed =>
                ("Order completed", "Enjoy it. You can now leave a review."),
            OrderStatus.Cancelled =>
                ("Order cancelled", "Your order was cancelled and any coins earned were returned."),
            _ =>
                ("Order updated", $"Your order is now {order.Status}."),
        };

        Add(order.UserId.Value, NotificationKind.Order,
            $"{title} · {order.OrderNumber}", body, $"/order/{order.OrderNumber}");
    }
}
