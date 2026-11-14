#!/usr/bin/env node
// Makes assets/default.{r,s}/color-wheel.png: the color wheel of the color
// picker (page/layouts/hs-wheel.js). The hue turns clockwise from red at the
// top, the saturation grows from white at the center to the full color at the
// edge, at full brightness (the brightness is the slider under it). Outside
// the disc the pixels are transparent, the edge antialiased.
//   node tools/gen-color-wheel.cjs
// (.cjs so that Zeus doesn't bundle it)
const fs = require('fs')
const path = require('path')
const { encode } = require('./png.cjs')

const ROOT = path.join(__dirname, '..')
const FILES = ['assets/default.r/color-wheel.png', 'assets/default.s/color-wheel.png']
// The size it is drawn at on a 480 px screen (hs-wheel.js: WHEEL_D);
// auto_scale for the others
const D = 270
const R = D / 2
const SS = 4 // supersampling of the edge

// h 0-360, s 0-1, at full value: as hsb2hex in utils/constants.js
function hsv(h, s) {
  const i = Math.floor(h / 60) % 6
  const f = h / 60 - Math.floor(h / 60)
  const p = 1 - s
  const q = 1 - f * s
  const t = 1 - (1 - f) * s
  const [r, g, b] = [[1, t, p], [q, 1, p], [p, 1, t], [p, q, 1], [t, p, 1], [1, p, q]][i]
  return [r, g, b].map((v) => Math.round(v * 255))
}

function coverage(x, y) {
  let n = 0
  for (let i = 0; i < SS; i++) {
    for (let j = 0; j < SS; j++) {
      const dx = x + (i + 0.5) / SS - R
      const dy = y + (j + 0.5) / SS - R
      if (dx * dx + dy * dy <= R * R) n++
    }
  }
  return n / (SS * SS)
}

const out = Buffer.alloc(D * D * 4)
for (let y = 0; y < D; y++) {
  for (let x = 0; x < D; x++) {
    const dx = x + 0.5 - R
    const dy = y + 0.5 - R
    // 0° at the top, clockwise (y grows downwards)
    const hue = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    const sat = Math.min(1, Math.sqrt(dx * dx + dy * dy) / R)
    const [r, g, b] = hsv(hue, sat)
    const o = (y * D + x) * 4
    out[o] = r
    out[o + 1] = g
    out[o + 2] = b
    out[o + 3] = Math.round(coverage(x, y) * 255)
  }
}
const png = encode(D, D, out)
for (const f of FILES) fs.writeFileSync(path.join(ROOT, f), png)
console.log(`${FILES.join(', ')}: ${D}×${D}, ${png.length} bytes`)
