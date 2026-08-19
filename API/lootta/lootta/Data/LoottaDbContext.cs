using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using lootta.Models;

namespace lootta.Data;

/// <summary>
/// The single place the API talks to SQL Server.
/// Angular never touches the database — it only ever calls this API.
/// </summary>
public class LoottaDbContext : DbContext
{
    public LoottaDbContext(DbContextOptions<LoottaDbContext> options) : base(options) { }

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<ProductSpec> ProductSpecs => Set<ProductSpec>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Voucher> Vouchers => Set<Voucher>();
    public DbSet<GameSession> GameSessions => Set<GameSession>();
    public DbSet<EconomyConfig> EconomyConfigs => Set<EconomyConfig>();
    public DbSet<RedeemCode> RedeemCodes => Set<RedeemCode>();
    public DbSet<RedeemCodeUse> RedeemCodeUses => Set<RedeemCodeUse>();
    public DbSet<ProductInteraction> ProductInteractions => Set<ProductInteraction>();
    public DbSet<Review> Reviews => Set<Review>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        /*
         * SQLite has no decimal type.
         *
         * EF Core stores decimals as text there, which means SUM() on a money
         * column fails outright — which is exactly what the admin dashboard
         * does. Mapping decimal to double lets the aggregates work.
         *
         * The trade-off is real and worth stating: double is floating point,
         * so it can drift by fractions of a cent. That is acceptable for the
         * zero-install demo database and NOT for the real one, which is why
         * SQL Server keeps proper decimal(18,2).
         */
        if (Database.IsSqlite())
        {
            var toDouble = new ValueConverter<decimal, double>(
                value => (double)value,
                value => (decimal)value);

            var toNullableDouble = new ValueConverter<decimal?, double?>(
                value => value == null ? null : (double)value.Value,
                value => value == null ? null : (decimal)value.Value);

            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entityType.GetProperties())
                {
                    if (property.ClrType == typeof(decimal))
                        property.SetValueConverter(toDouble);
                    else if (property.ClrType == typeof(decimal?))
                        property.SetValueConverter(toNullableDouble);
                }
            }
        }

        // ---------------------------------------------------------- Category
        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasIndex(c => c.Slug).IsUnique();

            entity.HasMany(c => c.Products)
                  .WithOne(p => p.Category)
                  .HasForeignKey(p => p.CategoryId)
                  // Block deleting a category that still holds products,
                  // instead of silently deleting the products with it.
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ----------------------------------------------------------- Product
        modelBuilder.Entity<Product>(entity =>
        {
            // Money must never be a float. decimal(18,2) keeps cents exact.
            entity.Property(p => p.Price).HasPrecision(18, 2);
            entity.Property(p => p.OriginalPrice).HasPrecision(18, 2);

            // Store the enum as readable text, so the column makes sense
            // when you open the table in SSMS or DBeaver.
            entity.Property(p => p.Condition)
                  .HasConversion<string>()
                  .HasMaxLength(20);

            entity.HasIndex(p => p.PublicId).IsUnique();
            entity.HasIndex(p => p.Title);
            entity.HasIndex(p => p.IsActive);

            // Deleting a product SHOULD remove its photos and specs —
            // they have no meaning on their own.
            entity.HasMany(p => p.Images)
                  .WithOne(i => i.Product)
                  .HasForeignKey(i => i.ProductId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(p => p.Specs)
                  .WithOne(s => s.Product)
                  .HasForeignKey(s => s.ProductId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ------------------------------------------------------------- Order
        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasIndex(o => o.OrderNumber).IsUnique();
            entity.HasIndex(o => o.Status);

            entity.Property(o => o.Subtotal).HasPrecision(18, 2);
            entity.Property(o => o.DeliveryFee).HasPrecision(18, 2);
            entity.Property(o => o.Discount).HasPrecision(18, 2);
            entity.Property(o => o.Total).HasPrecision(18, 2);

            entity.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);
            entity.Property(o => o.DeliveryOption).HasConversion<string>().HasMaxLength(20);

            // Deleting an order removes its lines — they mean nothing alone.
            entity.HasMany(o => o.Items)
                  .WithOne(i => i.Order)
                  .HasForeignKey(i => i.OrderId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.Property(i => i.UnitPrice).HasPrecision(18, 2);

            // LineTotal is computed in C#; it is not a database column.
            entity.Ignore(i => i.LineTotal);

            // If the admin deletes a product, the order line survives with its
            // snapshot and simply loses the link. Order history is never lost.
            entity.HasOne(i => i.Product)
                  .WithMany()
                  .HasForeignKey(i => i.ProductId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // -------------------------------------------------------------- User
        modelBuilder.Entity<User>(entity =>
        {
            // One account per email address, enforced by the database itself.
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);

            entity.HasMany(u => u.Vouchers)
                  .WithOne(v => v.User)
                  .HasForeignKey(v => v.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ----------------------------------------------------------- Voucher
        modelBuilder.Entity<Voucher>(entity =>
        {
            entity.HasIndex(v => v.Code).IsUnique();
            entity.Property(v => v.Type).HasConversion<string>().HasMaxLength(20);
            entity.Property(v => v.Value).HasPrecision(18, 2);
            entity.Property(v => v.MinSpend).HasPrecision(18, 2);
            entity.Property(v => v.MaxDiscount).HasPrecision(18, 2);

            // Computed in C#, not stored as columns.
            entity.Ignore(v => v.IsSpent);
            entity.Ignore(v => v.IsExpired);
            entity.Ignore(v => v.IsUsable);
        });

        // ------------------------------------------------------- GameSession
        modelBuilder.Entity<GameSession>(entity =>
        {
            entity.HasIndex(g => g.Token).IsUnique();
            entity.Ignore(g => g.IsFinished);

            entity.HasOne(g => g.User)
                  .WithMany()
                  .HasForeignKey(g => g.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ------------------------------------------------------ EconomyConfig
        modelBuilder.Entity<EconomyConfig>(entity =>
        {
            // Tiers() and friends are methods, so EF ignores them automatically —
            // only the stored numbers become columns.
            //
            // Ship the defaults so the shop works the moment it starts.
            entity.HasData(new EconomyConfig { Id = 1, UpdatedAt = new DateTime(2026, 1, 1) });
        });

        // --------------------------------------------------------- RedeemCode
        modelBuilder.Entity<RedeemCode>(entity =>
        {
            entity.HasIndex(c => c.Code).IsUnique();
            entity.Ignore(c => c.IsExpired);
            entity.Ignore(c => c.IsExhausted);
            entity.Ignore(c => c.IsUsable);

            entity.HasMany(c => c.Uses)
                  .WithOne(u => u.RedeemCode)
                  .HasForeignKey(u => u.RedeemCodeId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RedeemCodeUse>(entity =>
        {
            // One redemption per account per code, enforced by the database
            // rather than by hoping the check in C# always runs first.
            entity.HasIndex(u => new { u.RedeemCodeId, u.UserId }).IsUnique();

            entity.HasOne(u => u.User)
                  .WithMany()
                  .HasForeignKey(u => u.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ------------------------------------------------- ProductInteraction
        modelBuilder.Entity<ProductInteraction>(entity =>
        {
            // One row per customer per product, enforced by the database so a
            // double-click can never create two conflicting rows.
            entity.HasIndex(i => new { i.UserId, i.ProductId }).IsUnique();

            // Answering "what has this customer saved" without scanning.
            entity.HasIndex(i => new { i.UserId, i.Saved });
            entity.HasIndex(i => new { i.ProductId, i.Liked });

            entity.HasOne(i => i.User)
                  .WithMany()
                  .HasForeignKey(i => i.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(i => i.Product)
                  .WithMany()
                  .HasForeignKey(i => i.ProductId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ------------------------------------------------------------- Review
        modelBuilder.Entity<Review>(entity =>
        {
            // One review per customer per product. Enforced by the database so
            // nobody can inflate a score by posting five times.
            entity.HasIndex(r => new { r.ProductId, r.UserId }).IsUnique();

            // The product page reads by product and hides moderated rows.
            entity.HasIndex(r => new { r.ProductId, r.IsHidden });

            entity.HasOne(r => r.Product)
                  .WithMany(p => p.Reviews)
                  .HasForeignKey(r => r.ProductId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.User)
                  .WithMany()
                  .HasForeignKey(r => r.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ------------------------------------------------- seed: categories
        modelBuilder.Entity<Category>().HasData(
            new Category { Id = 1, Name = "Phones",      Slug = "phones",      SortOrder = 1 },
            new Category { Id = 2, Name = "Laptops",     Slug = "laptops",     SortOrder = 2 },
            new Category { Id = 3, Name = "Tablets",     Slug = "tablets",     SortOrder = 3 },
            new Category { Id = 4, Name = "Monitors",    Slug = "monitors",    SortOrder = 4 },
            new Category { Id = 5, Name = "Printers",    Slug = "printers",    SortOrder = 5 },
            new Category { Id = 6, Name = "PC Parts",    Slug = "pc-parts",    SortOrder = 6 },
            new Category { Id = 7, Name = "Wearables",   Slug = "wearables",   SortOrder = 7 },
            new Category { Id = 8, Name = "Gaming",      Slug = "gaming",      SortOrder = 8 },
            new Category { Id = 9, Name = "Accessories", Slug = "accessories", SortOrder = 9 }
        );
    }
}
