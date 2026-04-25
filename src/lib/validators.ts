import { z } from "zod";

const aliasRegex = /^[a-zA-Z0-9_-]+$/;

export const createLinkSchema = z.object({
  url: z
    .string("URL is required")
    .trim()
    .min(1, "URL is required")
    .max(2048, "URL must be under 2048 characters")
    .url("Please enter a valid URL"),
  customAlias: z
    .string()
    .trim()
    .regex(aliasRegex, "Only letters, numbers, hyphens, and underscores allowed")
    .min(3, "Alias must be at least 3 characters")
    .max(30, "Alias must be under 30 characters")
    .optional()
    .or(z.literal("")),
  expiresAt: z
    .string()
    .datetime("Invalid date format")
    .optional()
    .refine((val) => !val || new Date(val) > new Date(), "Expiration date must be in the future"),
});

export const updateLinkSchema = z
  .object({
    originalUrl: z
      .string()
      .trim()
      .min(1, "URL cannot be empty")
      .max(2048, "URL must be under 2048 characters")
      .url("Please enter a valid URL")
      .optional(),
    customAlias: z
      .string()
      .trim()
      .regex(aliasRegex, "Only letters, numbers, hyphens, and underscores allowed")
      .min(3, "Alias must be at least 3 characters")
      .max(30, "Alias must be under 30 characters")
      .optional()
      .or(z.literal("")),
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
