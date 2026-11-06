import { headers } from "next/headers";
import { resolveRequestDomain } from "@/lib/domains";

/**
 * Server-only helpers for public pages that need to know which host the
 * visitor used. Pages see only the incoming headers, so they are wrapped in a
 * Request for the shared helpers that read Host and X-Forwarded-*.
 */

export async function incomingRequest(): Promise<Request> {
  return new Request("http://localhost", { headers: await headers() });
}

/** The incoming request and the link namespace it addresses ("" is the app's own domain). */
export async function requestNamespace(): Promise<{ request: Request; domain: string }> {
  const request = await incomingRequest();
  const { domain } = await resolveRequestDomain(request);
  return { request, domain };
}

/**
 * "host/code" for a notice page. The redirect handler always sends visitors
 * to a notice on the same host as the short link, so the Host header is the
 * short link's own domain (custom domains included).
 */
export async function noticeShortLink(code: string | null): Promise<string | null> {
  if (!code) return null;
  const all = await headers();
  const host = (all.get("x-forwarded-host") ?? all.get("host") ?? "").split(",")[0].trim();
  return host ? `${host}/${code}` : `/${code}`;
}
