#!/usr/bin/env node
// The bridge with its link button, for the pairing screen (page/layouts/
// index.js): tools/push-link-src.png, black on clear, drawn in the app's
// purple (utils/constants.js COLORS.highlight; the screen is black, as every
// page; it was black on an orange screen, then white).
//   node tools/gen-push-link.cjs      (.cjs so that Zeus doesn't bundle it)
const fs = require('fs')
const path = require('path')
const { decode, encode } = require('./png.cjs')

const ROOT = path.join(__dirname, '..')
const COLOR = [0x98, 0x4c, 0xe5] // COLORS.highlight
const src = decode(path.join(__dirname, 'push-link-src.png'))
const out = Buffer.alloc(src.w * src.h * 4)
for (let y = 0; y < src.h; y++) {
  for (let x = 0; x < src.w; x++) {
    const o = (y * src.w + x) * 4
    out[o] = COLOR[0]; out[o + 1] = COLOR[1]; out[o + 2] = COLOR[2]
    out[o + 3] = src.alpha(x, y)
  }
}
const png = encode(src.w, src.h, out)
for (const dir of ['assets/default.r', 'assets/default.s']) fs.writeFileSync(path.join(ROOT, dir, 'push-link.png'), png)
console.log(`assets/default.{r,s}/push-link.png: ${src.w}×${src.h}, purple`)
