import { describe, it, expect } from "vitest";
import {
  createLinkSchema,
  updateLinkSchema,
  registerSchema,
  statsQuerySchema,
  linkQuerySchema,
  formatZodErrors,
} from "@/lib/validators";

describe("createLinkSchema", () => {
  it("accepts a valid URL", () => {
    const result = createLinkSchema.safeParse({ url: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects empty URL", () => {
    const result = createLinkSchema.safeParse({ url: "" });
    expect(result.success).toBe(false);
  });

  it("rejects non-URL string", () => {
    const result = createLinkSchema.safeParse({ url: "not a url" });
    expect(result.success).toBe(false);
  });

  it("rejects URL over 2048 chars", () => {
    const result = createLinkSchema.safeParse({ url: `https://example.com/${"a".repeat(2050)}` });
    expect(result.success).toBe(false);
  });

  it("accepts valid custom alias", () => {
    const result = createLinkSchema.safeParse({
      url: "https://example.com",
      customAlias: "my-link",
    });
    expect(result.success).toBe(true);
  });

  it("rejects alias with special characters", () => {
    const result = createLinkSchema.safeParse({
      url: "https://example.com",
      customAlias: "my link!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects alias shorter than 3 chars", () => {
    const result = createLinkSchema.safeParse({
      url: "https://example.com",
      customAlias: "ab",
    });
    expect(result.success).toBe(false);
  });

  it("rejects alias longer than 30 chars", () => {
    const result = createLinkSchema.safeParse({
      url: "https://example.com",
      customAlias: "a".repeat(31),
    });
    expect(result.success).toBe(false);
  });

  it("allows empty string alias (treated as no alias)", () => {
    const result = createLinkSchema.safeParse({
      url: "https://example.com",
      customAlias: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid expiration date", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const result = createLinkSchema.safeParse({
      url: "https://example.com",
      expiresAt: future,
    });
    expect(result.success).toBe(true);
  });

  it("rejects past expiration date", () => {
    const past = new Date("2020-01-01").toISOString();
    const result = createLinkSchema.safeParse({
      url: "https://example.com",
      expiresAt: past,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateLinkSchema", () => {
  it("accepts a valid URL update", () => {
    const result = updateLinkSchema.safeParse({ originalUrl: "https://new.example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects when no fields provided", () => {
    const result = updateLinkSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts null expiresAt to clear expiration", () => {
    const result = updateLinkSchema.safeParse({ expiresAt: null });
    expect(result.success).toBe(true);
  });
});

describe("registerSchema", () => {
  it("accepts valid registration", () => {
    const result = registerSchema.safeParse({
      name: "John",
      email: "john@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short password", () => {
    const result = registerSchema.safeParse({
      name: "John",
      email: "john@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      name: "John",
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = registerSchema.safeParse({
      name: "",
      email: "john@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });
});

describe("statsQuerySchema", () => {
  it("defaults to 7d", () => {
    const result = statsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.period).toBe("7d");
  });

  it("accepts valid periods", () => {
    for (const period of ["24h", "7d", "30d", "all"]) {
      const result = statsQuerySchema.safeParse({ period });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid period", () => {
    const result = statsQuerySchema.safeParse({ period: "1y" });
    expect(result.success).toBe(false);
  });
});

describe("linkQuerySchema", () => {
  it("defaults page to 1 and limit to 20", () => {
    const result = linkQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(1);
    expect(result.data?.limit).toBe(20);
  });

  it("rejects limit over 100", () => {
    const result = linkQuerySchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });

  it("coerces string numbers", () => {
    const result = linkQuerySchema.safeParse({ page: "3", limit: "50" });
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(3);
    expect(result.data?.limit).toBe(50);
  });
});

describe("formatZodErrors", () => {
  it("returns field-keyed error messages", () => {
    const result = registerSchema.safeParse({ name: "", email: "bad", password: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      expect(errors).toHaveProperty("name");
      expect(errors).toHaveProperty("email");
      expect(errors).toHaveProperty("password");
    }
  });
});
