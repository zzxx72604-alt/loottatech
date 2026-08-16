namespace lootta.Models;

/// <summary>
/// How worn an item is.
///
/// Stored in SQL Server as text rather than a number, so the column is
/// readable in SSMS or DBeaver during the demo. `New` covers the brand-new
/// accessories LoottaTech also sells; everything else is second-hand.
/// </summary>
public enum ProductCondition
{
    New,
    LikeNew,
    Good,
    Fair
}
