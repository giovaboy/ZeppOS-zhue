#!/usr/bin/env node
// Checks that every icon mask stays opaque once Zeus converts it for the watch.
//
// The icons (assets/default.*/icons, icons/groups) are masks: #333333 with the
// shape cut out, drawn over a FILL_RECT of the light's color. Zeus converts
// each PNG to an 8-bit palette TGA (zpm PNG2TGA, TGA_L8_ARGB8888_*), and its
// quantizer gave some masks a translucent palette entry: a19's #333333 came
// out with alpha 227, and the light's color showed through as a square around
// the bulb (zhue, 2026-11-02). Which icons it hits doesn't follow a rule, so
// this runs zpm's own converter on each one and reads back the mask's alpha.
//
// Usage: node tools/check-icon-masks.cjs [path/to/png2tga.node.js]
// (default: node_modules/@zeppos/zpm/bin/png2tga.node.js; .cjs so that Zeus
// doesn't bundle it)
//
// A failing icon was fixed by rewriting it with every pixel #333333 and only
// the alpha varying, then snapping near-opaque / near-clear edge pixels to
// 255 / 0 until the converted mask came out opaque (see the commit that
// added this script).
const fs = require('fs')
const os = require('os')
const path = require('path')
const zlib = require('zlib')

const ROOT = path.join(__dirname, '..')
const CONVERTER = process.argv[2] || path.join(ROOT, 'node_modules/@zeppos/zpm/bin/png2tga.node.js')
// The palette formats of zpm (L8_ARGB8888 for GCNANOLITE, DAVE2D,
// MHS003VGLITE): the watch's chip picks one. Format 5 (MHS002SNEMAP) lays its
// pixels out differently (width not padded to 16, data not one index per
// pixel) and this reader can't check it; the icons fine on a device were
// flagged there, so it is left out
const FORMATS = { 0: 'GCNANOLITE', 1: 'DAVE2D', 7: 'MHS003VGLITE' }
const DIRS = ['assets/default.r/icons', 'assets/default.r/icons/groups', 'assets/default.s/icons', 'assets/default.s/icons/groups']

// 8-bit RGBA PNG, non-interlaced (what the icons are): the alpha of the mask
function pngMaskAlpha(file) {
  const b = fs.readFileSync(file)
  if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0) return null
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
  const out = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? out[y * stride + x - 4] : 0
      const u = y ? out[(y - 1) * stride + x] : 0
      const c = x >= 4 && y ? out[(y - 1) * stride + x - 4] : 0
      let v = raw[y * (stride + 1) + 1 + x]
      if (f === 1) v += a
      else if (f === 2) v += u
      else if (f === 3) v += (a + u) >> 1
      else if (f === 4) { const p = a + u - c; const pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c }
      out[y * stride + x] = v & 255
    }
  }
  return out[2 * stride + 2 * 4 + 3] // a corner pixel (2,2): the mask
}

// The most used visible palette entry of a converted TGA: the mask
function tgaMaskAlpha(file) {
  const b = fs.readFileSync(file)
  const cmFirst = b.readUInt16LE(3)
  const cmLen = b.readUInt16LE(5)
  const cmBytes = b[7] / 8
  const w = b.readUInt16LE(12)
  const h = b.readUInt16LE(14)
  const palAt = 18 + b[0]
  const dataAt = palAt + cmLen * cmBytes
  const alphaOf = (i) => b[palAt + (i - cmFirst) * cmBytes + 3]
  const counts = new Map()
  for (let i = 0; i < w * h; i++) counts.set(b[dataAt + i], (counts.get(b[dataAt + i]) || 0) + 1)
  const [idx] = [...counts].sort((x, y) => y[1] - x[1]).find(([i]) => alphaOf(i) > 0)
  return alphaOf(idx)
}

if (!fs.existsSync(CONVERTER)) {
  console.error(`zpm's converter not found at ${CONVERTER}: run npm install, or pass its path`)
  process.exit(2)
}
const M = require(CONVERTER)
M.onRuntimeInitialized = () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-masks-'))
  let checked = 0
  const bad = []
  for (const dir of DIRS) {
    const abs = path.join(ROOT, dir)
    if (!fs.existsSync(abs)) continue
    for (const name of fs.readdirSync(abs).filter((f) => f.endsWith('.png'))) {
      const src = path.join(abs, name)
      if (pngMaskAlpha(src) !== 255) continue // not a mask icon
      checked++
      for (const [fmt, chip] of Object.entries(FORMATS)) {
        const dst = path.join(tmp, `${fmt}.tga`)
        const s = M.allocateUTF8(src)
        const d = M.allocateUTF8(dst)
        M._convert(s, d, Number(fmt))
        M._free(s)
        M._free(d)
        const alpha = tgaMaskAlpha(dst)
        if (alpha !== 255) bad.push(`${dir}/${name}: mask alpha ${alpha} with ${chip}`)
      }
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true })
  if (bad.length) {
    console.log(`${bad.length} translucent masks after conversion (${checked} icons checked):\n${bad.join('\n')}`)
    process.exit(1)
  }
  console.log(`${checked} icon masks checked in ${Object.keys(FORMATS).length} formats: all opaque`)
}
