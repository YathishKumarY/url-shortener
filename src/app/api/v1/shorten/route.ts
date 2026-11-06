import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { config } from "@/lib/config";
import { jsonError } from "@/lib/http";
import { createLink, LinkError, serializeLink } from "@/lib/links";
import {
  createLinkLimiter,
  enforceRateLimit,
  getClientIp,
  userWriteLimiter,
} from "@/lib/rate-limit";
import { createLinkSchema, firstZodError } from "@/lib/validators";

/**
 * One-call shortening for scripts and shells, in the spirit of is.gd's
 * create.php:
 *
 *   curl "https://linkly.app/api/v1/shorten?url=https://example.com&format=simple"
 *
 * `format=simple` (or `text`) returns just the short URL as plain text.
 * Works anonymously unless the instance disables it; send an API key to
 * create links on your account.
 */
async function shorten(request: Request, params: Record<string, string | undefined>) {
  const user = await getRequestUser(request);
  if (!user && config.anonymousLinksDisabled) return jsonError("An API key is required", 401);

  const limit = user
    ? await enforceRateLimit(userWriteLimiter, `user:${user.id}`)
    : await enforceRateLimit(createLinkLimiter, getClientIp(request));
  if (!limit.ok) return limit.response;

  const plain = params.format === "simple" || params.format === "text" || params.format === "txt";
  const fail = (message: string, status: number) =>
    plain
      ? new NextResponse(`Error: ${message}\n`, {
          status,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      : jsonError(message, status);

  const parsed = createLinkSchema.safeParse({
    url: params.url,
    customAlias: params.alias || params.customAlias || undefined,
    emoji: params.emoji === "1" || params.emoji === "true",
    expiresAt: params.expiresAt || undefined,
    maxClicks: params.maxClicks ? Number(params.maxClicks) : undefined,
    password: params.password || undefined,
  });
  if (!parsed.success) return fail(firstZodError(parsed.error), 400);

  try {
    const link = await createLink({ input: parsed.data, userId: user?.id ?? null, request });
    const body = serializeLink(link, request);
    if (plain) {
      return new NextResponse(`${body.shortUrl}\n`, {
        status: 201,
        headers: { "Content-Type": "text/plain; charset=utf-8", ...limit.headers },
      });
    }
    return NextResponse.json(body, { status: 201, headers: limit.headers });
  } catch (err) {
    if (err instanceof LinkError) return fail(err.message, err.status);
    console.error("[v1/shorten] failed:", err);
    return fail("Something went wrong", 500);
  }
}

export async function GET(request: Request) {
  return shorten(request, Object.fromEntries(new URL(request.url).searchParams));
}

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  let params: Record<string, string | undefined> = {};
  try {
    if (type.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      params = Object.fromEntries(
        Object.entries(body).map(([k, v]) => [
          k,
          v === undefined || v === null ? undefined : String(v),
        ]),
      );
    } else {
      const form = await request.formData();
      params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
    }
  } catch {
    return jsonError("Send JSON or form data", 400);
  }
  return shorten(request, { ...Object.fromEntries(new URL(request.url).searchParams), ...params });
}
