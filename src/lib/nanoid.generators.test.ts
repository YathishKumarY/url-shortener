import { afterEach, describe, expect, it, vi } from "vitest";
import { EMOJI_ALPHABET, generateEmojiCode, generateShortCode } from "@/lib/nanoid";

/** Complements nanoid.test.ts: emoji codes and the configurable length. */

const ALPHANUMERIC = /^[0-9A-Za-z]+$/;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("EMOJI_ALPHABET", () => {
  it("has 48 distinct entries", () => {
    expect(EMOJI_ALPHABET).toHaveLength(48);
    expect(new Set(EMOJI_ALPHABET).size).toBe(48);
  });

  it("holds single-codepoint pictographs only, so codes survive copy and paste", () => {
    for (const emoji of EMOJI_ALPHABET) {
      expect(Array.from(emoji)).toHaveLength(1);
      expect(emoji).toMatch(/^\p{Extended_Pictographic}$/u);
    }
  });
});

describe("generateEmojiCode", () => {
  it("returns four emoji by default, counted in code points", () => {
    for (let i = 0; i < 200; i++) {
      const glyphs = Array.from(generateEmojiCode());
      expect(glyphs).toHaveLength(4);
      for (const glyph of glyphs) expect(EMOJI_ALPHABET).toContain(glyph);
    }
  });

  it.each([1, 6, 12])("returns %i emoji on request", (count) => {
    expect(Array.from(generateEmojiCode(count))).toHaveLength(count);
  });

  it("returns an empty string for a count of 0", () => {
    expect(generateEmojiCode(0)).toBe("");
  });

  it("maps each random word onto the alphabet modulo its size", () => {
    const words = [0, 1, 47, 48, 2 ** 32 - 1];
    const fake = ((array: Uint32Array) => {
      array.set(words);
      return array;
    }) as unknown as typeof crypto.getRandomValues;
    vi.spyOn(crypto, "getRandomValues").mockImplementation(fake);

    const expected = words.map((n) => EMOJI_ALPHABET[n % 48]).join("");
    expect(generateEmojiCode(5)).toBe(expected);
    expect(Array.from(expected)).toEqual([
      EMOJI_ALPHABET[0],
      EMOJI_ALPHABET[1],
      EMOJI_ALPHABET[47],
      EMOJI_ALPHABET[0],
      EMOJI_ALPHABET[15],
    ]);
  });
});

describe("generateShortCode length", () => {
  it.each([4, 10, 16])("honours an explicit length of %i", (length) => {
    const code = generateShortCode(length);
    expect(code).toHaveLength(length);
    expect(code).toMatch(ALPHANUMERIC);
  });

  it("reads SHORT_CODE_LENGTH at call time", () => {
    vi.stubEnv("SHORT_CODE_LENGTH", "10");
    expect(generateShortCode()).toHaveLength(10);
    vi.stubEnv("SHORT_CODE_LENGTH", "12");
    expect(generateShortCode()).toHaveLength(12);
  });

  it("lets an explicit length win over the environment", () => {
    vi.stubEnv("SHORT_CODE_LENGTH", "12");
    expect(generateShortCode(5)).toHaveLength(5);
  });

  it.each([
    ["100", 16],
    ["17", 16],
    ["2", 4],
    ["0", 4],
    ["-5", 4],
    ["9.7", 9],
  ])("clamps SHORT_CODE_LENGTH=%o to %i", (value, expected) => {
    vi.stubEnv("SHORT_CODE_LENGTH", value);
    expect(generateShortCode()).toHaveLength(expected);
  });

  /*
   * Regression: a blank value (SHORT_CODE_LENGTH= in a .env file, or an unset
   * variable interpolated by docker compose) parsed as 0 and was clamped to
   * the minimum, silently minting 4-character codes.
   */
  it.each([undefined, "", "   ", "abc"])("falls back to 7 for SHORT_CODE_LENGTH=%o", (value) => {
    vi.stubEnv("SHORT_CODE_LENGTH", value);
    expect(generateShortCode()).toHaveLength(7);
  });
});

describe("generateShortCode generators", () => {
  afterEach(() => {
    vi.doUnmock("nanoid");
    vi.resetModules();
  });

  async function withFakeNanoid(sequence: string[]) {
    const generate = vi.fn(() => sequence.shift() ?? "zzzzzzz");
    const customAlphabet = vi.fn<(alphabet: string, size: number) => () => string>(() => generate);
    vi.resetModules();
    vi.doMock("nanoid", () => ({ customAlphabet }));
    const mod = await import("@/lib/nanoid");
    return { ...mod, generate, customAlphabet };
  }

  it("re-rolls until the code is not a reserved path", async () => {
    const { generateShortCode: gen, generate } = await withFakeNanoid(["api", "Api", "new", "k3Q"]);
    expect(gen(3)).toBe("k3Q");
    expect(generate).toHaveBeenCalledTimes(4);
  });

  it("builds one alphanumeric generator per length and reuses it", async () => {
    const { generateShortCode: gen, customAlphabet } = await withFakeNanoid([]);
    gen(5);
    gen(5);
    gen(8);
    expect(customAlphabet).toHaveBeenCalledTimes(2);
    expect(customAlphabet).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^[0-9A-Za-z]{62}$/),
      5,
    );
    expect(customAlphabet).toHaveBeenNthCalledWith(2, expect.any(String), 8);
  });
});
