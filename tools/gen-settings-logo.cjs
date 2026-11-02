#!/usr/bin/env node
// Makes setting/logo.js: the app icon (assets/default.r/icon.png, 248×248)
// halved to 124×124 and inlined as a data URI, for the settings page header
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

// Each 2×2 block averaged, colors weighted by their alpha
function halve({ w, h, px }) {
  const W = w >> 1
  const H = h >> 1
  const out = Buffer.alloc(W * H * 4)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, a = 0
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const i = ((y * 2 + dy) * w + (x * 2 + dx)) * 4
      const al = px[i + 3]
      r += px[i] * al; g += px[i + 1] * al; b += px[i + 2] * al; a += al
    }
    const o = (y * W + x) * 4
    if (a) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a) }
    out[o + 3] = Math.round(a / 4)
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

const png = encode(halve(decode(SRC)))
fs.writeFileSync(OUT, `// Made by tools/gen-settings-logo.cjs from assets/default.r/icon.png: the app
// icon at 124×124, for the settings page header (do not edit)
export const LOGO_SRC = 'data:image/png;base64,${png.toString('base64')}'
`)
console.log(`${path.relative(ROOT, OUT)}: ${png.length} B PNG, ${fs.statSync(OUT).size} B module`)
