/**
 * Country display helpers, shared by server and client. Clicks store ISO
 * 3166-1 alpha-2 codes; rows written by older builds may hold a full name.
 */

let regionNames: Intl.DisplayNames | null = null;
let languageNames: Intl.DisplayNames | null = null;

export function countryName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  if (!/^[A-Za-z]{2}$/.test(code)) return code; // legacy row holding a name
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** "US" -> 🇺🇸, built from regional indicator symbols. */
export function countryFlag(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

export function languageName(tag: string | null | undefined): string {
  if (!tag) return "Unknown";
  try {
    languageNames ??= new Intl.DisplayNames(["en"], { type: "language" });
    return languageNames.of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/** ISO codes offered in the geo-targeting picker. */
export const COMMON_COUNTRIES = [
  "US",
  "GB",
  "CA",
  "AU",
  "IN",
  "DE",
  "FR",
  "ES",
  "IT",
  "NL",
  "SE",
  "NO",
  "DK",
  "FI",
  "IE",
  "PL",
  "PT",
  "BR",
  "MX",
  "AR",
  "CL",
  "CO",
  "JP",
  "KR",
  "CN",
  "SG",
  "HK",
  "TW",
  "ID",
  "MY",
  "TH",
  "VN",
  "PH",
  "AE",
  "SA",
  "IL",
  "TR",
  "EG",
  "ZA",
  "NG",
  "KE",
  "NZ",
  "CH",
  "AT",
  "BE",
  "CZ",
  "RO",
  "UA",
  "RU",
  "PK",
  "BD",
  "LK",
  "NP",
  "GR",
  "HU",
];
