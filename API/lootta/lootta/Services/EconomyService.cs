using Microsoft.EntityFrameworkCore;
using lootta.Data;
using lootta.Models;

namespace lootta.Services;

/// <summary>
/// Reads the economy settings, and works out what things cost.
///
/// Everything that touches coins goes through here, so there is exactly one
/// place where "how much is a voucher" is answered.
/// </summary>
public class EconomyService
{
    private readonly LoottaDbContext _db;

    public EconomyService(LoottaDbContext db) => _db = db;

    public async Task<EconomyConfig> GetAsync()
    {
        var config = await _db.EconomyConfigs.FirstOrDefaultAsync(c => c.Id == 1);

        if (config is null)
        {
            config = new EconomyConfig { Id = 1 };
            _db.EconomyConfigs.Add(config);
            await _db.SaveChangesAsync();
        }

        return config;
    }

    /// <summary>Coins earned by an order. Rounded down — no fractional coins.</summary>
    public static int CoinsForSpend(decimal amount, EconomyConfig config) =>
        (int)Math.Floor(amount * config.CoinsPerDollar);

    /// <summary>The voucher shop, generated from the configured exchange rate.</summary>
    public static VoucherTier[] VoucherTiers(EconomyConfig config) =>
        new[] { 1m, 2m, 5m }
            .Select(value => new VoucherTier(
                Key: $"v{value:0}",
                Value: value,
                CoinCost: (int)(value * config.CoinsPerVoucherDollar),
                MinSpend: value * config.VoucherMinSpendMultiplier))
            .ToArray();

    public static VoucherTier? FindTier(string key, EconomyConfig config) =>
        VoucherTiers(config).FirstOrDefault(t => t.Key.Equals(key, StringComparison.OrdinalIgnoreCase));

    /// <summary>Total items a customer has bought, cancelled orders excluded.</summary>
    public async Task<int> LifetimeItemsAsync(int userId) =>
        await _db.OrderItems
            .Where(i => i.Order!.UserId == userId && i.Order.Status != OrderStatus.Cancelled)
            .SumAsync(i => (int?)i.Quantity) ?? 0;

    public record VoucherTier(string Key, decimal Value, int CoinCost, decimal MinSpend);
}
