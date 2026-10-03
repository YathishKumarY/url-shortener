import { NextResponse } from "next/server";
import { buildShortUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { generateQRCode, QR_DEFAULT_WIDTH } from "@/lib/qr";

const MIN_WIDTH = 128;
const MAX_WIDTH = 2048;

function parseWidth(raw: string | null): number {
  if (!raw) return QR_DEFAULT_WIDTH;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return QR_DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(parsed)));
}

export async function GET(request: Request, ctx: RouteContext<"/api/qr/[shortCode]">) {
  const { shortCode } = await ctx.params;

  if (!shortCode || !/^[a-zA-Z0-9_-]+$/.test(shortCode)) {
    return NextResponse.json({ error: "Invalid short code format" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const width = parseWidth(searchParams.get("width"));
  const asDownload = searchParams.get("download") === "1";

  try {
    const link = await prisma.link.findUnique({
      where: { shortCode },
      select: { shortCode: true, updatedAt: true },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const shortUrl = buildShortUrl(link.shortCode, request);
    const qrBuffer = await generateQRCode(shortUrl, { width });

    const headers: Record<string, string> = {
      "Content-Type": "image/png",
      // Short max-age plus revalidation so a deleted or re-aliased link stops
      // serving a stale image almost immediately, while repeat views of the
      // dialog still hit the cache.
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      ETag: `"${link.shortCode}-${width}-${link.updatedAt.getTime()}"`,
    };

    if (asDownload) {
      headers["Content-Disposition"] = `attachment; filename="${link.shortCode}-qr.png"`;
    }

    return new NextResponse(new Uint8Array(qrBuffer), { headers });
  } catch (error) {
    console.error("[qr] Failed to generate QR code:", error);
    return NextResponse.json(
      { error: "Failed to generate QR code. Please try again." },
      { status: 500 },
    );
  }
}
