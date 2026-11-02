// Physical-button navigation for the list pages, after zeppamp's
// utils/key-nav.js (trimmed: no scrolling titles, artwork or dialogs).
//
// UP / DOWN move a focus ring between the page's items (skipping disabled
// ones, wrapping at the ends) and scroll the list to keep the focused item in
// the middle of the screen; held, they scroll fast. SELECT acts on the
// focused item like a tap (the ring darkens while the key is held); held, it
// does the item's second action. BACK goes back.
// Nothing is highlighted until the first UP / DOWN press, so touch-only use
// looks exactly as before.
//
// onKey takes one callback per page (a second registration makes the first
// fail): call bindKeyNav once, in build, and have it handle BACK too.
import ui from '@zos/ui'
import { px } from '@zos/utils'
import { back } from '@zos/router'
import {
  onKey, KEY_UP, KEY_DOWN, KEY_SHORTCUT, KEY_SELECT, KEY_BACK,
  KEY_EVENT_CLICK, KEY_EVENT_LONG_PRESS, KEY_EVENT_PRESS, KEY_EVENT_RELEASE
} from '@zos/interaction'
import { getDeviceInfo } from '@zos/device'
import { COLORS, btnPressColor } from './constants.js'
import { devLog, warnLog, LOG_TRACE } from './remote-log.js'
import { errorText } from './log-text.js'

const { height: DEVICE_HEIGHT } = getDeviceInfo()

// The app's purple (the active tab); white on items filled with it
export const RING_COLOR = COLORS.activeTab
export const RING_ON_ACCENT = COLORS.white
const RING_WIDTH = px(3)
// Held UP / DOWN: one item every FAST_SCROLL_MS until the key is released
const FAST_SCROLL_MS = 150
const FAST_SCROLL_MAX_STEPS = 300
const VIEW_MARGIN_TOP = px(8)
const VIEW_MARGIN_BOTTOM = px(70) // round screens clip the bottom of lists

// Scroll state of a VIEW_CONTAINER, so key navigation can scroll it. Set
// `widget` once the container exists, keep `posY` current from its scroll
// callback (track), and set `contentHeight` once the rows are built.
// Positions use the container's own pos_y convention: content scrolled up by
// N px <=> pos_y = -N.
//   height: the container's height; screenTop: its y on the screen
export function createScrollView(height, initialPosY = 0, screenTop = 0) {
  return {
    widget: null,
    height,
    screenTop,
    posY: initialPosY || 0,
    contentHeight: 0,
    // The container's own yoffset, from its scroll_frame_func
    track(yoffset) {
      if (yoffset !== undefined) this.posY = yoffset
    },
    // Scroll so the item [top, top + h] sits in the middle of the screen,
    // fully visible, within the list's ends
    ensureVisible(top, h) {
      if (!this.widget) return
      const scrolled = -this.posY
      const middle = DEVICE_HEIGHT / 2 - this.screenTop
      let next = Math.round(top + h / 2 - middle)
      if (top - VIEW_MARGIN_TOP < next) next = top - VIEW_MARGIN_TOP
      else if (top + h + VIEW_MARGIN_BOTTOM > next + this.height) next = top + h + VIEW_MARGIN_BOTTOM - this.height
      if (this.contentHeight) next = Math.min(next, this.contentHeight - this.height)
      next = Math.max(0, next)
      if (next === scrolled) return
      this.posY = -next
      try { this.widget.setProperty(ui.prop.MORE, { pos_y: this.posY }) } catch (e) {
        warnLog(`[keys] pos_y failed: ${errorText(e)}`)
      }
    }
  }
}

