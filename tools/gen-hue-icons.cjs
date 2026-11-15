#!/usr/bin/env node
// The lamp-type icons, as the Hue app draws them: one per type a light can be
// given in the Hue app (its "archetype", utils/constants.js ARCHETYPE_ICONS),
// made from the SVGs of hass-hue-icons (CC BY-NC-SA 4.0, credited in the
// README), the set modelled on the Hue app, as the other icons were by hand.
//
//   node tools/gen-hue-icons.cjs [path/to/png2tga.node.js]
//   (downloads the SVGs it lacks; the converter as for check-icon-masks.cjs)
//
// Each SVG is one path in a 24×24 box; it becomes a mask as the hand-made
// ones are: 70×70, #333333 opaque with the lamp's shape cut out (transparent,
// antialiased), the 24 units scaled to 70 px, centered (bulb-classic so comes
// out where a19.png has its hole). Written as hue-<name>.png in
// assets/default.{r,s}/icons.
// Zeus's converter makes some masks translucent (check-icon-masks.cjs: the
// light's color showed through as a square): each mask is converted here as
// Zeus will, and if it comes out translucent its edge pixels are snapped to
// opaque / clear, a little more each time, until it doesn't (hue-play-bar
// and hue-desk-lamp needed it)
// (.cjs so that Zeus doesn't bundle it)
const fs = require('fs')
const os = require('os')
const path = require('path')
const { encode } = require('./png.cjs')

const ROOT = path.join(__dirname, '..')
const SVG_DIR = path.join(__dirname, 'hue-svgs')
const OUT_DIRS = ['assets/default.r/icons', 'assets/default.s/icons']
const SVG_URL = 'https://raw.githubusercontent.com/arallsopp/hass-hue-icons/main/docs/svgs/'
const NAMES = [
  'bulb-classic', 'bulb-sultan', 'bulb-candle', 'bulb-flood', 'bulb-spot', 'bulb-filament',
  'ceiling-round', 'ceiling-square', 'pendant-long', 'pendant-round', 'floor-lantern', 'floor-shade',
  'table-shade', 'table-wash', 'recessed-ceiling', 'recessed-floor', 'single-spot', 'double-spot',
  'wall-lantern', 'wall-shade', 'wall-spot', 'bollard', 'go', 'iris', 'bloom', 'lightstrip',
  'play-bar', 'plug', 'desk-lamp', 'floor-spot'
]
const SIZE = 70
const SCALE = SIZE / 24
const SS = 8 // supersampling per axis
const MASK = [0x33, 0x33, 0x33]
const CONVERTER = process.argv[2] || path.join(ROOT, 'node_modules/@zeppos/zpm/bin/png2tga.node.js')
const FORMATS = [0, 1, 7] // zpm's palette formats, as check-icon-masks.cjs

// --- the path, as polygons (curves and arcs flattened) ---

function tokens(d) {
  return d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || []
}

