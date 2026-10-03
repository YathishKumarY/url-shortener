import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { authLimiter, getClientIp } from "@/lib/rate-limit";
import { generateEmailVerificationToken } from "@/lib/tokens";
import { registerSchema, formatZodErrors } from "@/lib/validators";

export async function POST(request: Request) {
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

  const { name, email, password } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    try {
      const token = await generateEmailVerificationToken(email);
      await sendVerificationEmail(email, token.token);
    } catch (err) {
      console.error("[auth] Failed to send verification email:", err);
    }

    return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
  } catch (error) {
    console.error("[auth] Registration failed:", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
