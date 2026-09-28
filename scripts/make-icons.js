// Draws the SecondLook icon (eye + pause) as PNGs with no dependencies.
// Run once: node scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const BG = [15, 22, 41], TEAL = [110, 231, 200];

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
}

// Colour of a point in a 64x64 design space (same geometry as assets/icon.svg).
function sample(x, y) {
  const r = 14;
  const dx = Math.max(r - x, 0, x - (64 - r)), dy = Math.max(r - y, 0, y - (64 - r));
  if (dx * dx + dy * dy > r * r) return null; // outside rounded square
  const ex = (x - 32) / 24, ey = (y - 32) / 15;
  const e = Math.sqrt(ex * ex + ey * ey);
  const d = Math.hypot(x - 32, y - 32);
  if (d <= 9) {
    if ((x >= 28 && x <= 31 && y >= 27 && y <= 37) || (x >= 33 && x <= 36 && y >= 27 && y <= 37)) return BG;
    return TEAL;
  }
  if (Math.abs(e - 1) * 15 <= 2) return TEAL; // eye outline
  return BG;
}

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const ss = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let rs = 0, gs = 0, bs = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = sample((px + (sx + 0.5) / ss) * 64 / size, (py + (sy + 0.5) / ss) * 64 / size);
        if (c) { rs += c[0]; gs += c[1]; bs += c[2]; a++; }
      }
      const i = (py * size + px) * 4;
      if (a) { buf[i] = Math.round(rs / a); buf[i + 1] = Math.round(gs / a); buf[i + 2] = Math.round(bs / a); }
      buf[i + 3] = Math.round(255 * a / (ss * ss));
    }
  }
  return png(size, buf);
}

const out = [
  ...[16, 32, 48, 128].map(s => ['extension/icons/icon' + s + '.png', s]),
  ['assets/icon-192.png', 192], ['assets/icon-512.png', 512]
];
for (const [file, size] of out) {
  const p = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, draw(size));
  console.log('wrote ' + file);
}
