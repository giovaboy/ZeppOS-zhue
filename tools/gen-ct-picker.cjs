#!/usr/bin/env node
// Makes assets/default.{r,s}/ct-picker.png: the color temperature bar of the
// color picker, a pill (rounded ends, as the brightness slider under it).
// An IMG ignores `radius` on Zepp OS: the corners are transparent pixels.
// The gradient (cold on top, warm at the bottom) is read from the image's
// center column, so the script can run again on its own output:
//   node tools/gen-ct-picker.cjs
// (.cjs so that Zeus doesn't bundle it)
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ROOT = path.join(__dirname, '..')
const FILES = ['assets/default.r/ct-picker.png', 'assets/default.s/ct-picker.png']
// The size it is drawn at on a 480 px screen (color-picker.*.layout.js:
// w = 2 × px(36), h = pickerSize = px(300)): auto_scale keeps the ends round
const W = 72
const H = 300
const RADIUS = W / 2
const SS = 4 // supersampling of the edges

// 8-bit RGB or RGBA PNG, non-interlaced
function decode(file) {
  const b = fs.readFileSync(file)
  const ct = b[25]
  if (b[24] !== 8 || (ct !== 2 && ct !== 6) || b[28] !== 0) throw new Error(`${file}: expected an 8-bit RGB(A) PNG`)
  const bpp = ct === 2 ? 3 : 4
  const w = b.readUInt32BE(16)
  const h = b.readUInt32BE(20)
  const idat = []
  for (let p = 8; p < b.length;) {
    const len = b.readUInt32BE(p)
    if (b.toString('ascii', p + 4, p + 8) === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len))
    p += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const px = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0
      const u = y ? px[(y - 1) * stride + x] : 0
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0
      let v = raw[y * (stride + 1) + 1 + x]
      if (f === 1) v += a
      else if (f === 2) v += u
      else if (f === 3) v += (a + u) >> 1
      else if (f === 4) { const p = a + u - c; const pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c }
      px[y * stride + x] = v & 255
    }
  }
  return { w, h, rgb: (x, y) => [...px.subarray((y * w + x) * bpp, (y * w + x) * bpp + 3)] }
}

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encode(w, h, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// How much of the pixel (x, y) is inside the pill
function coverage(x, y) {
  let n = 0
  for (let i = 0; i < SS; i++) {
    for (let j = 0; j < SS; j++) {
      const sx = x + (i + 0.5) / SS
      const sy = y + (j + 0.5) / SS
      const cy = Math.min(Math.max(sy, RADIUS), H - RADIUS)
      if ((sx - RADIUS) ** 2 + (sy - cy) ** 2 <= RADIUS ** 2) n++
    }
  }
  return n / (SS * SS)
}

const src = decode(path.join(ROOT, FILES[0]))
const out = Buffer.alloc(W * H * 4)
for (let y = 0; y < H; y++) {
  const [r, g, b] = src.rgb(src.w >> 1, Math.min(src.h - 1, Math.round((y / (H - 1)) * (src.h - 1))))
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4
    out[o] = r
    out[o + 1] = g
    out[o + 2] = b
    out[o + 3] = Math.round(coverage(x, y) * 255)
  }
}
const png = encode(W, H, out)
for (const f of FILES) fs.writeFileSync(path.join(ROOT, f), png)
console.log(`${FILES.join(', ')}: ${W}×${H}, radius ${RADIUS}, ${png.length} bytes`)
