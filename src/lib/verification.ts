import { sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { generateEmailVerificationToken, verificationEmailRecentlySent } from "@/lib/tokens";

export type VerificationSendResult = "sent" | "cooldown" | "failed";

/**
 * Email a fresh verification link, at most once a minute per address so the
 * sign-up and "resend" forms cannot be used to flood someone's inbox.
 */
export async function sendVerificationLink(email: string): Promise<VerificationSendResult> {
  if (await verificationEmailRecentlySent(email)) return "cooldown";

  const token = await generateEmailVerificationToken(email);
  try {
    await sendVerificationEmail(email, token.token);
    return "sent";
  } catch (err) {
    console.error("[auth] Failed to send verification email:", err);
    // Drop the undelivered token so the cooldown does not block a retry.
    await prisma.emailVerificationToken
      .deleteMany({ where: { id: token.id } })
      .catch((cleanupErr) => console.error("[auth] Token cleanup failed:", cleanupErr));
    return "failed";
  }
}
