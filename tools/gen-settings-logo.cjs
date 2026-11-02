#!/usr/bin/env node
// Makes setting/logo.js: the wordmark of the app icon (assets/default.r/icon.png)
// without its white disc, inlined as a data URI, for the settings page header
// (the settings page can't load the watch's assets). Run again after
// changing the icon: node tools/gen-settings-logo.cjs
// (.cjs so that Zeus doesn't bundle it)
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'assets/default.r/icon.png')
const OUT = path.join(ROOT, 'setting/logo.js')

// 8-bit RGBA PNG, non-interlaced
function decode(file) {
  const b = fs.readFileSync(file)
  if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0) throw new Error(`${file}: expected an 8-bit RGBA PNG`)
  const w = b.readUInt32BE(16)
  const h = b.readUInt32BE(20)
  const idat = []
  for (let p = 8; p < b.length;) {
    const len = b.readUInt32BE(p)
    if (b.toString('ascii', p + 4, p + 8) === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len))
    p += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * 4
  const px = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0
      const u = y ? px[(y - 1) * stride + x] : 0
      const c = x >= 4 && y ? px[(y - 1) * stride + x - 4] : 0
      let v = raw[y * (stride + 1) + 1 + x]
      if (f === 1) v += a
      else if (f === 2) v += u
      else if (f === 3) v += (a + u) >> 1
      else if (f === 4) { const p = a + u - c; const pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c }
      px[y * stride + x] = v & 255
    }
  }
  return { w, h, px }
}

// The wordmark alone: the icon's white disc made transparent ("color to
// alpha" against white, so the letters' antialiased edges keep no white
// fringe), cropped to the colored letters plus MARGIN px
const MARGIN = 3
function wordmark({ w, h, px }) {
  // The letters: opaque enough, and colored or dark (the disc's own grey
  // antialiased rim is neither)
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]]
    if (a > 128 && (Math.max(r, g, b) - Math.min(r, g, b) > 40 || (r + g + b) / 3 < 160)) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
    }
  }
  if (x1 < 0) throw new Error('no colored letters found in the icon')
  x0 = Math.max(0, x0 - MARGIN); y0 = Math.max(0, y0 - MARGIN)
  x1 = Math.min(w - 1, x1 + MARGIN); y1 = Math.min(h - 1, y1 + MARGIN)
  const W = x1 - x0 + 1
  const H = y1 - y0 + 1
  const out = Buffer.alloc(W * H * 4)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = ((y + y0) * w + (x + x0)) * 4
    const o = (y * W + x) * 4
    const srcA = px[i + 3] / 255
    // How far from white the pixel is: that much of it is ink
    const inkA = Math.max(255 - px[i], 255 - px[i + 1], 255 - px[i + 2]) / 255
    const a = inkA * srcA
    if (inkA > 0) {
      for (let c = 0; c < 3; c++) out[o + c] = Math.max(0, Math.min(255, Math.round((px[i + c] - 255 * (1 - inkA)) / inkA)))
    }
    out[o + 3] = Math.round(a * 255)
  }
  return { w: W, h: H, px: out }
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (buf) => { let c = 0xffffffff; for (const v of buf) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
function encode({ w, h, px }) {
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

const mark = wordmark(decode(SRC))
const png = encode(mark)
fs.writeFileSync(OUT, `// Made by tools/gen-settings-logo.cjs from assets/default.r/icon.png: the app
// icon's wordmark (${mark.w}×${mark.h}, no disc), for the settings page header (do not edit)
export const LOGO_WIDTH = ${mark.w}
export const LOGO_HEIGHT = ${mark.h}
export const LOGO_SRC = 'data:image/png;base64,${png.toString('base64')}'
`)
console.log(`${path.relative(ROOT, OUT)}: ${mark.w}x${mark.h}, ${png.length} B PNG, ${fs.statSync(OUT).size} B module`)
