// The color temperature bar of the color picker ("White" tab), round and
// square alike: a horizontal pill, warm on the left, cold on the right (the
// kelvins grow left to right, as the brightness under it), the knob always
// inside the pill, the temperature above it.
//
//                 2700 K
//        (●▒▒▒▒▒▓▓▓▓▓░░░░░░░░)       300 × 56, between tabs and slider
//
//        ( ☀       87%      ☼ )
//
// It was a vertical bar whose knob, at the ends, went over the tabs or onto
// the brightness slider.
import { px } from '@zos/utils'
import { widget, align, event } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { CT_MIN, CT_MAX, COLORS } from '../../utils/constants.js'

const { width: DEVICE_WIDTH } = getDeviceInfo()
const BAR_W = px(300)
const BAR_H = px(56) // tools/gen-ct-picker.cjs makes ct-picker.png at 300 × 56
const KNOB = BAR_H - px(12)
const LABEL_H = px(36)

// The bar's box, centered between the tabs' bottom and the slider's top
export function ctBarBox(top, bottom) {
  const blockH = LABEL_H + px(8) + BAR_H
  const y = Math.round((top + bottom - blockH) / 2) + LABEL_H + px(8)
  return { x: (DEVICE_WIDTH - BAR_W) / 2, y, w: BAR_W, h: BAR_H }
}

// The knob's center travels between the pill's round ends
function travel(box) {
  return { x0: box.x + box.h / 2, len: box.w - box.h }
}

export function ctToKnobX(box, ct) {
  const c = Math.max(CT_MIN, Math.min(CT_MAX, ct || CT_MIN))
  const { x0, len } = travel(box)
  return x0 + ((CT_MAX - c) / (CT_MAX - CT_MIN)) * len - KNOB / 2
}

export function xToCt(box, x) {
  const { x0, len } = travel(box)
  const t = Math.max(0, Math.min(1, (x - x0) / len))
  return Math.round(CT_MAX - t * (CT_MAX - CT_MIN))
}

// Mireds → kelvins, to the 100
export function kelvinText(ct) {
  return `${Math.round(1e6 / Math.max(CT_MIN, Math.min(CT_MAX, ct || CT_MIN)) / 100) * 100} K`
}

// Draws the bar for state.ct; the page moves the knob (state.ctCursorWidget)
// and updates the label (state.ctLabelWidget) while dragging
export function renderCTBar(page, box, ct, onDragCT) {
  const label = page.createTrackedWidget(widget.TEXT, {
    x: box.x, y: box.y - LABEL_H - px(8), w: box.w, h: LABEL_H,
    text: kelvinText(ct),
    text_size: px(24),
    color: COLORS.textSubtitle,
    align_h: align.CENTER_H, align_v: align.CENTER_V
  })
  page.state.ctLabelWidget = label
  // A pill: its ends are transparent in the image (an IMG ignores radius)
  page.createTrackedWidget(widget.IMG, { ...box, auto_scale: true, src: 'ct-picker.png' })
  const knob = page.createTrackedWidget(widget.FILL_RECT, {
    x: ctToKnobX(box, ct), y: box.y + (box.h - KNOB) / 2, w: KNOB, h: KNOB,
    radius: KNOB / 2, color: COLORS.white
  })
  page.state.ctCursorWidget = knob
  // The touch area: the bar and a margin around it
  const pad = px(20)
  const hitbox = page.createTrackedWidget(widget.FILL_RECT, {
    x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2,
    color: 0, alpha: 0
  })
  hitbox.addEventListener(event.CLICK_DOWN, (info) => onDragCT('DOWN', info))
  hitbox.addEventListener(event.MOVE, (info) => onDragCT('MOVE', info))
  hitbox.addEventListener(event.CLICK_UP, (info) => onDragCT('UP', info))
}
