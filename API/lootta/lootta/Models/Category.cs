using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

/// <summary>
/// A product group shown in the customer sidebar, e.g. Phones, Laptops.
/// </summary>
public class Category
{
    public int Id { get; set; }

    [Required, MaxLength(60)]
    public string Name { get; set; } = string.Empty;

    /// <summary>URL-friendly version of the name, e.g. "phones".</summary>
    [Required, MaxLength(60)]
    public string Slug { get; set; } = string.Empty;

    /// <summary>Controls the order categories appear in the sidebar.</summary>
    public int SortOrder { get; set; }

    // One category has many products.
    public ICollection<Product> Products { get; set; } = new List<Product>();
}
