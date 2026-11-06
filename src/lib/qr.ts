import QRCode from "qrcode";

/**
 * QR codes must be dark modules on a light background by default.
 *
 * In the `qrcode` package, `color.dark` is the colour of the data modules and
 * `color.light` is the colour of the background/quiet zone (see
 * `renderer/utils.js`, which builds the palette as `[light, dark]`). Inverting
 * them produces a light-on-dark symbol that most phone cameras refuse to
 * decode, so the default polarity below is deliberate - do not swap it to
 * match the app's dark theme.
 */
export const QR_DEFAULT_DARK = "#000000";
export const QR_DEFAULT_LIGHT = "#ffffff";

/** ISO/IEC 18004 requires a quiet zone of at least 4 modules. */
const QUIET_ZONE_MODULES = 4;

export const QR_DEFAULT_WIDTH = 512;

export type QRErrorCorrection = "L" | "M" | "Q" | "H";

export interface QRCodeOptions {
  /** Output width in pixels. Larger renders scan more reliably when printed. */
  width?: number;
  /** Module colour, #rrggbb. */
  dark?: string;
  /** Background colour, #rrggbb. */
  light?: string;
  margin?: number;
  /** "M" recovers ~15% of a damaged symbol; use "H" (~30%) under a logo. */
  errorCorrectionLevel?: QRErrorCorrection;
}

function renderOptions({
  width = QR_DEFAULT_WIDTH,
  dark = QR_DEFAULT_DARK,
  light = QR_DEFAULT_LIGHT,
  margin = QUIET_ZONE_MODULES,
  errorCorrectionLevel = "M",
}: QRCodeOptions) {
  return { width, margin, color: { dark, light }, errorCorrectionLevel };
}

export async function generateQRCode(url: string, options: QRCodeOptions = {}): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: "png", ...renderOptions(options) });
}

export async function generateQRCodeSvg(url: string, options: QRCodeOptions = {}): Promise<string> {
  return QRCode.toString(url, { type: "svg", ...renderOptions(options) });
}

/** Accept "1a2b3c" or "#1a2b3c"; anything else falls back. */
export function parseHexColor(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const hex = value.replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex.toLowerCase()}` : fallback;
}
