import { createHmac, timingSafeEqual } from "crypto";

/**
 * Claim tokens let someone who shortened links anonymously attach them to an
 * account later (like spoo.me's claimable links). The token is an HMAC of the
 * link id under the server secret, handed only to the creator's browser, so a
 * known link id alone is not enough to take someone else's link.
 */

function secret(): string | null {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
}

export function createClaimToken(linkId: string): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(`claim:${linkId}`).digest("base64url").slice(0, 32);
}

export function verifyClaimToken(linkId: string, token: string): boolean {
  const expected = createClaimToken(linkId);
  if (!expected || typeof token !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
