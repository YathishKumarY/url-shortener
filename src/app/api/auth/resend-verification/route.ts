import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authLimiter, getClientIp } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validators";
import { sendVerificationLink } from "@/lib/verification";

/** Same answer whether or not the address has an account, so this is no account oracle. */
const GENERIC_RESPONSE = {
  message: "If that address has an account waiting for verification, a new link is on its way.",
};

const resendSchema = registerSchema.pick({ email: true });

/** Send another verification link to an account that has not been verified yet. */
export async function POST(request: Request) {
  try {
    const { success } = await authLimiter.limit(`resend:${getClientIp(request)}`);
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

  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { email: true, emailVerified: true, password: true, bannedAt: true },
    });
    if (user?.email && user.password && !user.emailVerified && !user.bannedAt) {
      // A delivery failure is logged inside, and not reported here: a
      // different answer for existing accounts would reveal who has one.
      await sendVerificationLink(user.email);
    }
  } catch (error) {
    console.error("[auth] Resend verification failed:", error);
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
