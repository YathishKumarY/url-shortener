import {
  AtSign,
  Briefcase,
  Camera,
  CodeXml,
  Globe,
  Mail,
  Music2,
  SquarePlay,
  type LucideIcon,
} from "lucide-react";

/**
 * Social profiles a bio page can show, in display order.
 *
 * Owners may type a bare username ("@jane") or paste a full link; both are
 * stored as typed and resolved to a URL at render time. lucide-react ships no
 * brand marks, so each platform uses a recognisable generic glyph and always
 * carries an accessible label.
 */

export const SOCIAL_KEYS = [
  "website",
  "x",
  "github",
  "linkedin",
  "instagram",
  "youtube",
  "tiktok",
  "email",
] as const;

export type SocialKey = (typeof SOCIAL_KEYS)[number];

export type BioSocials = Partial<Record<SocialKey, string>>;

export interface SocialPlatform {
  key: SocialKey;
  label: string;
  icon: LucideIcon;
  placeholder: string;
  /** What a bare username looks like on the platform. */
  handle?: RegExp;
  /** Profile URL for a bare username. */
  profile?: (handle: string) => string;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: "website", label: "Website", icon: Globe, placeholder: "https://janedoe.com" },
  {
    key: "x",
    label: "X (Twitter)",
    icon: AtSign,
    placeholder: "@janedoe",
    handle: /^[A-Za-z0-9_]{1,15}$/,
    profile: (h) => `https://x.com/${h}`,
  },
  {
    key: "github",
    label: "GitHub",
    icon: CodeXml,
    placeholder: "janedoe",
    handle: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/,
    profile: (h) => `https://github.com/${h}`,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: Briefcase,
    placeholder: "linkedin.com/in/janedoe",
    handle: /^[A-Za-z0-9_-]{3,100}$/,
    profile: (h) => `https://www.linkedin.com/in/${h}`,
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: Camera,
    placeholder: "@janedoe",
    handle: /^[A-Za-z0-9._]{1,30}$/,
    profile: (h) => `https://www.instagram.com/${h}`,
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: SquarePlay,
    placeholder: "@janedoe",
    handle: /^[A-Za-z0-9._-]{3,30}$/,
    profile: (h) => `https://www.youtube.com/@${h}`,
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: Music2,
    placeholder: "@janedoe",
    handle: /^[A-Za-z0-9._]{2,24}$/,
    profile: (h) => `https://www.tiktok.com/@${h}`,
  },
  { key: "email", label: "Email", icon: Mail, placeholder: "jane@example.com" },
];

const PLATFORMS = new Map(SOCIAL_PLATFORMS.map((p) => [p.key, p]));

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
/** "janedoe.com", "github.com/jane", "linkedin.com/in/jane?x=1" */
const DOMAIN_LIKE = /^[^\s/@:]+\.[a-z]{2,}(?:[/?#]\S*)?$/i;
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

function httpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * The link for a social value, or null when it cannot be resolved safely.
 *
 * Values are stored unvalidated, so this is also the XSS guard: only http(s)
 * links (and mailto: for email) are ever produced, never `javascript:`.
 */
export function socialHref(key: SocialKey, raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;

  if (key === "email") {
    const address = value.replace(/^mailto:/i, "");
    return EMAIL.test(address) ? `mailto:${address}` : null;
  }

  if (HAS_SCHEME.test(value)) return httpUrl(value);

  const platform = PLATFORMS.get(key);
  const handle = value.replace(/^@/, "");
  if (platform?.handle?.test(handle) && platform.profile) return platform.profile(handle);
  if (DOMAIN_LIKE.test(value)) return httpUrl(`https://${value}`);
  return null;
}

/** Human-friendly form of a resolved social link, e.g. "github.com/jane". */
export function displaySocialHref(href: string): string {
  return href
    .replace(/^mailto:/i, "")
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/$/, "");
}

/** Keep only known keys with string values (the column is untyped JSON). */
export function parseSocials(value: unknown): BioSocials {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: BioSocials = {};
  for (const key of SOCIAL_KEYS) {
    const entry = (value as Record<string, unknown>)[key];
    if (typeof entry === "string" && entry.trim()) result[key] = entry.trim();
  }
  return result;
}
