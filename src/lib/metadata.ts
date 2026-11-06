import { safeFetch } from "@/lib/safe-fetch";

export interface PageMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
  siteName: string | null;
}

const EMPTY: PageMetadata = {
  title: null,
  description: null,
  image: null,
  favicon: null,
  siteName: null,
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) return safeCodePoint(parseInt(lower.slice(2), 16)) ?? match;
    if (lower.startsWith("#")) return safeCodePoint(parseInt(lower.slice(1), 10)) ?? match;
    return ENTITIES[lower] ?? match;
  });
}

function safeCodePoint(code: number): string | null {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : null;
}

function clean(value: string | undefined | null, max: number): string | null {
  if (!value) return null;
  const text = decodeEntities(value).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function absolutize(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(decodeEntities(value.trim()), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Attributes of a single tag, e.g. `<meta property="og:title" content="x">`. */
function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag))) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

/**
 * Extract title, description, preview image and favicon from an HTML
 * document. Regex-based on purpose: only the <head> matters, and a full DOM
 * parser would be a heavy dependency for a handful of tags.
 */
export function parseHtmlMetadata(html: string, baseUrl: string): PageMetadata {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd === -1 ? html.slice(0, 200_000) : html.slice(0, headEnd);

  const meta: Record<string, string> = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    const key = (attrs.property ?? attrs.name ?? attrs.itemprop ?? "").toLowerCase();
    // Blank values are skipped so an empty og: tag cannot shadow its fallbacks.
    if (key && attrs.content?.trim() && !(key in meta)) meta[key] = attrs.content;
  }

  let favicon: string | null = null;
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    const rel = (attrs.rel ?? "").toLowerCase().split(/\s+/);
    if (attrs.href && (rel.includes("icon") || rel.includes("apple-touch-icon"))) {
      favicon = attrs.href;
      if (rel.includes("icon")) break;
    }
  }

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];

  return {
    title: clean(meta["og:title"] ?? meta["twitter:title"] ?? titleTag, 200),
    description: clean(
      meta["og:description"] ?? meta["twitter:description"] ?? meta.description,
      500,
    ),
    image: absolutize(
      meta["og:image"] ?? meta["og:image:url"] ?? meta["twitter:image"] ?? null,
      baseUrl,
    ),
    favicon: absolutize(favicon ?? "/favicon.ico", baseUrl),
    siteName: clean(meta["og:site_name"], 100),
  };
}

/** Fetch a page and read its metadata. Never throws; returns nulls on failure. */
export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  try {
    const result = await safeFetch(url, {
      headers: {
        // Many sites only serve OG tags to recognisable crawlers.
        "User-Agent": "Mozilla/5.0 (compatible; LinklyBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      timeoutMs: 5000,
      maxBytes: 512 * 1024,
    });
    const type = result.headers.get("content-type") ?? "";
    if (result.status >= 400 || !/html|xml/i.test(type)) return EMPTY;
    return parseHtmlMetadata(result.body, result.finalUrl);
  } catch {
    return EMPTY;
  }
}
