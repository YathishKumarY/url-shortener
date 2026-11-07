import { describe, expect, it } from "vitest";
import { normalizeLinkInput } from "@/components/bio/utils";

describe("normalizeLinkInput", () => {
  it("adds https:// to a bare address", () => {
    expect(normalizeLinkInput("linkedin.com/in/me")).toBe("https://linkedin.com/in/me");
    expect(normalizeLinkInput("  drive.google.com/file/d/abc/view ")).toBe(
      "https://drive.google.com/file/d/abc/view",
    );
  });

  it("keeps a URL that already has a scheme", () => {
    expect(normalizeLinkInput("https://example.com/cv.pdf")).toBe("https://example.com/cv.pdf");
    expect(normalizeLinkInput("http://example.com")).toBe("http://example.com");
    expect(normalizeLinkInput("HTTPS://Example.com")).toBe("HTTPS://Example.com");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeLinkInput("   ")).toBe("");
  });
});
