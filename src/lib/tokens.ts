import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
/** Minimum gap between verification emails to one address. */
export const EMAIL_VERIFICATION_COOLDOWN_MS = 60 * 1000;

export async function generateEmailVerificationToken(email: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  await prisma.emailVerificationToken.deleteMany({ where: { email } });

  return prisma.emailVerificationToken.create({
    data: { email, token, expires },
  });
}

/**
 * True when a verification email went to this address in the last minute.
 * Tokens carry no creation time, but every token lives exactly 24 hours, so
 * an expiry later than now + 24h - 1min means it was issued within a minute.
 */
export async function verificationEmailRecentlySent(email: string): Promise<boolean> {
  const recent = await prisma.emailVerificationToken.findFirst({
    where: {
      email,
      expires: {
        gt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS - EMAIL_VERIFICATION_COOLDOWN_MS),
      },
    },
    select: { id: true },
  });
  return recent !== null;
}

/**
 * Use up a verification token and return the address it proves, or null when
 * the token is unknown, expired or was claimed by a concurrent request. The
 * delete's row count makes the claim exclusive, as for password resets.
 */
export async function consumeEmailVerificationToken(token: string): Promise<string | null> {
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record) return null;
  const claimed = await prisma.emailVerificationToken.deleteMany({ where: { id: record.id } });
  if (claimed.count === 0 || record.expires < new Date()) return null;
  return record.email;
}

export async function generatePasswordResetToken(email: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({ where: { email } });

  return prisma.passwordResetToken.create({
    data: { email, token, expires },
  });
}

/**
 * Look up a password reset token without consuming it.
 *
 * Not used by the reset route: a read here followed by a separate delete let
 * two concurrent requests both pass validation with the same token, so that
 * route claims the row atomically instead. Kept for read-only checks (for
 * example, deciding whether to show the reset form) - do not use it to gate a
 * password change.
 */
export async function verifyPasswordResetToken(token: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) return null;
  return record;
}
