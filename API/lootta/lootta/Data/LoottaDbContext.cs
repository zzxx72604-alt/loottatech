using Microsoft.EntityFrameworkCore;
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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

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
