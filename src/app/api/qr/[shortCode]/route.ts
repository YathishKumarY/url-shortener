import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQRCode } from "@/lib/qr";

export async function GET(request: Request, ctx: RouteContext<"/api/qr/[shortCode]">) {
  const { shortCode } = await ctx.params;

  if (!shortCode || !/^[a-zA-Z0-9_-]+$/.test(shortCode)) {
    return NextResponse.json({ error: "Invalid short code format" }, { status: 400 });
  }

  try {
    const link = await prisma.link.findUnique({
      where: { shortCode },
      select: { shortCode: true },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const origin = new URL(request.url).origin;
    const shortUrl = `${origin}/${shortCode}`;
    const qrBuffer = await generateQRCode(shortUrl);

    return new NextResponse(new Uint8Array(qrBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate QR code. Please try again." },
      { status: 500 },
    );
  }
}
