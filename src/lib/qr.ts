import QRCode from "qrcode";

/**
 * QR codes must be dark modules on a light background.
 *
 * In the `qrcode` package, `color.dark` is the colour of the data modules and
 * `color.light` is the colour of the background/quiet zone (see
 * `renderer/utils.js`, which builds the palette as `[light, dark]`). Inverting
 * them produces a light-on-dark symbol that most phone cameras refuse to
 * decode, so the polarity below is deliberate - do not swap it to match the
 * app's dark theme.
 */
const MODULE_COLOR = "#000000";
const BACKGROUND_COLOR = "#ffffff";

/** ISO/IEC 18004 requires a quiet zone of at least 4 modules. */
const QUIET_ZONE_MODULES = 4;

export const QR_DEFAULT_WIDTH = 512;

export interface QRCodeOptions {
  /** Output width in pixels. Larger renders scan more reliably when printed. */
  width?: number;
}

export async function generateQRCode(
  url: string,
  { width = QR_DEFAULT_WIDTH }: QRCodeOptions = {},
): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width,
    margin: QUIET_ZONE_MODULES,
    color: { dark: MODULE_COLOR, light: BACKGROUND_COLOR },
    // "M" recovers ~15% of a damaged symbol, the usual default for URLs.
    errorCorrectionLevel: "M",
  });
}
