#!/usr/bin/env node
// The card's tiles when pressed (app-widget/index.js): a BUTTON over the
// tile, its images
//   card-tile-normal.png  80×80, clear: the tile shows as it is
//   card-tile-press.png   80×80, a black disc at 28.6%: the whole tile, its
//                         icon and ring with it, darkens (Zepp's pressed
//                         state), as the "zhue" pill does
// A darker tile color alone would leave the icon's #333333 mask square
// showing; and on a card only buttons take taps.
//   node tools/gen-card-press.cjs     (.cjs so that Zeus doesn't bundle it)
const fs = require('fs')
const path = require('path')
const { encode } = require('./png.cjs')

const ROOT = path.join(__dirname, '..')
const DIRS = ['assets/default.r', 'assets/default.s']
const D = 80 // app-widget ICON_SIZE on a 480 px screen (Zeus scales the rest)
const R = D / 2
const SS = 4
const PRESSED = Math.round(255 * 0.286) // −28.6% brightness

function disc(alpha) {
  const out = Buffer.alloc(D * D * 4)
  for (let y = 0; y < D; y++) {
    for (let x = 0; x < D; x++) {
      let n = 0
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          const dx = x + (i + 0.5) / SS - R, dy = y + (j + 0.5) / SS - R
          if (dx * dx + dy * dy <= R * R) n++
        }
      }
      out[(y * D + x) * 4 + 3] = Math.round((alpha * n) / (SS * SS)) // black
    }
  }
  return encode(D, D, out)
}

const images = { 'card-tile-normal.png': disc(0), 'card-tile-press.png': disc(PRESSED) }
for (const [name, png] of Object.entries(images)) {
  for (const dir of DIRS) fs.writeFileSync(path.join(ROOT, dir, name), png)
  console.log(`${DIRS.map((d) => `${d}/${name}`).join(', ')}: ${D}×${D}`)
}
