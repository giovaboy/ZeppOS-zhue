// "Working" animations, after http-buttons' utils/button-loader.js:
//   breath  the border of a control breathes (a stroke whose width grows and
//           shrinks) while its command is on its way: a command takes 1-2.7 s
//           to reach the light, and nothing showed meanwhile
//   dot     a disc that pulses (grows and shrinks), where there is no control
//           to animate: a page loading (Zepp: a loading state is always
//           animated; it was a still "Loading" text)
// One interval drives every running animation, at TICK_MS, and stops when
// none is left. A page's timers die with it: the page stops its animations
// before redrawing (stopPulses) and in onDestroy.
// Field notes: a CIRCLE doesn't move with setProperty, a FILL_RECT rounded
// into a disc does; a STROKE_RECT's line_width changes only with its whole
// geometry in setProperty(prop.MORE).
import { createWidget, deleteWidget, widget, prop } from '@zos/ui'
import { px } from '@zos/utils'
import { COLORS } from './constants.js'
import { devLog, LOG_TRACE } from './remote-log.js'

const TICK_MS = 40 // 25 frames per second, a frame every other tick
// One breath (~1 s): stroke widths, a frame each
const BREATH = [1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 1, 1]
// One pulse of the dot (~1 s): its size, as a share of the full one
const DOT = [0.5, 0.6, 0.72, 0.84, 0.95, 1, 1, 0.95, 0.84, 0.72, 0.6, 0.5]

const running = new Set()
let ticker = null
let tick = 0

function make(parent, type, props) {
  return parent ? parent.createWidget(type, props) : createWidget(type, props)
}

function ensureTicker() {
  if (ticker) return
  tick = 0
  ticker = setInterval(() => {
    tick++
    if (tick % 2) return
    const frame = tick / 2
    for (const a of running) {
      try { a.frame(frame); a.frames++ } catch (e) {
        // Its widget is gone (a redraw): it stops
        if (++a.errors > 2) stopPulse(a)
      }
    }
  }, TICK_MS)
}

function register(owner, a) {
  a.owner = owner
  a.t0 = Date.now()
  a.frames = 0
  a.errors = 0
  running.add(a)
  if (owner) (owner._pulses || (owner._pulses = new Set())).add(a)
  ensureTicker()
  return a
}

// White on dark controls, black on light ones (a white or yellow favorite)
export function contrastColor(back) {
  const c = Number(back) || 0
  const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? COLORS.black : COLORS.white
}

// The border of { x, y, w, h, radius } breathes, in `color`, in `parent` (a
// VIEW_CONTAINER) or on the page
export function startBreath(owner, { x, y, w, h, radius = 0, parent = null, label = 'control' }, color = COLORS.white) {
  const geometry = { x, y, w, h, radius, color }
  const stroke = make(parent, widget.STROKE_RECT, { ...geometry, line_width: 1 })
  try { stroke.setEnable(false) } catch (e) {} // taps go to the control
  return register(owner, {
    kind: 'breath',
    label,
    widget: stroke,
    frame(i) {
      stroke.setProperty(prop.MORE, { ...geometry, line_width: px(BREATH[i % BREATH.length]) })
    }
  })
}

// A disc of `size` centered on (cx, cy) that pulses
export function startDot(owner, { cx, cy, size = px(18), color = COLORS.white, parent = null, label = 'loading' }) {
  const disc = make(parent, widget.FILL_RECT, {
    x: cx - size / 2, y: cy - size / 2, w: size, h: size, radius: size / 2, color
  })
  try { disc.setEnable(false) } catch (e) {}
  return register(owner, {
    kind: 'dot',
    label,
    widget: disc,
    frame(i) {
      const s = Math.max(2, Math.round(size * DOT[i % DOT.length]))
      disc.setProperty(prop.MORE, { x: Math.round(cx - s / 2), y: Math.round(cy - s / 2), w: s, h: s, radius: Math.floor(s / 2), color })
    }
  })
}

export function stopPulse(a) {
  if (!a || !running.has(a)) return
  running.delete(a)
  if (a.owner && a.owner._pulses) a.owner._pulses.delete(a)
  try { deleteWidget(a.widget) } catch (e) {}
  if (LOG_TRACE) devLog(`[anim] ${a.kind} ${a.label}: ${a.frames} frames in ${Date.now() - a.t0}ms`)
  if (!running.size && ticker) { clearInterval(ticker); ticker = null }
}

// Every animation of a page: before it redraws, and in its onDestroy
export function stopPulses(owner) {
  if (!owner || !owner._pulses) return
  for (const a of [...owner._pulses]) stopPulse(a)
}

// While fn's promise runs, the page's control `key` breathes (its geometry
// from the items the layout registered for the keys, page._nav). An item's
// `busy` geometry, when it has one, is the control that sends the command
// inside a wider row (a group's ON/OFF badge, a light's icon): the keys
// highlight the row, the breath that control. Returns fn's promise, for the
// request queue
export function busyOn(page, key, fn, color) {
  const item = page && page._nav && page._nav.items.find((it) => it.key === key)
  const a = item ? startBreath(page, { ...item, ...(item.busy || {}), label: key }, color) : null
  let p
  try { p = fn() } catch (e) { stopPulse(a); throw e }
  return Promise.resolve(p).then(
    (v) => { stopPulse(a); return v },
    (e) => { stopPulse(a); throw e }
  )
}
