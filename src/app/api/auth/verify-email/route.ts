import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyEmailToken } from "@/lib/tokens";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    const record = await verifyEmailToken(token);
    if (!record) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    await prisma.user.update({
      where: { email: record.email },
      data: { emailVerified: new Date() },
    });

    await prisma.emailVerificationToken.delete({ where: { id: record.id } });

    return NextResponse.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("[auth] Email verification failed:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
