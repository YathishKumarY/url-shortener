import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { authLimiter, getClientIp } from "@/lib/rate-limit";
import { registerSchema, formatZodErrors } from "@/lib/validators";
import { sendVerificationLink } from "@/lib/verification";

export async function POST(request: Request) {
  if (config.registrationDisabled) {
    return NextResponse.json(
      { error: "Registration is disabled on this instance" },
      { status: 403 },
    );
  }

  try {
    const { success } = await authLimiter.limit(`register:${getClientIp(request)}`);
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
    return NextResponse.json(
      { error: "Invalid request body. Please send valid JSON." },
      { status: 400 },
    );
  }

  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors = formatZodErrors(parsed.error);
    const firstFieldMessage = Object.values(fieldErrors).flat()[0];
    return NextResponse.json(
      { error: firstFieldMessage ?? "Invalid input", fieldErrors },
      { status: 400 },
    );
  }

  const { name, password } = parsed.data;
  // Store emails lower-cased so sign-in (which matches case-insensitively)
  // and duplicate detection agree.
  const email = parsed.data.email.toLowerCase();

  try {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    // A verified account, or one created through Google/GitHub (no password),
    // belongs to someone who has proved they own the address.
    if (existing && (existing.emailVerified || !existing.password || existing.bannedAt)) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead." },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    if (existing) {
      // Signing up again before verifying (lost email, typo in the password):
      // replace the pending details. Nobody could sign in to it yet, so it
      // holds no data, and the new link still only goes to the address owner.
      await prisma.user.update({
        where: { id: existing.id },
        data: { name, password: hashedPassword },
      });
    } else {
      await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: config.adminEmails.includes(email) ? "ADMIN" : "USER",
        },
      });
    }

    // The account cannot sign in until the emailed link is opened.
    const sent = await sendVerificationLink(email);
    return NextResponse.json(
      { verificationRequired: true, email, emailSent: sent !== "failed" },
      { status: 201 },
    );
  } catch (error) {
    console.error("[auth] Registration failed:", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
