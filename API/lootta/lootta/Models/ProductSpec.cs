using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

/// <summary>
/// One row of the specification table, e.g. ("RAM", "16 GB DDR4").
///
/// A child table rather than columns on Product, because electronics have
/// wildly different specs — a phone has battery health, a laptop has a CPU.
/// Fixed columns would be mostly NULL.
/// </summary>
public class ProductSpec
{
    public int Id { get; set; }

    public int ProductId { get; set; }
    public Product? Product { get; set; }

    [Required, MaxLength(60)]
    public string Key { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string Value { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}
