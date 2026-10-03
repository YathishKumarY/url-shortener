import { customAlphabet } from "nanoid";
import { isReservedShortCode } from "@/lib/validators";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const CODE_LENGTH = 7;

const nanoid = customAlphabet(ALPHABET, CODE_LENGTH);

/**
 * Generate a short code that is safe to serve at the site root.
 *
 * Re-rolls if the random code happens to collide with a reserved path, which
 * would otherwise mint a link that can never resolve. A 7-character code from
 * a 62-character alphabet makes a reserved-word collision vanishingly rare, so
 * the loop effectively never runs twice; the length stays fixed at 7.
 */
export function generateShortCode(): string {
  let code = nanoid();
  while (isReservedShortCode(code)) {
    code = nanoid();
  }
  return code;
}
