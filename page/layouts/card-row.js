// "Shortcut": the switch that puts a light or a group in the shortcut card, at
// the end of its page (light page, group page; round and square alike).
// A secondary setting: no background, the label in the grey of a light that is
// off, label and switch together in a narrow band at the center (a card-wide
// row with a background drew the eye away from the lights, and the round
// screen cut its long label: "ella card scorciatoie").
import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style } from '@zos/ui'
import { getText } from '@zos/i18n'
import { COLORS } from '../../utils/constants.js'

const { width: DEVICE_WIDTH } = getDeviceInfo()
export const CARD_ROW_H = px(60)
const BAND_W = px(260)

function passThrough(w) {
  try { w.setEnable(false) } catch (e) {}
  return w
}

// make(type, props) creates a widget where the row goes (a VIEW_CONTAINER's
// createWidget, or the page's createTrackedWidget). parent: the container,
// for the keys' ring (none on a page). Registers the row with the keys (nav,
// view) under `key`. Returns the y after it
export function renderCardRow(make, y, isOn, onTap, { nav = null, view = null, parent = null, key = 'card' } = {}) {
  const h = CARD_ROW_H
  const box = { x: (DEVICE_WIDTH - BAND_W) / 2, y, w: BAND_W, h }
  const trackW = px(64)
  const trackH = px(36)
  const trackX = box.x + BAND_W - trackW
  passThrough(make(widget.TEXT, {
    x: box.x, y, w: trackX - box.x - px(16), h,
    text: getText('WIDGET_SHORTCUT_ROW'),
    text_size: px(24),
    color: COLORS.inactive,
    align_h: align.LEFT, align_v: align.CENTER_V,
    text_style: text_style.ELLIPSIS
  }))
  passThrough(make(widget.FILL_RECT, {
    x: trackX, y: y + (h - trackH) / 2, w: trackW, h: trackH,
    radius: trackH / 2,
    color: isOn ? COLORS.activeTab : COLORS.toggleOff
  }))
  passThrough(make(widget.CIRCLE, {
    center_x: isOn ? trackX + trackW - trackH / 2 : trackX + trackH / 2,
    center_y: y + h / 2,
    radius: trackH / 2 - px(4),
    color: COLORS.white
  }))
  // The whole band is the tap target, over label and switch (invisible)
  const tap = make(widget.BUTTON, {
    ...box,
    text: '',
    normal_color: COLORS.black,
    press_color: COLORS.black,
    click_func: onTap
  })
  try { tap.setAlpha(0) } catch (e) {}
  if (nav) nav.items.push({ key, ...box, radius: px(12), parent, view, select: onTap })
  return y + h
}
