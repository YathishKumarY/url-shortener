import { describe, it, expect } from "vitest";
import { generateShortCode } from "@/lib/nanoid";

describe("generateShortCode", () => {
  it("returns a 7-character string", () => {
    const code = generateShortCode();
    expect(code).toHaveLength(7);
  });

  it("only contains alphanumeric characters", () => {
    const code = generateShortCode();
    expect(code).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it("generates unique codes", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateShortCode()));
    expect(codes.size).toBe(100);
  });
});
