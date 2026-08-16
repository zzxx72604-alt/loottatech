using System.ComponentModel.DataAnnotations;

namespace lootta.Dtos;

public class CategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    /// <summary>How many active products sit in this category.</summary>
    public int ProductCount { get; set; }
}

public class CategoryWriteDto
{
    [Required, MaxLength(60)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(60)]
    public string Slug { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}
