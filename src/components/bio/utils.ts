import { hostnameOf } from "@/lib/format";
import { safeHostname } from "@/lib/utils";

/** Mirrors the server's handle rule (the slug is lower-cased before it is checked). */
export const HANDLE_PATTERN = /^[a-z0-9_.-]{3,30}$/;
export const HANDLE_MAX = 30;
export const DISPLAY_NAME_MAX = 60;
export const BIO_MAX = 300;
/** The API keeps at most this many featured links. */
export const FEATURED_MAX = 50;

/** An http(s) URL that is safe to use as an image source, or null. */
export function safeImageUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** One or two letters for an avatar placeholder. */
export function initialsFor(value: string | null | undefined): string {
  const words = (value ?? "")
    .replace(/^@/, "")
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return picked
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}

/** What a link button shows: the owner's title, else the destination's hostname. */
export function bioLinkTitle(link: { title: string | null; originalUrl: string }): string {
  return link.title?.trim() || hostnameOf(link.originalUrl);
}

/** A crisp (64px) favicon for a destination URL, or null when unparseable. */
export function faviconSrc(url: string): string | null {
  const hostname = safeHostname(url);
  return hostname
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`
    : null;
}
