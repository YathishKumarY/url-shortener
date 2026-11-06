import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { config } from "@/lib/config";
import { parseCsvRecords } from "@/lib/csv";
import { jsonError } from "@/lib/http";
import { createLink, LinkError, serializeLink, type BulkResult } from "@/lib/links";
import { enforceRateLimit, userWriteLimiter } from "@/lib/rate-limit";
import { createLinkSchema, firstZodError } from "@/lib/validators";

const URL_COLUMNS = [
  "url",
  "originalurl",
  "original_url",
  "long_url",
  "longurl",
  "destination",
  "target",
];
const ALIAS_COLUMNS = [
  "alias",
  "customalias",
  "custom_alias",
  "slug",
  "key",
  "shortcode",
  "short_code",
  "back-half",
];

function pick(record: Record<string, string>, names: string[]): string {
  for (const name of names) if (record[name]) return record[name];
  return "";
}

/**
 * Import links from CSV. Column names are matched loosely so exports from
 * Bitly, Dub, Short.io or our own CSV export import without editing.
 * Accepts a raw text/csv body or JSON `{ "csv": "..." }`.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const limit = await enforceRateLimit(userWriteLimiter, `user:${auth.user.id}`);
  if (!limit.ok) return limit.response;

  let text = "";
  try {
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const body = (await request.json()) as { csv?: unknown };
      text = typeof body.csv === "string" ? body.csv : "";
    } else {
      text = await request.text();
    }
  } catch {
    return jsonError("Could not read the uploaded file", 400);
  }

  const records = parseCsvRecords(text);
  if (records.length === 0)
    return jsonError("No rows found. Include a header row with a 'url' column.", 400);
  if (records.length > config.bulkLimit) {
    return jsonError(`At most ${config.bulkLimit} rows per import`, 400);
  }

  const results: BulkResult[] = [];
  for (const [index, record] of records.entries()) {
    const tags = (record.tags ?? "")
      .split(/[|;]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const expiresAt = record.expiresat || record.expires_at || undefined;
    const input = createLinkSchema.safeParse({
      url: pick(record, URL_COLUMNS),
      customAlias: pick(record, ALIAS_COLUMNS) || undefined,
      title: record.title || undefined,
      description: record.description || record.notes || undefined,
      tags,
      expiresAt:
        expiresAt && !Number.isNaN(Date.parse(expiresAt))
          ? new Date(expiresAt).toISOString()
          : undefined,
    });
    if (!input.success) {
      results.push({ index, ok: false, error: firstZodError(input.error) });
      continue;
    }
    try {
      const link = await createLink({ input: input.data, userId: auth.user.id, request });
      results.push({ index, ok: true, link: serializeLink(link, request) });
    } catch (err) {
      results.push({
        index,
        ok: false,
        error: err instanceof LinkError ? err.message : "Failed to create link",
      });
    }
  }

  const created = results.filter((r) => r.ok).length;
  return NextResponse.json({ created, failed: results.length - created, results });
}
