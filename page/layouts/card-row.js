// "In the shortcut card": a row with a switch on the right (Zepp: switches on
// the right of a row), at the end of a group's list, round and square
// layouts alike. The light page draws its own (page/layouts/light-detail.js).
import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style } from '@zos/ui'
import { getText } from '@zos/i18n'
import { COLORS, btnPressColor } from '../../utils/constants.js'

const { width: DEVICE_WIDTH } = getDeviceInfo()
export const CARD_ROW_H = px(72)

function passThrough(w) {
  try { w.setEnable(false) } catch (e) {}
  return w
}

// Draws the row at `y` in `container`; registers it with the keys (nav,
// view) under `key`. Returns the y after it
export function renderCardRow(container, y, isOn, onTap, { nav = null, view = null, key = 'card' } = {}) {
  const w = DEVICE_WIDTH - px(80)
  const h = CARD_ROW_H
  const box = { x: (DEVICE_WIDTH - w) / 2, y, w, h }
  container.createWidget(widget.BUTTON, {
    ...box,
    text: '',
    normal_color: COLORS.lightBg,
    press_color: btnPressColor(COLORS.lightBg),
    radius: px(16),
    click_func: onTap
  })
  const trackW = px(64)
  const trackH = px(36)
  const trackX = box.x + w - px(20) - trackW
  passThrough(container.createWidget(widget.TEXT, {
    x: box.x + px(20), y, w: trackX - box.x - px(30), h,
    text: getText('WIDGET_SHORTCUT_ROW'),
    text_size: px(22),
    color: COLORS.text,
    align_h: align.LEFT, align_v: align.CENTER_V,
    text_style: text_style.WRAP
  }))
  passThrough(container.createWidget(widget.FILL_RECT, {
    x: trackX, y: y + (h - trackH) / 2, w: trackW, h: trackH,
    radius: trackH / 2,
    color: isOn ? COLORS.activeTab : COLORS.toggleOff
  }))
  passThrough(container.createWidget(widget.CIRCLE, {
    center_x: isOn ? trackX + trackW - trackH / 2 : trackX + trackH / 2,
    center_y: y + h / 2,
    radius: trackH / 2 - px(4),
    color: COLORS.white
  }))
  if (nav) nav.items.push({ key, ...box, radius: px(16), parent: container, view, select: onTap })
  return y + h
}
