using System.Security.Cryptography;
using System.Text;

namespace Onboarding;

public static class PasswordHasher
{
    public static byte[] Digest(string password, byte[] salt) => Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password), salt, 200_000, HashAlgorithmName.SHA256, 32);
}