function flatten(d) {
  const t = tokens(d)
  const polys = []
  let poly = null
  let i = 0, cmd = null
  let x = 0, y = 0, sx = 0, sy = 0
  let lcx = null, lcy = null, lqx = null, lqy = null // last control points
  const num = () => parseFloat(t[i++])
  const isNum = () => i < t.length && !/[A-Za-z]/.test(t[i])
  const line = (nx, ny) => { poly.push([nx, ny]); x = nx; y = ny }
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    const x0 = x, y0 = y
    for (let k = 1; k <= 24; k++) {
      const s = k / 24, u = 1 - s
      poly.push([u * u * u * x0 + 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s * x3,
        u * u * u * y0 + 3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s * y3])
    }
    x = x3; y = y3
  }
  const quad = (x1, y1, x2, y2) => {
    const x0 = x, y0 = y
    for (let k = 1; k <= 16; k++) {
      const s = k / 16, u = 1 - s
      poly.push([u * u * x0 + 2 * u * s * x1 + s * s * x2, u * u * y0 + 2 * u * s * y1 + s * s * y2])
    }
    x = x2; y = y2
  }
  // SVG arc, endpoint form → center form (SVG 1.1, F.6.5)
  const arc = (rx, ry, phi, large, sweep, x2, y2) => {
    const x1 = x, y1 = y
    if (!rx || !ry) return line(x2, y2)
    rx = Math.abs(rx); ry = Math.abs(ry)
    const p = (phi * Math.PI) / 180, cp = Math.cos(p), sp = Math.sin(p)
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2
    const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy
    const l = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if (l > 1) { rx *= Math.sqrt(l); ry *= Math.sqrt(l) }
    const num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    let co = Math.sqrt(Math.max(0, num2 / den))
    if (large === sweep) co = -co
    const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx
    const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2
    const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if (!sweep && dth > 0) dth -= 2 * Math.PI
    if (sweep && dth < 0) dth += 2 * Math.PI
    const n = Math.max(8, Math.ceil(Math.abs(dth) / (Math.PI / 24)))
    for (let k = 1; k <= n; k++) {
      const a = th1 + (dth * k) / n
      poly.push([cx + rx * Math.cos(a) * cp - ry * Math.sin(a) * sp, cy + rx * Math.cos(a) * sp + ry * Math.sin(a) * cp])
    }
    x = x2; y = y2
  }
  while (i < t.length) {
    if (!isNum()) cmd = t[i++]
    const rel = cmd === cmd.toLowerCase()
    const ox = rel ? x : 0, oy = rel ? y : 0
    switch (cmd.toUpperCase()) {
      case 'M': {
        const nx = num() + ox, ny = num() + oy
        poly = [[nx, ny]]; polys.push(poly)
        x = sx = nx; y = sy = ny
        cmd = rel ? 'l' : 'L' // further pairs are lines
        lcx = lqx = null
        break
      }
      case 'L': line(num() + ox, num() + oy); lcx = lqx = null; break
      case 'H': line(num() + ox, y); lcx = lqx = null; break
      case 'V': line(x, num() + oy); lcx = lqx = null; break
      case 'C': {
        const a = [num() + ox, num() + oy, num() + ox, num() + oy, num() + ox, num() + oy]
        cubic(...a); lcx = a[2]; lcy = a[3]; lqx = null
        break
      }
      case 'S': {
        const x1 = lcx === null ? x : 2 * x - lcx, y1 = lcy === null ? y : 2 * y - lcy
        const a = [num() + ox, num() + oy, num() + ox, num() + oy]
        cubic(x1, y1, ...a); lcx = a[0]; lcy = a[1]; lqx = null
        break
      }
      case 'Q': {
        const a = [num() + ox, num() + oy, num() + ox, num() + oy]
        quad(...a); lqx = a[0]; lqy = a[1]; lcx = null
        break
      }
      case 'T': {
        const x1 = lqx === null ? x : 2 * x - lqx, y1 = lqy === null ? y : 2 * y - lqy
        quad(x1, y1, num() + ox, num() + oy); lqx = x1; lqy = y1; lcx = null
        break
      }
      case 'A': {
        const rx = num(), ry = num(), phi = num(), large = num(), sweep = num()
        arc(rx, ry, phi, !!large, !!sweep, num() + ox, num() + oy); lcx = lqx = null
        break
      }
      case 'Z':
        line(sx, sy); lcx = lqx = null
        // a new subpath may start here without an M
        poly = [[sx, sy]]; polys.push(poly)
        break
      default:
        throw new Error(`path command ${cmd}`)
    }
  }
  return polys.filter((p) => p.length > 2)
}

// --- the mask: nonzero fill (SVG's default), supersampled by rows ---

function mask(d) {
  const edges = []
  for (const p of flatten(d)) {
    for (let k = 0; k < p.length; k++) {
      const [ax, ay] = p[k], [bx, by] = p[(k + 1) % p.length]
      if (ay !== by) edges.push([ax * SCALE, ay * SCALE, bx * SCALE, by * SCALE])
    }
  }
  const cover = new Float64Array(SIZE * SIZE)
  for (let r = 0; r < SIZE * SS; r++) {
    const py = (r + 0.5) / SS
    // where the edges cross this row, with their direction
    const xs = []
    for (const [x0, y0, x1, y1] of edges) {
      if ((y0 <= py) !== (y1 <= py)) xs.push([x0 + ((py - y0) * (x1 - x0)) / (y1 - y0), y1 > y0 ? 1 : -1])
    }
    xs.sort((a, b) => a[0] - b[0])
    const y = Math.floor(py)
    let w = 0, k = 0
    for (let c = 0; c < SIZE * SS; c++) {
      const px = (c + 0.5) / SS
      while (k < xs.length && xs[k][0] <= px) w += xs[k++][1]
      if (w !== 0) cover[y * SIZE + Math.floor(px)]++
    }
  }
  // the shape: transparent
  return Array.from(cover, (c) => Math.round(255 * (1 - c / (SS * SS))))
}

