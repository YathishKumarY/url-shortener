import { customAlphabet } from "nanoid";
import { config } from "@/lib/config";
import { isReservedShortCode } from "@/lib/validators";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Single-codepoint emoji only: no skin-tone modifiers, ZWJ sequences or flags,
 * so every generated code renders as exactly the glyphs it contains on every
 * platform and survives copy/paste intact.
 */
export const EMOJI_ALPHABET = [
  "🔥",
  "🚀",
  "✨",
  "🌈",
  "🍕",
  "🎉",
  "🦄",
  "🐙",
  "🌵",
  "🍀",
  "🎯",
  "🎸",
  "🍩",
  "🐳",
  "🌙",
  "⚡",
  "🍉",
  "🦊",
  "🐝",
  "🌻",
  "🎈",
  "🧩",
  "🪐",
  "🍔",
  "🐼",
  "🦋",
  "🌊",
  "🍓",
  "🎨",
  "🧁",
  "🐧",
  "🌍",
  "🍒",
  "🦖",
  "🐢",
  "🍿",
  "🎁",
  "🔮",
  "🪁",
  "🥑",
  "🐬",
  "🌴",
  "🍪",
  "🎮",
  "🧲",
  "🛸",
  "🐞",
  "🌟",
];

const generators = new Map<number, () => string>();

function generatorFor(length: number): () => string {
  let generate = generators.get(length);
  if (!generate) {
    generate = customAlphabet(ALPHABET, length);
    generators.set(length, generate);
  }
  return generate;
}

/**
 * Generate a short code that is safe to serve at the site root.
 *
 * Re-rolls if the random code happens to collide with a reserved path, which
 * would otherwise mint a link that can never resolve. With 62^7 possible codes
 * a reserved-word collision is vanishingly rare, so the loop effectively never
 * runs twice. The length is SHORT_CODE_LENGTH (default 7).
 */
export function generateShortCode(length = config.shortCodeLength): string {
  const generate = generatorFor(length);
  let code = generate();
  while (isReservedShortCode(code)) {
    code = generate();
  }
  return code;
}

/** A random emoji code such as "🦊🍕🚀🌙" (48^4 ≈ 5.3 million combinations). */
export function generateEmojiCode(count = 4): string {
  const bytes = new Uint32Array(count);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => EMOJI_ALPHABET[n % EMOJI_ALPHABET.length]).join("");
}
