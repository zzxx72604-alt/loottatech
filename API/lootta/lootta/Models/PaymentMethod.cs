namespace lootta.Models;

/// <summary>
/// How the customer says they will pay.
///
/// NOTHING here takes money. No card details are collected, no provider is
/// contacted, and no charge happens. The order records an INTENT, and the shop
/// settles it on delivery or in store — which is how LoottaTech actually
/// operates today.
///
/// Recording the choice now means the day a real provider is integrated, the
/// data model does not change: only the settlement step is added.
/// </summary>
public enum PaymentMethod
{
    CashOnDelivery,
    LoottaWallet,
    Visa,
    Mastercard,
    WeChatPay,
    Alipay,
    PayPal,
    ABAPay,
    AceledaBank,
    WingBank,
}

public static class PaymentMethods
{
    public record Option(PaymentMethod Value, string Label, string Note, string Group);

    /// <summary>
    /// Offered at checkout. Deliberately no cryptocurrency: prices are in
    /// dollars, refunds have to be possible, and a second-hand shop taking
    /// irreversible payments is a bad trade for the customer.
    /// </summary>
    public static readonly Option[] All =
    {
        new(PaymentMethod.CashOnDelivery, "Cash on delivery", "Pay the courier or in store", "Pay later"),
        new(PaymentMethod.LoottaWallet, "Lootta Wallet", "Your shop balance", "Wallet"),

        new(PaymentMethod.Visa, "Visa", "Credit or debit card", "Card"),
        new(PaymentMethod.Mastercard, "Mastercard", "Credit or debit card", "Card"),

        new(PaymentMethod.ABAPay, "ABA Pay", "ABA Bank Cambodia", "Bank"),
        new(PaymentMethod.AceledaBank, "ACLEDA", "ACLEDA Bank Cambodia", "Bank"),
        new(PaymentMethod.WingBank, "Wing", "Wing Bank Cambodia", "Bank"),

        new(PaymentMethod.WeChatPay, "WeChat Pay", "Scan to pay", "Wallet"),
        new(PaymentMethod.Alipay, "Alipay", "Scan to pay", "Wallet"),
        new(PaymentMethod.PayPal, "PayPal", "Pay with your PayPal account", "Wallet"),
    };

    public static PaymentMethod Parse(string? value) =>
        Enum.TryParse<PaymentMethod>(value, ignoreCase: true, out var parsed)
            ? parsed
            : PaymentMethod.CashOnDelivery;

    public static string Label(PaymentMethod method) =>
        All.FirstOrDefault(o => o.Value == method)?.Label ?? method.ToString();
}
