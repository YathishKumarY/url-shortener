import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { jsonError } from "@/lib/http";
import { fetchPageMetadata } from "@/lib/metadata";
import { enforceRateLimit, metadataLimiter } from "@/lib/rate-limit";

/** Title, description, preview image and favicon of a page, for the link builder. */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const limit = await enforceRateLimit(metadataLimiter, `meta:${auth.user.id}`);
  if (!limit.ok) return limit.response;

  const url = new URL(request.url).searchParams.get("url");
  if (!url) return jsonError("Missing url", 400);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
  } catch {
    return jsonError("Invalid url", 400);
  }

  const metadata = await fetchPageMetadata(url);
  return NextResponse.json(metadata, { headers: { "Cache-Control": "private, max-age=300" } });
}
