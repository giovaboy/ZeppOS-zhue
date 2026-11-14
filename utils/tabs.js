// Two tabs at the top of a page: Rooms / Zones (groups), Color / White (color
// picker). One drawing for both, so they are twins: same size, text, colors.
//
//   [  Stanze  ][  Zone  ]      180 × 60 each, 5 apart, at y 20
//
// Each tab's touch area is its half of the band above the content (the tabs
// sit in the narrow top of a round screen): transparent buttons made before
// the tabs, so under them, so a tap on a tab still shows its pressed color.
import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget } from '@zos/ui'
import { COLORS, btnPressColor } from './constants.js'
import { RING_ON_ACCENT } from './key-nav.js'

const { width: DEVICE_WIDTH } = getDeviceInfo()
export const TAB_Y = px(20)
export const TAB_H = px(60)
const TAB_W = px(180)
const TAB_GAP = px(5)
const RADIUS = px(8)

// tabs: [[key, label], [key, label]]; current: the key shown; onSwitch(key),
// only for the other tab; bandH: the height of the touch band; nav: the
// keys' items (utils/key-nav.js), optional
export function renderTabs(page, { tabs, current, onSwitch, bandH, nav = null }) {
  const startX = (DEVICE_WIDTH - (TAB_W * 2 + TAB_GAP)) / 2
  const go = (key) => { if (key !== current) onSwitch(key) }
  tabs.forEach(([key], i) => {
    const area = page.createTrackedWidget(widget.BUTTON, {
      x: i * DEVICE_WIDTH / 2, y: 0, w: DEVICE_WIDTH / 2, h: bandH,
      text: '',
      normal_color: COLORS.black,
      press_color: COLORS.black,
      click_func: () => go(key)
    })
    try { area.setAlpha(0) } catch (e) {}
  })
  tabs.forEach(([key, label], i) => {
    const on = key === current
    const box = { x: startX + i * (TAB_W + TAB_GAP), y: TAB_Y, w: TAB_W, h: TAB_H }
    page.createTrackedWidget(widget.BUTTON, {
      ...box,
      text: label,
      text_size: px(24),
      color: on ? COLORS.activeTabText : COLORS.inactiveTabText,
      normal_color: on ? COLORS.activeTab : COLORS.inactiveTab,
      press_color: btnPressColor(COLORS.activeTab),
      radius: RADIUS,
      click_func: () => go(key)
    })
    if (nav) nav.items.push({
      key: `tab:${key}`, ...box, radius: RADIUS,
      ringColor: on ? RING_ON_ACCENT : undefined,
      select: () => go(key)
    })
  })
}
