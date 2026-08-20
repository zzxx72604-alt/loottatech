using System.ComponentModel.DataAnnotations;

namespace lootta.Dtos;

public class QuickTagDto
{
    public int Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public string Query { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class QuickTagWriteDto
{
    [Required, MaxLength(40)]
    public string Label { get; set; } = string.Empty;

    /// <summary>Optional. Left blank, the label is searched instead.</summary>
    [MaxLength(80)]
    public string Query { get; set; } = string.Empty;

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class SiteTextDto
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;

    /// <summary>Plain English label so the admin knows what this controls.</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>What it reverts to, shown as a "reset" option.</summary>
    public string DefaultValue { get; set; } = string.Empty;
}

public class PaymentMethodSettingDto
{
    public string Method { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public int SortOrder { get; set; }
}

public class PaymentMethodSettingWriteDto
{
    [Required, MaxLength(40)]
    public string Method { get; set; } = string.Empty;

    public bool IsEnabled { get; set; }
    public int SortOrder { get; set; }
}
