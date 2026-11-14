#!/usr/bin/env node
// Makes assets/default.{r,s}/ct-picker.png: the color temperature bar of the
// color picker, a horizontal pill (rounded ends, as the brightness slider
// under it), warm on the left, cold on the right (page/layouts/ct-bar.js).
// An IMG ignores `radius` on Zepp OS: the ends are transparent pixels.
// The gradient is read from the image's long center line (a vertical image:
// cold on top), so the script can run again on its own output:
//   node tools/gen-ct-picker.cjs
// (.cjs so that Zeus doesn't bundle it)
const fs = require('fs')
const path = require('path')
const { decode, encode } = require('./png.cjs')

const ROOT = path.join(__dirname, '..')
const FILES = ['assets/default.r/ct-picker.png', 'assets/default.s/ct-picker.png']
// The size it is drawn at on a 480 px screen (page/layouts/ct-bar.js:
// BAR_W × BAR_H): auto_scale keeps the ends round
const W = 300
const H = 56
const RADIUS = H / 2
const SS = 4 // supersampling of the edges

// How much of the pixel (x, y) is inside the pill
function coverage(x, y) {
  let n = 0
  for (let i = 0; i < SS; i++) {
    for (let j = 0; j < SS; j++) {
      const sx = x + (i + 0.5) / SS
      const sy = y + (j + 0.5) / SS
      const cx = Math.min(Math.max(sx, RADIUS), W - RADIUS)
      if ((sx - cx) ** 2 + (sy - RADIUS) ** 2 <= RADIUS ** 2) n++
    }
  }
  return n / (SS * SS)
}

// The gradient, warm (t = 0) to cold (t = 1)
const src = decode(path.join(ROOT, FILES[0]))
const at = (t) => src.h > src.w
  ? src.rgb(src.w >> 1, Math.round((1 - t) * (src.h - 1)))
  : src.rgb(Math.round(t * (src.w - 1)), src.h >> 1)
const out = Buffer.alloc(W * H * 4)
for (let x = 0; x < W; x++) {
  const [r, g, b] = at(x / (W - 1))
  for (let y = 0; y < H; y++) {
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
