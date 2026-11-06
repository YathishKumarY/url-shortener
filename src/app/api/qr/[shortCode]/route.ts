import { NextResponse } from "next/server";
import { buildShortUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import {
  generateQRCode,
  generateQRCodeSvg,
  parseHexColor,
  QR_DEFAULT_DARK,
  QR_DEFAULT_LIGHT,
  QR_DEFAULT_WIDTH,
  type QRErrorCorrection,
} from "@/lib/qr";

const MIN_WIDTH = 128;
const MAX_WIDTH = 2048;

function parseWidth(raw: string | null): number {
  if (!raw) return QR_DEFAULT_WIDTH;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return QR_DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(parsed)));
}

function decodeCode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * QR code for a short link.
 *
 * Query options: `size` (or `width`), `fg` / `bg` colours as hex, `ec`
 * (L|M|Q|H), `margin`, `format=svg|png`, `domain` for custom-domain links,
 * `download=1` to force a save, and `track=0` to omit the `?qr=1` marker that
 * lets analytics tell QR scans apart from clicks.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/qr/[shortCode]">) {
  const shortCode = decodeCode((await ctx.params).shortCode);
  if (!shortCode || Array.from(shortCode).length > 100) {
    return NextResponse.json({ error: "Invalid short code format" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const domain = (searchParams.get("domain") ?? "").trim().toLowerCase();
  const width = parseWidth(searchParams.get("size") ?? searchParams.get("width"));
  const dark = parseHexColor(searchParams.get("fg"), QR_DEFAULT_DARK);
  const light = parseHexColor(searchParams.get("bg"), QR_DEFAULT_LIGHT);
  const ecParam = (searchParams.get("ec") ?? "M").toUpperCase();
  const errorCorrectionLevel = (
    ["L", "M", "Q", "H"].includes(ecParam) ? ecParam : "M"
  ) as QRErrorCorrection;
  const marginParam = Number(searchParams.get("margin"));
  const margin =
    Number.isFinite(marginParam) && searchParams.has("margin")
      ? Math.min(16, Math.max(0, marginParam))
      : 4;
  const format = searchParams.get("format") === "svg" ? "svg" : "png";
  const asDownload = searchParams.get("download") === "1";
  const track = searchParams.get("track") !== "0";

  try {
    const link = await prisma.link.findUnique({
      where: { domain_shortCode: { domain, shortCode } },
      select: { shortCode: true, domain: true, updatedAt: true },
    });
    if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });

    const shortUrl = buildShortUrl(link.shortCode, { domain: link.domain || null, request });
    const content = track ? `${shortUrl}?qr=1` : shortUrl;
    const options = { width, dark, light, margin, errorCorrectionLevel };
    const etag = `"${link.updatedAt.getTime()}-${[width, dark, light, margin, errorCorrectionLevel, format, track].join("-")}"`;

    const headers: Record<string, string> = {
      // Short max-age plus revalidation so a deleted or re-aliased link stops
      // serving a stale image almost immediately.
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      ETag: etag,
    };
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers });
    }

    const filename = `${encodeURIComponent(link.shortCode)}-qr.${format}`;
    if (asDownload) headers["Content-Disposition"] = `attachment; filename="${filename}"`;

    if (format === "svg") {
      const svg = await generateQRCodeSvg(content, options);
      return new NextResponse(svg, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
    }
    const png = await generateQRCode(content, options);
    return new NextResponse(new Uint8Array(png), {
      headers: { ...headers, "Content-Type": "image/png" },
    });
  } catch (error) {
    console.error("[qr] Failed to generate QR code:", error);
    return NextResponse.json(
      { error: "Failed to generate QR code. Please try again." },
      { status: 500 },
    );
  }
}
