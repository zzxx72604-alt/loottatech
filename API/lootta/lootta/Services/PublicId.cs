namespace lootta.Services;

/// <summary>
/// Short public identifiers for share links.
///
/// Deliberately not sequential. A shared URL should not tell the recipient how
/// many products the shop has, or let them walk the catalogue by counting up.
/// </summary>
public static class PublicIdGenerator
{
    /// <summary>
    /// A customer account number, e.g. "UE8145".
    ///
    /// Two letters and four digits: short enough to read down a phone, long
    /// enough that guessing another customer's number is pointless.
    /// </summary>
    public static string NextUser()
    {
        const string letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";

        var a = letters[Random.Shared.Next(letters.Length)];
        var b = letters[Random.Shared.Next(letters.Length)];
        var digits = Random.Shared.Next(1000, 10000);

        return $"{a}{b}{digits}";
    }

    // No look-alike characters: someone will read one of these down a phone.
    private const string Alphabet = "abcdefghjkmnpqrstuvwxyz23456789";

    public static string Next(int length = 9)
    {
        var chars = new char[length];
        for (var i = 0; i < length; i++)
        {
            chars[i] = Alphabet[Random.Shared.Next(Alphabet.Length)];
        }
        return new string(chars);
    }
}
