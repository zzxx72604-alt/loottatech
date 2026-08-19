namespace lootta.Services;

/// <summary>
/// Short public identifiers for share links.
///
/// Deliberately not sequential. A shared URL should not tell the recipient how
/// many products the shop has, or let them walk the catalogue by counting up.
/// </summary>
public static class PublicIdGenerator
{
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
