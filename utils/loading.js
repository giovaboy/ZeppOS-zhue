// "Loading…": the pulsing dot and its line, one block centered on the screen
// (the dot used to sit 80-90 px above the center and the text right under it:
// the block looked high, the bottom half of the screen empty).
import { createWidget, widget, align } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { getText } from '@zos/i18n'
import { COLORS } from './constants.js'
import { startDot } from './pulse.js'

const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()
const DOT = px(18)
const GAP = px(14)
const LINE_H = px(40)

// page: has createTrackedWidget (its widgets are deleted on redraw) and owns
// the dot's animation (stopPulses). cy: the block's center, the screen's by
// default
export function renderLoading(page, text = getText('LOADING'), cy = DEVICE_HEIGHT / 2) {
  const top = cy - (DOT + GAP + LINE_H) / 2
  const make = page.createTrackedWidget ? (t, p) => page.createTrackedWidget(t, p) : createWidget
  make(widget.TEXT, {
    x: 0, y: top + DOT + GAP, w: DEVICE_WIDTH, h: LINE_H,
    text,
    text_size: px(24),
    color: COLORS.loading,
    align_h: align.CENTER_H, align_v: align.CENTER_V
  })
  startDot(page, { cx: DEVICE_WIDTH / 2, cy: top + DOT / 2, size: DOT })
}
