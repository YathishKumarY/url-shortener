import { z } from "zod";

/**
 * Paths that must never be claimable as a short code.
 *
 * A short code lives at the root (`/<code>`), so anything here would either be
 * shadowed by a real route - making the link permanently dead - or shadow one
 * of the app's own pages. Compared lower-case because lookups are effectively
 * case-insensitive at the route level.
 */
export const RESERVED_SHORT_CODES = new Set([
  "api",
  "auth",
  "dashboard",
  "admin",
  "docs",
  "bio",
  "preview",
  "unlock",
  "stats",
  "share",
  "link-expired",
  "link-missing",
  "link-scheduled",
  "link-disabled",
  "link-blocked",
  "not-found",
  "_next",
  "favicon.ico",
  "icon.svg",
  "apple-icon.svg",
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "login",
  "logout",
  "signin",
  "signup",
  "register",
  "settings",
  "about",
  "pricing",
  "terms",
  "privacy",
  "support",
  "help",
  "static",
  "public",
  "assets",
  "new",
  "edit",
  "qr",
]);

export function isReservedShortCode(code: string): boolean {
  return RESERVED_SHORT_CODES.has(code.trim().toLowerCase());
}

/**
 * Letters and digits in any script, combining marks, emoji, hyphen and
 * underscore. Emoji components are listed explicitly instead of using
 * \p{Emoji_Component}, which would also admit "#" and "*" - and "#" starts a
 * URL fragment, so such a link could never resolve.
 */
const ALIAS_CHARS =
  /^[\p{L}\p{M}\p{N}\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200D\uFE0F\u20E3_-]+$/u;
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;

export const ALIAS_MAX_LENGTH = 50;

/**
 * Homoglyph guard: an alias may use any alphabet, but only one. Mixing scripts
 * is how look-alikes are built - "аpple" with a Cyrillic "а" reads as "apple"
 * but is a different link.
 */
export function isSingleScript(value: string): boolean {
  const scripts = new Set<string>();
  for (const char of value) {
    if (!/\p{L}/u.test(char)) continue;
    if (/\p{Script=Latin}/u.test(char)) scripts.add("Latin");
    else if (/\p{Script=Cyrillic}/u.test(char)) scripts.add("Cyrillic");
    else if (/\p{Script=Greek}/u.test(char)) scripts.add("Greek");
    else if (/\p{Script=Armenian}/u.test(char)) scripts.add("Armenian");
    else scripts.add("Other");
    if (scripts.size > 1) return false;
  }
  return true;
}

const customAliasSchema = z
  .string()
  .trim()
  .regex(ALIAS_CHARS, "Only letters, numbers, emoji, hyphens, and underscores allowed")
  .refine(
    // Emoji aliases may be a single glyph; text aliases need 3 characters so
    // the tiny namespace of 1-2 letter codes is not squatted.
    (val) => EMOJI.test(val) || Array.from(val).length >= 3,
    "Alias must be at least 3 characters",
  )
  .refine(
    (val) => Array.from(val).length <= ALIAS_MAX_LENGTH,
    `Alias must be at most ${ALIAS_MAX_LENGTH} characters`,
  )
  .refine(
    isSingleScript,
    "Use letters from a single alphabet (mixing scripts creates look-alike links)",
  )
  .refine((val) => !isReservedShortCode(val), "This alias is reserved. Please choose another.");

/**
 * Only http(s) may be stored: the redirect handler sends visitors straight to
 * this value, so a `javascript:` or `data:` URL would execute in their browser.
 * Zod's `.url()` alone accepts any valid URL scheme.
 */
const httpUrlSchema = (field: string) =>
  z
    .string(`${field} is required`)
    .trim()
    .min(1, `${field} is required`)
    .max(2048, `${field} must be under 2048 characters`)
    .url("Please enter a valid URL")
    .refine((val) => {
      try {
        return ["http:", "https:"].includes(new URL(val).protocol);
      } catch {
        return false;
      }
    }, "Only http and https URLs are allowed");

/** Optional URL: "" and null both mean "clear this field". */
const optionalUrl = (field: string) =>
  z
    .union([httpUrlSchema(field), z.literal(""), z.null()])
    .optional()
    .transform((val) => (val === "" ? null : val));

const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max, `Must be at most ${max} characters`), z.null()])
    .optional()
    .transform((val) => (val === "" ? null : val));

const countryCode = z
  .string()
  .trim()
  .transform((val) => val.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}$/, "Use a two-letter country code"));

