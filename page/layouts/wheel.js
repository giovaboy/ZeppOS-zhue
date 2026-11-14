// The two wheels of the color picker, round and square alike, same size and
// place, same cursor (as the Hue app does for both):
//   Color  the hue turns clockwise from red at the top, the saturation grows
//          from white at the center to the edge (color-wheel.png)
//   White  warm at the top, cold at the bottom: only the height counts, the
//          cursor goes where the finger is (ct-wheel.png)
// Both images are made by tools/gen-wheels.cjs.
//
//          .-""""-.
//        /    ◎     \      the cursor: the color picked, in a white ring
//       |            |     with a dark edge (seen on white and on yellow)
//        \          /
//          '-....-'
//       ( ☀  100%  ☼ )
//
// They replaced a square with sharp corners that touched the brightness
// slider, and a vertical bar whose knob went over the tabs. A touch outside
// the disc counts at its edge: the ends are easy to reach.
import { px } from '@zos/utils'
import { widget, event, prop } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { HUE_RANGE, SAT_RANGE, CT_MIN, CT_MAX, COLORS, hsb2hex, ct2hex } from '../../utils/constants.js'

const { width: DEVICE_WIDTH } = getDeviceInfo()
const WHEEL_D = px(270) // tools/gen-wheels.cjs makes the images at 270
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

// A point, brought inside the disc
function inDisc(box, x, y) {
  const r = box.w / 2
  const dx = x - (box.x + r)
  const dy = y - (box.y + r)
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d <= r) return { x, y }
  return { x: box.x + r + (dx / d) * r, y: box.y + r + (dy / d) * r }
}

// --- Color: hue 0-65535, sat 0-254 ---

function hsToXY(box, hue, sat) {
  const r = box.w / 2
  const a = ((hue || 0) / HUE_RANGE) * 2 * Math.PI
  const d = Math.max(0, Math.min(1, (sat || 0) / SAT_RANGE)) * r
  return { x: box.x + r + Math.sin(a) * d, y: box.y + r - Math.cos(a) * d }
}

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
function hsColor(hue, sat) {
  return hsb2hex(((hue || 0) / HUE_RANGE) * 360, ((sat || 0) / SAT_RANGE) * 100, 100)
}

// --- White: ct in mireds, CT_MAX (warm) at the top, CT_MIN at the bottom ---

function ctToY(box, ct) {
  const c = Math.max(CT_MIN, Math.min(CT_MAX, ct || CT_MIN))
  return box.y + ((CT_MAX - c) / (CT_MAX - CT_MIN)) * box.h
}

// A touch → { ct, x, y }: the cursor's point (in the disc) and its ct
export function xyToCt(box, x, y) {
  const p = inDisc(box, x, y)
  const t = Math.max(0, Math.min(1, (p.y - box.y) / box.h))
  return { ct: Math.round(CT_MAX - t * (CT_MAX - CT_MIN)), x: p.x, y: p.y }
}

// --- The cursor: dark edge, white ring, the color ---

function cursorDiscs(cx, cy, color) {
  return [
    [CURSOR + EDGE * 2, COLORS.black],
    [CURSOR, COLORS.white],
    [CURSOR - RING * 2, color]
  ].map(([s, c]) => ({ x: Math.round(cx - s / 2), y: Math.round(cy - s / 2), w: s, h: s, radius: Math.floor(s / 2), color: c }))
}

// A FILL_RECT moves with setProperty(prop.MORE); a CIRCLE doesn't (the old
// cursor stayed put while dragging)
function moveCursor(widgets, x, y, color) {
  if (!widgets) return
  cursorDiscs(x, y, color).forEach((g, i) => {
    try { widgets[i].setProperty(prop.MORE, g) } catch (e) {}
  })
}

export function moveHsCursor(page, box, hue, sat) {
  const { x, y } = hsToXY(box, hue, sat)
  moveCursor(page.state.cursorWidgets, x, y, hsColor(hue, sat))
}

// x, y: where the finger is (from xyToCt); none: the center line
export function moveCtCursor(page, box, ct, x, y) {
  moveCursor(page.state.ctCursorWidgets, x ?? box.x + box.w / 2, y ?? ctToY(box, ct), ct2hex(ct))
}

// The image, the cursor at (x, y), the touch area; returns the cursor widgets
function renderWheel(page, box, src, x, y, color, onDrag) {
  page.createTrackedWidget(widget.IMG, { x: box.x, y: box.y, w: box.w, h: box.h, auto_scale: true, src })
  const cursor = cursorDiscs(x, y, color).map((g) => {
    const w = page.createTrackedWidget(widget.FILL_RECT, g)
    try { w.setEnable(false) } catch (e) {} // touches go to the hitbox
    return w
  })
  const hitbox = page.createTrackedWidget(widget.FILL_RECT, {
    x: box.x - PAD, y: box.top, w: box.w + PAD * 2, h: box.bottom - box.top,
    color: 0, alpha: 0
  })
  hitbox.addEventListener(event.CLICK_DOWN, (info) => onDrag('DOWN', info))
  hitbox.addEventListener(event.MOVE, (info) => onDrag('MOVE', info))
  hitbox.addEventListener(event.CLICK_UP, (info) => onDrag('UP', info))
  return cursor
}

export function renderHsWheel(page, box, hue, sat, onDragColor) {
  const { x, y } = hsToXY(box, hue, sat)
  page.state.cursorWidgets = renderWheel(page, box, 'color-wheel.png', x, y, hsColor(hue, sat), onDragColor)
}

export function renderCtWheel(page, box, ct, onDragCT) {
  page.state.ctCursorWidgets = renderWheel(page, box, 'ct-wheel.png', box.x + box.w / 2, ctToY(box, ct), ct2hex(ct), onDragCT)
}
