import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style, setStatusBarVisible, getTextLayout } from '@zos/ui'
import { getText } from '@zos/i18n'
import { COLORS, btnPressColor } from '../../utils/constants.js'
import { startDot } from '../../utils/pulse.js'

const STATES = {
  LOADING: 'LOADING',
  SEARCHING_BRIDGE: 'SEARCHING_BRIDGE',
  WAITING_FOR_PRESS: 'WAITING_FOR_PRESS',
  FETCHING_DATA: 'FETCHING_DATA',
  ERROR: 'ERROR',
  BT_ERROR: 'BT_ERROR',
  SUCCESS: 'SUCCESS'
}

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

setStatusBarVisible(false)

// The start page's screens, in the app's style: black, white and grey texts
// (28 / 24 / 20), the pulsing dot of every loading, a purple pill to retry;
// each screen one block centered on the screen, its texts wrapped in TEXT_W
// so nothing reaches the round edge. (They were an orange pairing screen with
// a bar going back and forth and its last line cut by the edge, a red disc
// for an error, a "🔵✕" for Bluetooth, a spinner and two progress bars.)
const TEXT_W = px(360)
const GAP = px(18)
const DOT = px(18)

export function renderMainWidgets(pageContext, state, callbacks = {}) {
  const { retryFunc } = callbacks
  const { currentState, error } = state

  pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT, color: COLORS.background
  })

  switch (currentState) {
    case STATES.LOADING:
      renderStack(pageContext, [dot(), text(getText('LOADING'), px(24), COLORS.loading)])
      break

    case STATES.FETCHING_DATA:
      renderStack(pageContext, [dot(), text(getText('LOADING_HUE_SETUP'), px(24), COLORS.loading)])
      break

    case STATES.SEARCHING_BRIDGE:
      renderStack(pageContext, [
        dot(),
        text(getText('SEARCHING_BRIDGE'), px(24), COLORS.text),
        text(getText('BRIDGE_POWERED_ON'), px(20), COLORS.textSubtitle)
      ])
      break

    case STATES.WAITING_FOR_PRESS:
      renderStack(pageContext, [
        text(getText('BRIDGE_FOUND'), px(28), COLORS.text),
        image('push-link.png', px(100), px(96)),
        text(getText('PRESS_BUTTON_TO_PAIR'), px(24), COLORS.text),
        dot()
      ])
      break

    case STATES.ERROR:
      renderStack(pageContext, [
        text(getText('CONNECTION_ERROR'), px(28), COLORS.error),
        text(error || getText('BRIDGE_CONNECTION_FAILED'), px(24), COLORS.text),
        button(getText('RETRY'), retryFunc)
      ])
      break

    case STATES.BT_ERROR:
      renderStack(pageContext, [
        text(getText('BT_NOT_CONNECTED'), px(28), COLORS.error),
        text(getText('BT_CONNECT_INSTRUCTIONS'), px(20), COLORS.textSubtitle),
        text(getText('BT_AUTO_RETRY'), px(20), COLORS.textSubtitle),
        button(getText('RETRY'), retryFunc)
      ])
      break
  }
}

// --- the block: items one under the other, GAP apart, centered ---

function text(value, size, color) {
  const str = String(value || '')
  let h = Math.round(size * 1.4)
  try {
    const layout = getTextLayout(str, { text_size: size, text_width: TEXT_W, wrapped: 1 })
    if (layout && layout.height) h = layout.height + px(6)
  } catch (e) {}
  return {
    h,
    draw: (page, y) => page.createTrackedWidget(widget.TEXT, {
      x: (DEVICE_WIDTH - TEXT_W) / 2, y, w: TEXT_W, h,
      text: str, text_size: size, color,
      align_h: align.CENTER_H, align_v: align.CENTER_V,
      text_style: text_style.WRAP
    })
  }
}

function image(src, w, h) {
  return {
    h,
    draw: (page, y) => page.createTrackedWidget(widget.IMG, { x: (DEVICE_WIDTH - w) / 2, y, w, h, src })
  }
}

// The app's loading: a pulsing dot (utils/pulse.js), stopped with the page's
// other animations
function dot() {
  return {
    h: DOT,
    draw: (page, y) => startDot(page, { cx: DEVICE_WIDTH / 2, cy: y + DOT / 2, size: DOT })
  }
}

function button(label, onTap) {
  const w = px(200), h = px(56)
  return {
    h: h + px(6), // a little more room above it
    draw: (page, y) => page.createTrackedWidget(widget.BUTTON, {
      x: (DEVICE_WIDTH - w) / 2, y: y + px(6), w, h,
      text: label, text_size: px(24),
      radius: h / 2,
      normal_color: COLORS.highlight,
      press_color: btnPressColor(COLORS.highlight),
      click_func: onTap
    })
  }
}

function renderStack(page, items) {
  const total = items.reduce((sum, it) => sum + it.h, 0) + GAP * (items.length - 1)
  let y = Math.round((DEVICE_HEIGHT - total) / 2)
  for (const it of items) {
    it.draw(page, y)
    y += it.h + GAP
  }
}