const geoTargetsSchema = z
  .union([
    z
      .record(countryCode, httpUrlSchema("Geo target URL"))
      .refine((val) => Object.keys(val).length <= 50, "At most 50 countries"),
    z.null(),
  ])
  .optional();

const abVariantsSchema = z
  .union([
    z
      .array(
        z.object({
          url: httpUrlSchema("Variant URL"),
          weight: z.number().int().min(1, "Weight must be at least 1").max(100),
        }),
      )
      .min(2, "An A/B test needs at least two destinations")
      .max(5, "At most five destinations"),
    z.null(),
  ])
  .optional();

const tagNamesSchema = z
  .array(z.string().trim().min(1).max(40, "Tag names must be at most 40 characters"))
  .max(20, "At most 20 tags per link")
  .optional();

const redirectTypeSchema = z
  .union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)])
  .optional();

const futureDate = (message: string) =>
  z
    .string()
    .datetime("Invalid date format")
    .refine((val) => new Date(val) > new Date(), message);

/** Fields shared by create and update. All optional; null clears a field. */
const linkOptionFields = {
  domain: z
    .union([z.string().trim().toLowerCase().max(253), z.null()])
    .optional()
    .transform((val) => val ?? ""),
  title: optionalText(200),
  description: optionalText(2000),
  tags: tagNamesSchema,
  password: z.union([z.string().min(1).max(100), z.literal(""), z.null()]).optional(),
  expiredUrl: optionalUrl("Expired URL"),
  startsAt: z.union([z.string().datetime("Invalid date format"), z.null()]).optional(),
  maxClicks: z
    .union([z.number().int().min(1, "Click limit must be at least 1").max(1_000_000_000), z.null()])
    .optional(),
  disabled: z.boolean().optional(),
  archived: z.boolean().optional(),
  redirectType: redirectTypeSchema,
  forwardQuery: z.boolean().optional(),
  hideReferrer: z.boolean().optional(),
  cloaked: z.boolean().optional(),
  noLog: z.boolean().optional(),
  iosUrl: optionalUrl("iOS URL"),
  androidUrl: optionalUrl("Android URL"),
  geoTargets: geoTargetsSchema,
  abVariants: abVariantsSchema,
  ogTitle: optionalText(200),
  ogDescription: optionalText(500),
  ogImage: optionalUrl("Preview image URL"),
  publicStats: z.boolean().optional(),
  bioPinned: z.boolean().optional(),
};

function startsBeforeExpiry(data: { startsAt?: string | null; expiresAt?: string | null }) {
  if (!data.startsAt || !data.expiresAt) return true;
  return new Date(data.startsAt) < new Date(data.expiresAt);
}

export const createLinkSchema = z
  .object({
    url: httpUrlSchema("URL"),
    customAlias: customAliasSchema.optional().or(z.literal("")),
    /** Generate an emoji code instead of an alphanumeric one. */
    emoji: z.boolean().optional(),
    expiresAt: futureDate("Expiration date must be in the future").optional().nullable(),
    ...linkOptionFields,
  })
  .refine(startsBeforeExpiry, {
    message: "The start date must be before the expiration date",
    path: ["startsAt"],
  });

