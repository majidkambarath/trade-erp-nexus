// Generates the PWA icons from the brand mark, with no image library: a PNG is a handful of
// CRC-checked chunks around a zlib stream, and the mark is three rounded squares, so the whole
// thing is cheaper than adding a rasteriser to the dependency tree.
//
//   node scripts/make-icons.mjs
//
// Re-run it after changing the brand colours below. The output is committed, so a deploy never
// depends on this script having run.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// Graphite tile, champagne-gold mark: the product's own colours (styles/tokens/primitives.css).
// A dark tile reads on both a light and a dark home screen, which a white one does not.
const BG = [0x14, 0x15, 0x19];
const FG = [0xc9, 0xa4, 0x49];

const SS = 4; // supersample factor: draw big, average down, get smooth edges for free

// ---------------------------------------------------------------- PNG encoding

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // truecolour with alpha
  // 10..12: deflate, adaptive filtering, no interlace - all zero

  // one filter byte per scanline, filter type 0 (none)
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- drawing

/** Is (x, y) inside a rounded rectangle? */
const inRounded = (x, y, left, top, w, h, r) => {
  const right = left + w;
  const bottom = top + h;
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = Math.min(Math.max(x, left + r), right - r);
  const cy = Math.min(Math.max(y, top + r), bottom - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

/** Inside the outline of a rounded rectangle of thickness `t`. */
const inRoundedStroke = (x, y, left, top, w, h, r, t) =>
  inRounded(x, y, left, top, w, h, r) &&
  !inRounded(x, y, left + t, top + t, w - 2 * t, h - 2 * t, Math.max(r - t, 0));

/**
 * The mark: three rounded squares, two below and one above, the shape of the Boxes glyph the
 * app uses in its top bar. `inset` keeps it inside the maskable safe area (the middle 80% that
 * every platform's mask is guaranteed to show).
 */
function drawIcon(size, { fullBleed }) {
  const n = size * SS;
  const acc = new Float64Array(n * n); // coverage of the mark, 0..1
  const bg = new Float64Array(n * n); // coverage of the tile

  const radius = fullBleed ? 0 : n * 0.22;
  // the mark lives in the central 56% for a maskable tile, 68% otherwise
  const span = n * (fullBleed ? 0.56 : 0.68);
  const originX = (n - span) / 2;
  const originY = (n - span) / 2;
  const box = span * 0.46; // each square
  const gap = span - box * 2;
  const t = Math.max(span * 0.075, 2); // stroke
  const r = box * 0.26;

  const boxes = [
    [originX + (span - box) / 2, originY], // top
    [originX, originY + box + gap], // bottom left
    [originX + box + gap, originY + box + gap], // bottom right
  ];

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      bg[i] = radius === 0 || inRounded(x + 0.5, y + 0.5, 0, 0, n - 1, n - 1, radius) ? 1 : 0;
      for (const [bx, by] of boxes) {
        if (inRoundedStroke(x + 0.5, y + 0.5, bx, by, box, box, r, t)) {
          acc[i] = 1;
          break;
        }
      }
    }
  }

  // average each SS x SS block down to one pixel
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let mark = 0;
      let tile = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = (y * SS + dy) * n + (x * SS + dx);
          mark += acc[i];
          tile += bg[i];
        }
      }
      mark /= SS * SS;
      tile /= SS * SS;

      // mark over tile, tile over transparency
      const p = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        const under = BG[c] * tile;
        out[p + c] = Math.round(under * (1 - mark) + FG[c] * mark);
      }
      out[p + 3] = Math.round(255 * Math.max(tile, mark));
    }
  }
  return png(size, size, out);
}

mkdirSync(OUT, { recursive: true });

const files = [
  // maskable: full bleed, mark inside the safe area, so Android can crop it to any shape
  ["icon-192.png", 192, { fullBleed: true }],
  ["icon-512.png", 512, { fullBleed: true }],
  // iOS applies its own mask to this one, so it is full bleed too
  ["apple-touch-icon.png", 180, { fullBleed: true }],
  // the browser tab, where a rounded tile reads better than a square
  ["favicon-32.png", 32, { fullBleed: false }],
];

for (const [name, size, opts] of files) {
  const buf = drawIcon(size, opts);
  writeFileSync(join(OUT, name), buf);
  console.log(`${name.padEnd(22)} ${size}x${size}  ${(buf.length / 1024).toFixed(1)} kB`);
}
