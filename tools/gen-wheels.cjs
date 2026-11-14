#!/usr/bin/env node
// Makes the two wheels of the color picker (page/layouts/wheel.js), in
// assets/default.{r,s}/:
//   color-wheel.png  the hue turns clockwise from red at the top, the
//                    saturation grows from white at the center to the full
//                    color at the edge, at full brightness (the brightness is
//                    the slider under it)
//   ct-wheel.png     the color temperature: warm at the top, cold at the
//                    bottom (the gradient of the old vertical bar)
// Outside the disc the pixels are transparent, the edge antialiased.
//   node tools/gen-wheels.cjs
// (.cjs so that Zeus doesn't bundle it)
const fs = require('fs')
const path = require('path')
const { encode } = require('./png.cjs')

const ROOT = path.join(__dirname, '..')
const DIRS = ['assets/default.r', 'assets/default.s']
// The size they are drawn at on a 480 px screen (wheel.js: WHEEL_D);
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

// The color temperature from warm (t = 0, 500 mireds) to cold (t = 1, 153):
// stops of the old bar's gradient, every eighth
const CT_STOPS = [
  [255, 136, 13], [255, 145, 37], [255, 155, 62], [255, 166, 87], [255, 179, 113],
  [255, 193, 142], [255, 209, 173], [255, 229, 209], [255, 254, 250]
]
function ctColor(t) {
  const f = Math.max(0, Math.min(1, t)) * (CT_STOPS.length - 1)
  const i = Math.min(CT_STOPS.length - 2, Math.floor(f))
  const k = f - i
  return CT_STOPS[i].map((v, c) => Math.round(v + (CT_STOPS[i + 1][c] - v) * k))
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

function wheel(colorAt) {
  const out = Buffer.alloc(D * D * 4)
  for (let y = 0; y < D; y++) {
    for (let x = 0; x < D; x++) {
      const [r, g, b] = colorAt(x + 0.5 - R, y + 0.5 - R)
      const o = (y * D + x) * 4
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
      out[o + 3] = Math.round(coverage(x, y) * 255)
    }
  }
  return encode(D, D, out)
}

const images = {
  // 0° at the top, clockwise (y grows downwards)
  'color-wheel.png': wheel((dx, dy) => hsv(
    ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360,
    Math.min(1, Math.sqrt(dx * dx + dy * dy) / R)
  )),
  'ct-wheel.png': wheel((dx, dy) => ctColor((dy + R) / D))
}
for (const [name, png] of Object.entries(images)) {
  for (const dir of DIRS) fs.writeFileSync(path.join(ROOT, dir, name), png)
  console.log(`${DIRS.map((d) => `${d}/${name}`).join(', ')}: ${D}×${D}, ${png.length} bytes`)
}
