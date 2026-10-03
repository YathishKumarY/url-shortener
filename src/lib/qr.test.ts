import { describe, it, expect } from "vitest";
import { generateQRCode, QR_DEFAULT_WIDTH } from "@/lib/qr";

/** PNG IHDR: bytes 16-19 are width, 20-23 are height, both big-endian. */
function readPngSize(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe("generateQRCode", () => {
  it("returns a PNG buffer", async () => {
    const buf = await generateQRCode("https://example.com/abc1234");
    expect(buf.subarray(0, 4).equals(PNG_MAGIC)).toBe(true);
  });

  it("renders at the requested width", async () => {
    const buf = await generateQRCode("https://example.com/abc1234", { width: 256 });
    const { width, height } = readPngSize(buf);
    expect(width).toBe(256);
    expect(height).toBe(256);
  });

  it("defaults to a width large enough to stay scannable", async () => {
    const buf = await generateQRCode("https://example.com/abc1234");
    expect(readPngSize(buf).width).toBe(QR_DEFAULT_WIDTH);
    expect(QR_DEFAULT_WIDTH).toBeGreaterThanOrEqual(256);
  });

  /*
   * Regression: the modules were white (#ffffff) on a near-black background,
   * which most phone cameras will not decode. The corner pixel sits in the
   * quiet zone, so it must be the light background colour, and the finder
   * pattern a few modules in must be dark.
   */
  it("renders dark modules on a light background, not inverted", async () => {
    const buf = await generateQRCode("https://example.com/abc1234", { width: 256 });

    // Decode the PNG to raw pixels via the same zlib stream the encoder wrote.
    const { inflateSync } = await import("zlib");
    const idat: Buffer[] = [];
    let offset = 8;
    let width = 0;
    while (offset < buf.length) {
      const length = buf.readUInt32BE(offset);
      const type = buf.toString("ascii", offset + 4, offset + 8);
      if (type === "IHDR") width = buf.readUInt32BE(offset + 8);
      if (type === "IDAT") idat.push(buf.subarray(offset + 8, offset + 8 + length));
      if (type === "IEND") break;
      offset += 12 + length;
    }
    const raw = inflateSync(Buffer.concat(idat));

    // Rows are prefixed with a filter byte; the encoder emits RGBA here.
    const channels = 4;
    const stride = width * channels + 1;
    const pixelAt = (x: number, y: number) => {
      const base = y * stride + 1 + x * channels;
      return { r: raw[base], g: raw[base + 1], b: raw[base + 2] };
    };

    const corner = pixelAt(0, 0);
    expect(corner.r).toBeGreaterThan(200);
    expect(corner.g).toBeGreaterThan(200);
    expect(corner.b).toBeGreaterThan(200);

    // Walk inward along the diagonal; the finder pattern guarantees dark
    // modules near the top-left once past the quiet zone.
    let sawDark = false;
    for (let i = 0; i < width; i++) {
      const p = pixelAt(i, i);
      if (p.r < 80 && p.g < 80 && p.b < 80) {
        sawDark = true;
        break;
      }
    }
    expect(sawDark).toBe(true);
  });

  it("encodes different URLs into different images", async () => {
    const [a, b] = await Promise.all([
      generateQRCode("https://example.com/aaaaaaa"),
      generateQRCode("https://example.com/bbbbbbb"),
    ]);
    expect(a.equals(b)).toBe(false);
  });
});
