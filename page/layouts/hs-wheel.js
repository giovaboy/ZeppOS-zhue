// The color wheel of the color picker ("Color" tab), round and square alike:
// the hue turns clockwise from red at the top, the saturation grows from
// white at the center to the edge (assets color-wheel.png, made by
// tools/gen-color-wheel.cjs). It replaced a square with sharp corners that
// touched the brightness slider; on a round screen a disc fits.
//
//          .-""""-.
//        /    ◎     \      the cursor: the color picked, in a white ring
//       |  (white)   |     with a dark edge (seen on white and on yellow)
//        \          /
//          '-....-'
//       ( ☀  100%  ☼ )
//
// A touch outside the disc counts at its edge: the full colors are easy to
// reach.
import { px } from '@zos/utils'
import { widget, event, prop } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { HUE_RANGE, SAT_RANGE, COLORS, hsb2hex } from '../../utils/constants.js'

const { width: DEVICE_WIDTH } = getDeviceInfo()
const WHEEL_D = px(270) // tools/gen-color-wheel.cjs makes the image at 270
const CURSOR = px(34)
const RING = px(4)
const EDGE = px(2)
const PAD = px(20) // touch margin at the wheel's sides

// The wheel's box, centered between the tabs' bottom (top) and the top of
// the slider's touch area (bottom); its touch area fills that band
export function wheelBox(top, bottom) {
  const d = Math.min(WHEEL_D, bottom - top - px(10))
  return { x: Math.round((DEVICE_WIDTH - d) / 2), y: Math.round((top + bottom - d) / 2), w: d, h: d, top, bottom }
}

// hue 0-65535, sat 0-254 → the point on the wheel
function hsToXY(box, hue, sat) {
  const r = box.w / 2
  const a = ((hue || 0) / HUE_RANGE) * 2 * Math.PI
  const d = Math.max(0, Math.min(1, (sat || 0) / SAT_RANGE)) * r
  return { x: box.x + r + Math.sin(a) * d, y: box.y + r - Math.cos(a) * d }
}

// A point (anywhere: outside the disc counts at its edge) → hue, sat
export function xyToHs(box, x, y) {
  const r = box.w / 2
  const dx = x - (box.x + r)
  const dy = y - (box.y + r)
  const a = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI)
  return {
    hue: Math.round((a / (2 * Math.PI)) * HUE_RANGE) % (HUE_RANGE + 1),
    sat: Math.round(Math.min(1, Math.sqrt(dx * dx + dy * dy) / r) * SAT_RANGE)
  }
}

// The color the wheel shows at hue, sat (full brightness, as the image)
function wheelColor(hue, sat) {
  return hsb2hex(((hue || 0) / HUE_RANGE) * 360, ((sat || 0) / SAT_RANGE) * 100, 100)
}

// The cursor's three discs: dark edge, white ring, the color
function cursorDiscs(cx, cy, color) {
  return [
    [CURSOR + EDGE * 2, COLORS.black],
    [CURSOR, COLORS.white],
    [CURSOR - RING * 2, color]
  ].map(([s, c]) => ({ x: Math.round(cx - s / 2), y: Math.round(cy - s / 2), w: s, h: s, radius: Math.floor(s / 2), color: c }))
}

// Moves the cursor (page.state.cursorWidgets) to hue, sat. A FILL_RECT moves
// with setProperty(prop.MORE); a CIRCLE doesn't (the old cursor stayed put
// while dragging)
export function moveWheelCursor(page, box, hue, sat) {
  const ws = page.state.cursorWidgets
  if (!ws) return
  const { x, y } = hsToXY(box, hue, sat)
  cursorDiscs(x, y, wheelColor(hue, sat)).forEach((g, i) => {
    try { ws[i].setProperty(prop.MORE, g) } catch (e) {}
  })
}

export function renderWheel(page, box, hue, sat, onDragColor) {
  page.createTrackedWidget(widget.IMG, { x: box.x, y: box.y, w: box.w, h: box.h, auto_scale: true, src: 'color-wheel.png' })
  const { x, y } = hsToXY(box, hue, sat)
  page.state.cursorWidgets = cursorDiscs(x, y, wheelColor(hue, sat)).map((g) => {
    const w = page.createTrackedWidget(widget.FILL_RECT, g)
    try { w.setEnable(false) } catch (e) {} // touches go to the hitbox
    return w
  })
  const hitbox = page.createTrackedWidget(widget.FILL_RECT, {
    x: box.x - PAD, y: box.top, w: box.w + PAD * 2, h: box.bottom - box.top,
    color: 0, alpha: 0
  })
  hitbox.addEventListener(event.CLICK_DOWN, (info) => onDragColor('DOWN', info))
  hitbox.addEventListener(event.MOVE, (info) => onDragColor('MOVE', info))
  hitbox.addEventListener(event.CLICK_UP, (info) => onDragColor('UP', info))
}