export const updateLinkSchema = z
  .object({
    url: httpUrlSchema("URL").optional(),
    /** Alias of `url`, kept for older clients. */
    originalUrl: httpUrlSchema("URL").optional(),
    customAlias: customAliasSchema.optional().or(z.literal("")),
    expiresAt: futureDate("Expiration date must be in the future").nullable().optional(),
    ...linkOptionFields,
    domain: z.string().trim().toLowerCase().max(253).optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one field must be provided to update",
  )
  .refine(startsBeforeExpiry, {
    message: "The start date must be before the expiration date",
    path: ["startsAt"],
  });

export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;

export const LINK_STATUSES = [
  "all",
  "active",
  "expired",
  "scheduled",
  "disabled",
  "archived",
  "protected",
] as const;

export const linkQuerySchema = z.object({
  page: z.coerce
    .number("Page must be a number")
    .int("Page must be a whole number")
    .positive("Page must be positive")
    .default(1),
  limit: z.coerce
    .number("Limit must be a number")
    .int("Limit must be a whole number")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .default(20),
  search: z.string().max(200, "Search query too long").optional(),
  status: z.enum(LINK_STATUSES).default("all"),
  tag: z.string().max(64).optional(),
  domain: z.string().max(253).optional(),
  sort: z.enum(["createdAt", "clicks", "lastClickedAt", "title"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const registerSchema = z.object({
  name: z
    .string("Name is required")
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be under 100 characters"),
  email: z
    .string("Email is required")
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string("Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be under 100 characters"),
});

export const STATS_PERIODS = ["24h", "7d", "30d", "90d", "365d", "all"] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

export const statsQuerySchema = z.object({
  period: z.enum(STATS_PERIODS, `Period must be one of: ${STATS_PERIODS.join(", ")}`).default("7d"),
  /** IANA timezone for day/hour buckets, e.g. "Asia/Kolkata". Defaults to UTC. */
  tz: z.string().max(64).optional(),
  includeBots: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true"),
});

export const TAG_COLORS = [
  "blue",
  "green",
  "pink",
  "amber",
  "purple",
  "teal",
  "red",
  "gray",
] as const;

export const tagSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40, "At most 40 characters"),
  color: z.enum(TAG_COLORS).default("blue"),
});

export const tagUpdateSchema = tagSchema
  .partial()
  // .partial() keeps color's default, which reset the colour to blue on every rename.
  .extend({ color: z.enum(TAG_COLORS).optional() })
  .refine((data) => data.name !== undefined || data.color !== undefined, "Nothing to update");

export const apiKeySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60, "At most 60 characters"),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
});

export const WEBHOOK_EVENTS = [
  "link.created",
  "link.updated",
  "link.deleted",
  "link.clicked",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const webhookSchema = z.object({
  url: httpUrlSchema("Webhook URL"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Pick at least one event"),
  enabled: z.boolean().default(true),
});

export const webhookUpdateSchema = z
  .object({
    url: httpUrlSchema("Webhook URL").optional(),
    events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Pick at least one event").optional(),
    enabled: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), "Nothing to update");

const HOSTNAME = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const domainSchema = z.object({
  hostname: z
    .string()
    .trim()
    .toLowerCase()
    .transform((val) =>
      val
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .replace(/\.$/, ""),
    )
    .pipe(z.string().regex(HOSTNAME, "Enter a domain like go.example.com")),
});

export const domainUpdateSchema = z.object({
  rootRedirect: optionalUrl("Root redirect"),
  notFoundRedirect: optionalUrl("Not-found redirect"),
});

export const BIO_THEMES = ["midnight", "aurora", "sunset", "ocean", "minimal", "forest"] as const;
export const BIO_SOCIALS = [
  "website",
  "x",
  "github",
  "linkedin",
  "instagram",
  "youtube",
  "tiktok",
  "email",
] as const;

export const bioSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.-]{3,30}$/, "3-30 characters: letters, numbers, dots, dashes, underscores"),
  displayName: optionalText(60),
  bio: optionalText(300),
  avatarUrl: optionalUrl("Avatar URL"),
  theme: z.enum(BIO_THEMES).default("midnight"),
  socials: z.partialRecord(z.enum(BIO_SOCIALS), z.string().trim().max(300)).optional().nullable(),
  published: z.boolean().default(true),
});

export const bulkCreateSchema = z.object({
  links: z
    .array(
      z.object({
        url: z.string(),
        customAlias: z.string().optional(),
        title: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .min(1, "Add at least one link"),
  /** Tags applied to every created link. */
  tags: tagNamesSchema,
});

export const BULK_ACTIONS = [
  "delete",
  "archive",
  "unarchive",
  "disable",
  "enable",
  "addTag",
  "removeTag",
] as const;

export const bulkActionSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1, "Select at least one link").max(500),
    action: z.enum(BULK_ACTIONS),
    tag: z.string().trim().min(1).max(40).optional(),
  })
  .refine(
    (data) => !["addTag", "removeTag"].includes(data.action) || !!data.tag,
    "A tag is required for this action",
  );

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  image: optionalUrl("Avatar URL"),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().max(100).optional(),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be under 100 characters"),
});

export const REPORT_REASONS = ["phishing", "malware", "spam", "illegal", "other"] as const;

export const reportSchema = z.object({
  code: z.string().min(1).max(200),
  domain: z.string().max(253).optional().default(""),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

export const unlockSchema = z.object({
  code: z.string().min(1).max(200),
  domain: z.string().max(253).optional().default(""),
  password: z.string().min(1, "Enter the password").max(100),
});

export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

export function formatZodErrorMessage(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(". ");
}

/** First human-readable message in a ZodError, for single-line error toasts. */
export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
