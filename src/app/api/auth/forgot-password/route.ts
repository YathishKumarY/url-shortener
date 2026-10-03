import { NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { authLimiter, getClientIp } from "@/lib/rate-limit";
import { generatePasswordResetToken } from "@/lib/tokens";

/** Identical response whether or not the address exists, to avoid disclosing accounts. */
const GENERIC_RESPONSE = { message: "If an account exists, a reset email has been sent" };

export async function POST(request: Request) {
  try {
    const { success } = await authLimiter.limit(`forgot:${getClientIp(request)}`);
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

  const { email } = body as { email?: string };
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const token = await generatePasswordResetToken(email);
    await sendPasswordResetEmail(email, token.token);

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error("[auth] Password reset request failed:", error);
    // Still generic: a failure here must not become an existence oracle.
    return NextResponse.json(GENERIC_RESPONSE);
  }
}
