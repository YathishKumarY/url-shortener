import { z } from "zod";

const aliasRegex = /^[a-zA-Z0-9_-]+$/;

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
  "link-expired",
  "link-missing",
  "not-found",
  "_next",
  "favicon.ico",
  "icon.svg",
  "apple-icon.svg",
  "robots.txt",
  "sitemap.xml",
  "login",
  "logout",
  "signin",
  "signup",
  "register",
  "settings",
  "admin",
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

const customAliasSchema = z
  .string()
  .trim()
  .regex(aliasRegex, "Only letters, numbers, hyphens, and underscores allowed")
  .min(3, "Alias must be at least 3 characters")
  .max(30, "Alias must be under 30 characters")
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

export const createLinkSchema = z.object({
  url: httpUrlSchema("URL"),
  customAlias: customAliasSchema.optional().or(z.literal("")),
  expiresAt: z
    .string()
    .datetime("Invalid date format")
    .optional()
    .refine((val) => !val || new Date(val) > new Date(), "Expiration date must be in the future"),
});

export const updateLinkSchema = z
  .object({
    originalUrl: httpUrlSchema("URL").optional(),
    customAlias: customAliasSchema.optional().or(z.literal("")),
    expiresAt: z
      .string()
      .datetime("Invalid date format")
      .nullable()
      .optional()
      .refine(
        (val) => val === null || val === undefined || new Date(val) > new Date(),
        "Expiration date must be in the future",
      ),
  })
  .refine(
    (data) => data.originalUrl || data.customAlias !== undefined || data.expiresAt !== undefined,
    "At least one field must be provided to update",
  );

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

export const statsQuerySchema = z.object({
  period: z
    .enum(["24h", "7d", "30d", "all"], "Period must be one of: 24h, 7d, 30d, all")
    .default("7d"),
});

export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

export function formatZodErrorMessage(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(". ");
}
