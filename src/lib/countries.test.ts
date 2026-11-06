import { describe, expect, it } from "vitest";
import { COMMON_COUNTRIES, countryFlag, countryName, languageName } from "@/lib/countries";

describe("countryFlag", () => {
  it.each([
    ["US", "\u{1F1FA}\u{1F1F8}"],
    ["us", "\u{1F1FA}\u{1F1F8}"],
    ["IN", "\u{1F1EE}\u{1F1F3}"],
    ["gb", "\u{1F1EC}\u{1F1E7}"],
  ])("builds the flag for %s from regional indicators", (code, flag) => {
    expect(countryFlag(code)).toBe(flag);
  });

  it("renders the expected emoji", () => {
    expect(countryFlag("US")).toBe("🇺🇸");
  });

  it.each([null, undefined, "", "USA", "U", "1A", "U$", "United States"])(
    "shows a globe for %o",
    (code) => {
      expect(countryFlag(code)).toBe("🌐");
    },
  );
});

describe("countryName", () => {
  it.each([
    ["US", "United States"],
    ["us", "United States"],
    ["DE", "Germany"],
    ["GB", "United Kingdom"],
    ["IN", "India"],
  ])("names %s as %s", (code, name) => {
    expect(countryName(code)).toBe(name);
  });

  it.each(["United States", "Côte d'Ivoire", "123"])(
    "passes the legacy value %o through",
    (value) => {
      expect(countryName(value)).toBe(value);
    },
  );

  it.each([null, undefined, ""])("is Unknown for %o", (code) => {
    expect(countryName(code)).toBe("Unknown");
  });
});

describe("languageName", () => {
  it.each([
    ["en-US", "American English"],
    ["fr", "French"],
    ["de", "German"],
    ["ja", "Japanese"],
  ])("names %s as %s", (tag, name) => {
    expect(languageName(tag)).toBe(name);
  });

  it.each([null, undefined, ""])("is Unknown for %o", (tag) => {
    expect(languageName(tag)).toBe("Unknown");
  });

  it("returns an invalid tag unchanged instead of throwing", () => {
    expect(languageName("not a tag!")).toBe("not a tag!");
  });
});

describe("COMMON_COUNTRIES", () => {
  it("lists distinct upper-case ISO codes", () => {
    expect(new Set(COMMON_COUNTRIES).size).toBe(COMMON_COUNTRIES.length);
    for (const code of COMMON_COUNTRIES) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("only offers countries that have a flag and a display name", () => {
    for (const code of COMMON_COUNTRIES) {
      expect(countryFlag(code)).not.toBe("🌐");
      expect(countryName(code)).not.toBe(code);
    }
  });
});
