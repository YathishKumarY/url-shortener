import { NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { generatePasswordResetToken } from "@/lib/tokens";

export async function POST(request: Request) {
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
      return NextResponse.json({ message: "If an account exists, a reset email has been sent" });
    }

    const token = await generatePasswordResetToken(email);
    await sendPasswordResetEmail(email, token.token);

    return NextResponse.json({ message: "If an account exists, a reset email has been sent" });
  } catch (error) {
    console.error("[auth] Password reset request failed:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
