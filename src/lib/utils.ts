import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract a hostname without throwing.
 *
 * `new URL(...)` in a render path is a crash risk: one malformed `originalUrl`
 * in the list (from a legacy row or a direct DB write) took down the entire
 * table, not just its own row. Returns null when the value cannot be parsed so
 * callers can skip the favicon instead.
 */
export function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

/** Favicon URL for a stored link, or null when the URL is unparseable. */
export function faviconUrl(url: string, size: 16 | 32 = 32): string | null {
  const hostname = safeHostname(url);
  if (!hostname) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${size}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}
