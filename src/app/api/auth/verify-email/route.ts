import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeEmailVerificationToken } from "@/lib/tokens";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    const email = await consumeEmailVerificationToken(token);
    if (!email) {
      return NextResponse.json(
        { error: "This link is invalid or has expired. Sign in to get a new one." },
        { status: 400 },
      );
    }

    await prisma.user.updateMany({
      where: { email: { equals: email, mode: "insensitive" }, emailVerified: null },
      data: { emailVerified: new Date() },
    });

    return NextResponse.json({ message: "Email verified. You can sign in now." });
  } catch (error) {
    console.error("[auth] Email verification failed:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
