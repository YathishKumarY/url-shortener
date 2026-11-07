/**
 * Whether an OAuth provider vouches that the user owns the email it returned.
 *
 * Linkly matches OAuth sign-ins to accounts by email, so an unverified
 * provider address would let someone add a victim's address to their own
 * GitHub account, or sign up at Google with it, and walk into the victim's
 * Linkly account.
 */
export async function oauthEmailVerified(
  provider: string,
  email: string,
  profile: Record<string, unknown> | undefined,
  accessToken: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  switch (provider) {
    case "google":
      return profile?.email_verified === true;
    case "github":
      return accessToken ? githubEmailVerified(email, accessToken, fetchImpl) : false;
    case "oidc":
      // Company identity providers often omit the claim; their directory is
      // the source of truth. Refuse only an explicit "not verified".
      return profile?.email_verified !== false && profile?.email_verified !== "false";
    default:
      return false;
  }
}

/** GitHub only reports verification on the emails endpoint, not the profile. */
async function githubEmailVerified(
  email: string,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "linkly",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const emails = (await res.json()) as { email?: string; verified?: boolean }[];
    const wanted = email.toLowerCase();
    return (
      Array.isArray(emails) &&
      emails.some((entry) => entry.verified === true && entry.email?.toLowerCase() === wanted)
    );
  } catch (err) {
    console.error("[auth] GitHub email check failed:", err);
    return false;
  }
}
