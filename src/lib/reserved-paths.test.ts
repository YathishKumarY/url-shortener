import { describe, it, expect } from "vitest";
import { generateShortCode } from "@/lib/nanoid";
import { safeHostname, faviconUrl } from "@/lib/utils";
import { createLinkSchema, updateLinkSchema, isReservedShortCode } from "@/lib/validators";

describe("isReservedShortCode", () => {
  it.each(["api", "auth", "dashboard", "link-expired", "link-missing", "not-found", "_next"])(
    "reserves %s",
    (code) => {
      expect(isReservedShortCode(code)).toBe(true);
    },
  );

  it("is case-insensitive", () => {
    expect(isReservedShortCode("DASHBOARD")).toBe(true);
    expect(isReservedShortCode("Api")).toBe(true);
  });

  it("allows an ordinary code", () => {
    expect(isReservedShortCode("Ab3xY9z")).toBe(false);
  });
});

describe("createLinkSchema url scheme", () => {
  /*
   * Regression: zod's .url() accepts any scheme, so a javascript: URL could be
   * stored and then handed straight to a visitor's browser by the redirect
   * handler.
   */
  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
  ])("rejects %s", (url) => {
    expect(createLinkSchema.safeParse({ url }).success).toBe(false);
  });

  it.each(["https://example.com", "http://example.com/path?q=1"])("accepts %s", (url) => {
    expect(createLinkSchema.safeParse({ url }).success).toBe(true);
  });

  it("rejects a dangerous scheme on update too", () => {
    const result = updateLinkSchema.safeParse({ originalUrl: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });
});

describe("createLinkSchema customAlias", () => {
  it("rejects an alias that would shadow an app route", () => {
    const result = createLinkSchema.safeParse({
      url: "https://example.com",
      customAlias: "dashboard",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a normal alias", () => {
    const result = createLinkSchema.safeParse({
      url: "https://example.com",
      customAlias: "my-link",
    });
    expect(result.success).toBe(true);
  });
});

describe("generateShortCode", () => {
  it("never returns a reserved code", () => {
    for (let i = 0; i < 200; i++) {
      expect(isReservedShortCode(generateShortCode())).toBe(false);
    }
  });
});

describe("safeHostname", () => {
  it("extracts a hostname", () => {
    expect(safeHostname("https://example.com/a/b")).toBe("example.com");
  });

  /*
   * Regression: an unguarded new URL() in the table's render path threw on a
   * single malformed stored URL and took down the whole list.
   */
  it.each(["not a url", "", "://broken"])("returns null for %o instead of throwing", (value) => {
    expect(safeHostname(value)).toBeNull();
  });
});

describe("faviconUrl", () => {
  it("builds a favicon URL for a valid link", () => {
    expect(faviconUrl("https://example.com", 32)).toContain("domain=example.com");
  });

  it("returns null for a malformed link so the caller can skip the image", () => {
    expect(faviconUrl("not a url")).toBeNull();
  });
});
