import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { config } from "@/lib/config";

/**
 * Server-side fetches of user-supplied URLs (page metadata, webhooks) are an
 * SSRF vector: without a guard, anyone could make the server request
 * http://169.254.169.254/ (cloud credentials) or services on localhost.
 * Every hop - including each redirect - must resolve to a public address.
 *
 * Residual risk: fetch() performs its own DNS lookup after this check, so a
 * domain that flips its record between the two lookups (DNS rebinding) is not
 * caught. Closing that needs a custom dispatcher that pins the checked IP.
 */

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const PRIVATE_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, incl. broadcast
];

function isPrivateV4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return PRIVATE_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4ToInt(base) & mask);
  });
}

export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateV4(ip);
  if (version !== 6) return true; // not an IP at all: refuse rather than guess

  const lower = ip.toLowerCase();
  // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::a.b.c.d) embed a v4 address.
  const embedded = /(?:^::ffff:|^64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (embedded) return isPrivateV4(embedded[1]);
  // The URL parser serialises the embedded address in hex ([::ffff:127.0.0.1]
  // becomes [::ffff:7f00:1]), so the hex form must be decoded too.
  const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex) {
    const [high, low] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
    return isPrivateV4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }

  return (
    lower === "::" ||
    lower === "::1" ||
    /^f[cd][0-9a-f]{2}:/.test(lower) || // fc00::/7 unique local
    /^fe[89ab][0-9a-f]:/.test(lower) || // fe80::/10 link-local
    /^ff[0-9a-f]{2}:/.test(lower) || // multicast
    lower.startsWith("2001:db8:") // documentation
  );
}

export class UnsafeUrlError extends Error {}

/** Throws UnsafeUrlError unless the URL is http(s) and resolves to public IPs only. */
export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  const url = typeof raw === "string" ? new URL(raw) : raw;
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs can be fetched");
  }
  if (config.allowPrivateNetworkFetch) return url;

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new UnsafeUrlError("Refusing to fetch a local address");
  }

  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true, verbatim: true }).catch(() => {
        throw new UnsafeUrlError(`Could not resolve ${host}`);
      });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new UnsafeUrlError("Refusing to fetch a private or reserved address");
  }
  return url;
}

export interface SafeFetchOptions extends Omit<RequestInit, "redirect" | "signal"> {
  timeoutMs?: number;
  maxRedirects?: number;
  /** Stop reading the body after this many bytes. */
  maxBytes?: number;
}

export interface SafeFetchResult {
  status: number;
  headers: Headers;
  finalUrl: string;
  body: string;
}

/** Fetch with SSRF checks on every hop, a timeout, and a body size cap. */
export async function safeFetch(
  input: string,
  { timeoutMs = 5000, maxRedirects = 3, maxBytes = 512 * 1024, ...init }: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = await assertPublicUrl(input);

  for (let hop = 0; ; hop++) {
    const response = await fetch(current, { ...init, redirect: "manual", signal });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      if (hop >= maxRedirects) throw new UnsafeUrlError("Too many redirects");
      current = await assertPublicUrl(new URL(location, current));
      // A redirect never carries a request body forward.
      if (init.method && init.method !== "GET" && init.method !== "HEAD") {
        init = { ...init, method: "GET", body: undefined };
      }
      continue;
    }

    return {
      status: response.status,
      headers: response.headers,
      finalUrl: current.toString(),
      body: await readCapped(response, maxBytes),
    };
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (received >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
  return text + decoder.decode();
}
