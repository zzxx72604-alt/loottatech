using System.ComponentModel.DataAnnotations;

namespace lootta.Models;

/// <summary>
/// One shortcut in the tag row under the search box, e.g. "iPhone".
///
/// These used to be a hardcoded array in the Angular header, which meant
/// changing a shortcut required editing and rebuilding the customer site.
/// As rows in the database the shop owner edits them from the admin site and
/// the change is live on the next page load.
/// </summary>
public class QuickTag
{
    public int Id { get; set; }

    /// <summary>What the customer sees, e.g. "Under $100".</summary>
    [Required, MaxLength(40)]
    public string Label { get; set; } = string.Empty;

    /// <summary>
    /// What gets searched when it is clicked.
    ///
    /// Kept separate from the label so a friendly word can run a different
    /// search — "Bargains" can look for "under 100" without saying so.
    /// </summary>
    [Required, MaxLength(80)]
    public string Query { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    /// <summary>Hidden rather than deleted, so it can come back later.</summary>
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// A piece of wording on the customer site, stored as a key and a value.
///
/// A key/value table rather than a column per text: adding a new editable
/// heading later is one row, not a migration. The trade is that nothing here
/// is type-checked, so the keys are listed in <see cref="SiteTextKeys"/>
/// instead of being typed by hand at each use.
/// </summary>
public class SiteText
{
    [Key, MaxLength(60)]
    public string Key { get; set; } = string.Empty;

    [MaxLength(400)]
    public string Value { get; set; } = string.Empty;

    /// <summary>Shown to the admin so they know what they are editing.</summary>
    [MaxLength(120)]
    public string Description { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}

/// <summary>The wording the shop can change, with sensible defaults.</summary>
public static class SiteTextKeys
{
    public record Entry(string Key, string Default, string Description, int SortOrder);

    public static readonly Entry[] All =
    {
        new("shop.name",       "LoottaTech",
            "Shop name in the header", 1),

        new("hero.headline",   "Second-hand tech, honestly described",
            "Big heading on the home page", 2),

        new("hero.subtitle",   "Every item tested, photographed and graded before it is listed.",
            "Line under the home page heading", 3),

        new("hero.cta",        "Browse the shop",
            "Button on the home page banner", 4),

        new("trust.one",       "Tested before listing",
            "First trust badge", 5),

        new("trust.two",       "Photos of every flaw",
            "Second trust badge", 6),

        new("trust.three",     "Warranty on most items",
            "Third trust badge", 7),

        new("footer.note",     "A student project by LoottaTech. Prices are demonstration data.",
            "Small print in the footer", 8),
    };
}

/// <summary>
/// Whether a payment option is offered at checkout.
///
/// The list of possible methods stays in the <see cref="PaymentMethod"/> enum
/// because each one needs code to settle it one day. What the shop controls is
/// which of them are switched on, so this table holds a row per method rather
/// than the methods themselves.
/// </summary>
public class PaymentMethodSetting
{
    [Key, MaxLength(40)]
    public string Method { get; set; } = string.Empty;

    public bool IsEnabled { get; set; } = true;

    public int SortOrder { get; set; }
}