// The PNG, its alpha snapped: within `snap` of opaque / clear, made so
function png(alpha, snap) {
  const out = Buffer.alloc(SIZE * SIZE * 4)
  alpha.forEach((a, i) => {
    out[i * 4] = MASK[0]; out[i * 4 + 1] = MASK[1]; out[i * 4 + 2] = MASK[2]
    out[i * 4 + 3] = a >= 255 - snap ? 255 : a <= snap ? 0 : a
  })
  return encode(SIZE, SIZE, out)
}

// The most used visible palette entry of a converted TGA (the mask): its alpha
function tgaMaskAlpha(file) {
  const b = fs.readFileSync(file)
  const cmFirst = b.readUInt16LE(3), cmLen = b.readUInt16LE(5), cmBytes = b[7] / 8
  const w = b.readUInt16LE(12), h = b.readUInt16LE(14)
  const palAt = 18 + b[0], dataAt = palAt + cmLen * cmBytes
  const alphaOf = (i) => b[palAt + (i - cmFirst) * cmBytes + 3]
  const counts = new Map()
  for (let i = 0; i < w * h; i++) counts.set(b[dataAt + i], (counts.get(b[dataAt + i]) || 0) + 1)
  const [idx] = [...counts].sort((x, y) => y[1] - x[1]).find(([i]) => alphaOf(i) > 0)
  return alphaOf(idx)
}

function opaqueOnWatch(M, buf, tmp) {
  const src = path.join(tmp, 'icon.png')
  fs.writeFileSync(src, buf)
  return FORMATS.every((fmt) => {
    const dst = path.join(tmp, `${fmt}.tga`)
    const sp = M.allocateUTF8(src), dp = M.allocateUTF8(dst)
    M._convert(sp, dp, fmt)
    M._free(sp); M._free(dp)
    return tgaMaskAlpha(dst) === 255
  })
}

async function main(M) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hue-icons-'))
  const snapped = []
  fs.mkdirSync(SVG_DIR, { recursive: true })
  for (const name of NAMES) {
    const file = path.join(SVG_DIR, `${name}.svg`)
    if (!fs.existsSync(file)) {
      const res = await fetch(`${SVG_URL}${name}.svg`)
      if (!res.ok) throw new Error(`${name}.svg: HTTP ${res.status}`)
      fs.writeFileSync(file, await res.text())
    }
    const svg = fs.readFileSync(file, 'utf8')
    const ds = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])
    if (ds.length !== 1 || /<(circle|rect|ellipse|polygon|g)\b|transform=|fill-rule="evenodd"/.test(svg)) {
      throw new Error(`${name}.svg: not one plain path`)
    }
    const alpha = mask(ds[0])
    let snap = 0
    let buf = png(alpha, snap)
    while (!opaqueOnWatch(M, buf, tmp)) {
      snap += 8
      if (snap > 127) throw new Error(`hue-${name}: still translucent once converted`)
      buf = png(alpha, snap)
    }
    if (snap) snapped.push(`hue-${name} (${snap})`)
    for (const dir of OUT_DIRS) fs.writeFileSync(path.join(ROOT, dir, `hue-${name}.png`), buf)
  }
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`${NAMES.length} icons in ${OUT_DIRS.join(', ')} (hue-<name>.png)${snapped.length ? `; edges snapped: ${snapped.join(', ')}` : ''}`)
}

if (!fs.existsSync(CONVERTER)) {
  console.error(`zpm's converter not found at ${CONVERTER}: run npm install, or pass its path`)
  process.exit(2)
}
const M = require(CONVERTER)
M.onRuntimeInitialized = () => main(M).catch((e) => { console.error(e.message); process.exit(1) })
