import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authLimiter, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const { success } = await authLimiter.limit(`reset:${getClientIp(request)}`);
    if (!success) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in a few minutes." },
        { status: 429 },
      );
    }
  } catch (err) {
    console.error("[auth] Rate limit check failed:", err);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { token, password } = body as { token?: string; password?: string };
  if (!token || !password) {
    return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  if (password.length > 100) {
    return NextResponse.json({ error: "Password must be under 100 characters" }, { status: 400 });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    /*
     * Claim the token and apply the new password in one transaction.
     *
     * The previous flow read the token, updated the user, then deleted the
     * token in three separate statements. Two requests replaying the same
     * token could both pass the read before either delete landed, so a token
     * was effectively reusable within that window. Deleting first and keying
     * off the reported row count makes the claim exclusive: only the request
     * whose delete actually removed the row goes on to change the password.
     */
    const email = await prisma.$transaction(async (tx) => {
      const record = await tx.passwordResetToken.findUnique({ where: { token } });
      if (!record || record.expires < new Date()) return null;

      const claimed = await tx.passwordResetToken.deleteMany({
        where: { id: record.id },
      });
      if (claimed.count === 0) return null;

      await tx.user.update({
        where: { email: record.email },
        data: { password: hashedPassword },
      });

      return record.email;
    });

    if (!email) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    // Any other outstanding reset links for this account are now void.
    await prisma.passwordResetToken.deleteMany({ where: { email } }).catch((err) => {
      console.error("[auth] Failed to clear stale reset tokens:", err);
    });

    return NextResponse.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("[auth] Password reset failed:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
