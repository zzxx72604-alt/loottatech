namespace lootta.Models;

/// <summary>
/// How the customer says they will pay.
///
/// NOTHING here takes money. No card details are collected, no provider is
/// contacted, and no charge happens. The order records an INTENT, and the shop
/// collects it before the parcel leaves — which is how LoottaTech actually
/// operates today.
///
/// Recording the choice now means the day a real provider is integrated, the
/// data model does not change: only the settlement step is added.
/// </summary>
public enum PaymentMethod
{
    /// <summary>
    /// Retired. The shop is paid before delivery now, because every item is
    /// guaranteed and a refund has to have something to give back. Kept in the
    /// enum only so orders taken under the old rules still read back.
    /// </summary>
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
        new(PaymentMethod.ABAPay, "ABA Pay", "ABA Bank Cambodia", "Bank"),
        new(PaymentMethod.AceledaBank, "ACLEDA", "ACLEDA Bank Cambodia", "Bank"),
        new(PaymentMethod.WingBank, "Wing", "Wing Bank Cambodia", "Bank"),

        new(PaymentMethod.Visa, "Visa", "Credit or debit card", "Card"),
        new(PaymentMethod.Mastercard, "Mastercard", "Credit or debit card", "Card"),

        new(PaymentMethod.LoottaWallet, "Lootta Wallet", "Your shop balance", "Wallet"),
        new(PaymentMethod.WeChatPay, "WeChat Pay", "Scan to pay", "Wallet"),
        new(PaymentMethod.Alipay, "Alipay", "Scan to pay", "Wallet"),
        new(PaymentMethod.PayPal, "PayPal", "Pay with your PayPal account", "Wallet"),
    };

    /// <summary>What an order falls back to, taken from the list rather than
    /// named twice.</summary>
    public static PaymentMethod Default => All[0].Value;

    /// <summary>
    /// Reads a method name from a request.
    ///
    /// A name the shop no longer offers — "CashOnDelivery" from an old client,
    /// or anything invented — falls back to the default rather than recording
    /// a method the shop will not accept.
    /// </summary>
    public static PaymentMethod Parse(string? value) =>
        Enum.TryParse<PaymentMethod>(value, ignoreCase: true, out var parsed)
        && All.Any(o => o.Value == parsed)
            ? parsed
            : Default;

    public static string Label(PaymentMethod method) =>
        All.FirstOrDefault(o => o.Value == method)?.Label ?? method.ToString();
}