// getItems() is read at every key press, so a page that redraws its list
// always offers its current items.
// Item: { key, x, y, w, h, radius?, ringColor?, enabled?, select(),
//         longSelect?(), parent?, view? }
//   key:        names the item across redraws (focusKey after a redraw)
//   ringColor:  RING_ON_ACCENT for items filled with the ring's color
//   longSelect: held SELECT (the row's second action)
//   parent:     the VIEW_CONTAINER the item lives in (omit for page widgets)
//   view:       the scroll view of that container (createScrollView)
export function bindKeyNav({ getItems, onBack, label = 'page' }) {
  let index = -1
  let ring = null
  let focusedKey = null

  function removeRing() {
    // May throw if its container was already deleted by a redraw
    if (ring) {
      try { ui.deleteWidget(ring) } catch (e) {
        try { ring.setProperty(ui.prop.MORE, { visible: false }) } catch (_) {}
      }
    }
    ring = null
  }

  function focus(item) {
    removeRing()
    // Recreated at every move: it ends up above widgets made after it, in
    // the same container as the item
    ring = (item.parent || ui).createWidget(ui.widget.STROKE_RECT, {
      x: item.x, y: item.y, w: item.w, h: item.h,
      color: item.ringColor ?? RING_COLOR,
      line_width: RING_WIDTH,
      radius: item.radius ?? px(10)
    })
    // Taps go through to the buttons underneath
    try { ring.setEnable(false) } catch (e) {}
    if (item.view) item.view.ensureVisible(item.y, item.h)
    focusedKey = item.key
    if (LOG_TRACE) devLog(`[keys] ${label}: focus ${item.key}${item.view ? ` (list at ${-item.view.posY})` : ''}`)
  }

  // Returns true if the focus moved. noWrap: stop at the ends (fast scroll)
  function move(dir, noWrap = false) {
    const items = getItems() || []
    if (!items.length) return false
    // The first press focuses the first enabled item, whatever the direction
    let i = index < 0 ? 0 : index + dir
    const step = index < 0 ? 1 : dir
    while (i >= 0 && i < items.length && items[i].enabled === false) i += step
    if (i < 0 || i >= items.length) {
      if (noWrap || index < 0) return false
      i = dir > 0 ? 0 : items.length - 1
      while (i >= 0 && i < items.length && items[i].enabled === false) i += dir
      if (i < 0 || i >= items.length || i === index) return false
    }
    index = i
    focus(items[i])
    return true
  }

  let fastTimer = null
  function stopFastScroll() {
    if (fastTimer) { clearInterval(fastTimer); fastTimer = null }
  }
  function startFastScroll(dir) {
    stopFastScroll()
    if (!move(dir, true)) return
    let steps = 0
    fastTimer = setInterval(() => {
      let moved = false
      try { moved = ++steps <= FAST_SCROLL_MAX_STEPS && move(dir, true) } catch (e) {}
      if (!moved) stopFastScroll()
    }, FAST_SCROLL_MS)
  }

  function select(long) {
    const item = (getItems() || [])[index]
    if (!item || item.enabled === false) return
    if (LOG_TRACE) devLog(`[keys] ${label}: ${long ? 'hold' : 'select'} ${item.key}`)
    if (!long) item.select()
    else if (item.longSelect) item.longSelect()
  }

  // While SELECT is held the ring shows its pressed color (−28.6%), as a
  // touch shows a button's (Zepp: visual feedback for every button press)
  function showPressed(on) {
    const item = (getItems() || [])[index]
    if (!ring || !item) return
    const color = item.ringColor ?? RING_COLOR
    try { ring.setProperty(ui.prop.MORE, { color: on ? btnPressColor(color) : color }) } catch (e) {}
  }

  function onKeyEvent(key, keyEvent) {
    if (key === KEY_BACK) {
      if (keyEvent === KEY_EVENT_CLICK) (onBack || back)()
      return true
    }
    const dir = key === KEY_UP ? -1 : (key === KEY_DOWN || key === KEY_SHORTCUT) ? 1 : 0
    if (dir && keyEvent === KEY_EVENT_LONG_PRESS) { startFastScroll(dir); return true }
    // Only shown: the press itself is left as it was
    if (key === KEY_SELECT && keyEvent === KEY_EVENT_PRESS) { showPressed(true); return false }
    if (keyEvent === KEY_EVENT_RELEASE) {
      if (key === KEY_SELECT) showPressed(false)
      if (dir && fastTimer) { stopFastScroll(); return true }
      return false
    }
    // Any other key action ends a fast scroll whose release was missed
    stopFastScroll()
    if (key === KEY_SELECT && keyEvent === KEY_EVENT_LONG_PRESS) { showPressed(false); select(true); return true }
    if (keyEvent !== KEY_EVENT_CLICK) return false
    if (dir) { move(dir); return true }
    if (key === KEY_SELECT) { showPressed(false); select(false); return true }
    return false
  }

  onKey({
    callback: (key, keyEvent) => {
      // The key callback's errors are otherwise silent
      try { return onKeyEvent(key, keyEvent) } catch (e) {
        warnLog(`[keys] ${label}: key ${key} failed: ${errorText(e)}`)
        return true
      }
    }
  })

  return {
    // Call before the page redraws its items: drops the ring (the focus is
    // remembered by key, see refocus)
    reset() {
      stopFastScroll()
      removeRing()
      index = -1
    },
    // After a redraw: the ring goes back to the item it was on, if the keys
    // were in use and the item is still there (else to nothing)
    refocus() {
      if (!focusedKey) return
      const items = getItems() || []
      const i = items.findIndex((it) => it.key === focusedKey && it.enabled !== false)
      if (i < 0) { focusedKey = null; return }
      index = i
      focus(items[i])
    },
    stop() {
      stopFastScroll()
      removeRing()
    }
  }
}
