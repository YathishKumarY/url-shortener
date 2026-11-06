// Generates the extension icons (16/32/48/128 px) using only Node built-ins.
// Usage: node extension/scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "icons");
mkdirSync(outDir, { recursive: true });

const BLUE = [0x14, 0x4e, 0xe3];
const PINK = [0xeb, 0x56, 0x8e];
const SS = 4; // supersampling factor per axis

// Signed distance to a rounded square covering [0,1]^2.
function roundedSquare(x, y, radius) {
  const qx = Math.abs(x - 0.5) - (0.5 - radius);
  const qy = Math.abs(y - 0.5) - (0.5 - radius);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - radius;
}

// Signed distance to a capsule lying along the u axis.
function capsule(u, v, centerU, halfLen, r) {
  const du = Math.max(Math.abs(u - centerU) - halfLen, 0);
  return Math.hypot(du, v) - r;
}

// Returns [r, g, b, a] (a in 0..1, not premultiplied) for one sample.
function sample(x, y) {
  const inside = roundedSquare(x, y, 0.22) <= 0;
  if (!inside) return [0, 0, 0, 0];
  const t = (x + y) / 2;
  let rgb = BLUE.map((c, i) => c + (PINK[i] - c) * t);

  const px = x - 0.5;
  const py = y - 0.5;
  const u = (px - py) / Math.SQRT2;
  const v = (px + py) / Math.SQRT2;
  const stroke = 0.075;
  const ring = (cu) => Math.abs(capsule(u, v, cu, 0.05, 0.125)) <= stroke / 2;
  if (ring(-0.105) || ring(0.105)) rgb = [255, 255, 255];
  return [...rgb, 1];
}

function render(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const s = sample((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
          r += s[0] * s[3];
          g += s[1] * s[3];
          b += s[2] * s[3];
          a += s[3];
        }
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      if (a > 0) {
        raw[o] = Math.round(r / a);
        raw[o + 1] = Math.round(g / a);
        raw[o + 2] = Math.round(b / a);
      }
      raw[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return raw;
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(render(size), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [16, 32, 48, 128]) {
  const file = join(outDir, `icon${size}.png`);
  writeFileSync(file, png(size));
  console.log("wrote", file);
}
