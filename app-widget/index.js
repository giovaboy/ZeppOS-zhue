// app-widget/index.js
import { createWidget, widget, text_style, deleteWidget, align, getAppWidgetSize, setAppWidgetSize } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { localStorage } from '@zos/storage'
import { push } from '@zos/router'
import { px } from '@zos/utils'
import { getText } from '@zos/i18n'
import { COLORS, MAX_WIDGET_SHORTCUTS, WIDGET_SHORTCUTS_KEY, DEFAULT_WIDGET_SHORTCUTS, lightIconName, ICON_IMAGE_SIZE, CARD_STATE_FRESH_MS, getGroupIconPath, btnPressColor } from '../utils/constants'
import { getLogger } from '../utils/logger.js'

const logger = getLogger('zhue-app-widget')
const { width: DEVICE_WIDTH } = getDeviceInfo()
let { w: WIDGET_W, radius: WIDGET_RADIUS } = getAppWidgetSize()

// Layout constants
const COLUMNS = 3
const HEADER_H = px(40)
const PADDING_Y = px(6)

// A shortcut: a tile with the light's icon (a 70 px mask, ICON_IMAGE_SIZE),
// its name under it
const ICON_SIZE = px(80) // the tile
const TILE_RADIUS = px(20)
const TEXT_SIZE = px(18)
const TEXT_H = (TEXT_SIZE + px(8)) * 2  // Enough for 2 lines of text
const BUTTON_H = ICON_SIZE + TEXT_H  // 80 + 52
const BUTTON_GAP_X = px(8)
const BUTTON_GAP_Y = 0//px(1)
const PADDING_X = px(10)// Internal padding

let AVAILABLE_W
let BUTTON_W
let WIDGET_MARGIN  // Distance from screen edge to widget area

const NO_BUTTONS_TEXT_HINT_H = px(100)

// Minimum widget height (header + hint text, no shortcuts)
const MIN_WIDGET_H = PADDING_Y + HEADER_H + NO_BUTTONS_TEXT_HINT_H + PADDING_Y

// Colors
// The ring of an entry that is off
const CARD_OFF_RING = 0x777777

const COLOR_HEADER = COLORS.activeTab || 0x984ce5
const COLOR_HEADER_PRESS = btnPressColor ? btnPressColor(COLOR_HEADER) : 0x6a35a0

// Internal padding (configurable)
//const INTERNAL_PADDING_X = px(10)

function recalculateLayout() {
  const appWidgetSize = getAppWidgetSize()
  WIDGET_W = appWidgetSize.w
  WIDGET_RADIUS = appWidgetSize.radius
  WIDGET_MARGIN = appWidgetSize.margin || 0  // Distance from screen edge to widget
  // Widget content area
  AVAILABLE_W = WIDGET_W - (PADDING_X * 2)
  BUTTON_W = Math.floor((AVAILABLE_W - (BUTTON_GAP_X * (COLUMNS - 1))) / COLUMNS)

  logger.debug('Layout recalculated:', {
    WIDGET_W,
    WIDGET_RADIUS,
    WIDGET_MARGIN,
    PADDING_X,
    AVAILABLE_W,
    BUTTON_W
  })
}

AppWidget({
  state: {
    shortcuts: [...DEFAULT_WIDGET_SHORTCUTS],
    configuredShortcuts: [],
  },
  widgets: [],

  build() {
    logger.debug('Widget build')
    recalculateLayout()

    // Load shortcuts from device localStorage
    this.loadShortcuts()

    // Filter configured shortcuts
    // A light (lightId) or a group (kind 'group', groupId); empty slots have neither
    this.state.configuredShortcuts = this.state.shortcuts.filter(s => s && (s.lightId != null || s.groupId != null))

    logger.debug('Configured shortcuts:', this.state.configuredShortcuts.length)

    // Calculate dynamic height and set it
    const widgetHeight = this.calculateWidgetHeight()
    setAppWidgetSize({ h: widgetHeight })

    logger.debug('Widget height set to:', widgetHeight)

    // Render UI
    this.render()
  },

  onResume() {
    logger.debug('Widget onResume')
    this.clearAllWidgets()
    recalculateLayout()

    // Reload shortcuts (might have changed)
    this.loadShortcuts()

    // Recalculate configured shortcuts
    // A light (lightId) or a group (kind 'group', groupId); empty slots have neither
    this.state.configuredShortcuts = this.state.shortcuts.filter(s => s && (s.lightId != null || s.groupId != null))

    // Recalculate height
    const widgetHeight = this.calculateWidgetHeight()
    setAppWidgetSize({ h: widgetHeight })

    // Re-render
    this.render()
  },

  loadShortcuts() {
    try {
      const stored = localStorage.getItem(WIDGET_SHORTCUTS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          while (parsed.length < MAX_WIDGET_SHORTCUTS) {
            parsed.push({ lightId: null, lightName: null })
          }
          this.state.shortcuts = parsed.slice(0, MAX_WIDGET_SHORTCUTS)
          logger.debug('Widget: Loaded shortcuts:', this.state.shortcuts.length)
        }
      }
    } catch (e) {
      logger.error('Widget: Failed to load shortcuts:', e)
    }
  },

  calculateWidgetHeight() {
    const numConfigured = this.state.configuredShortcuts.length

    if (numConfigured === 0) {
      return MIN_WIDGET_H
    }

    const rows = Math.ceil(numConfigured / COLUMNS)
    const height = PADDING_Y + HEADER_H + PADDING_Y +
      (rows * BUTTON_H) +
      ((rows - 1) * BUTTON_GAP_Y) +
      PADDING_Y

    return height
  },

  render() {
    let currentY = PADDING_Y
    const numConfigured = this.state.configuredShortcuts.length

    // ==========================================
    // HEADER - App name, clickable to open app
    // ==========================================
    this.createTrackedWidget(widget.BUTTON, {
      x: DEVICE_WIDTH / 2 - px(50),
      y: currentY,
      w: px(100),
      h: HEADER_H,
      text: 'zhue',
      text_size: px(24),
      radius: px(10),
      normal_color: COLOR_HEADER,
      press_color: COLOR_HEADER_PRESS,
      click_func: () => this.openApp()
    })

    currentY += HEADER_H + PADDING_Y

    // ==========================================
    // NO SHORTCUTS MESSAGE
    // ==========================================
    if (numConfigured === 0) {
      logger.debug('No shortcuts configured, showing header only')

      this.createTrackedWidget(widget.TEXT, {
        x: WIDGET_MARGIN + PADDING_X,
        y: currentY,
        w: AVAILABLE_W,
        h: NO_BUTTONS_TEXT_HINT_H,
        color: COLORS.textSubtitle || 0xaaaaaa,
        text_size: px(20),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP,
        text: getText('WIDGET_NOT_CONFIGURED') || 'Add lights from their page in zhue'
      })
      return
    }

    // ==========================================
    // SHORTCUT BUTTONS - Icon + Text layout
    // ==========================================
    for (let i = 0; i < numConfigured; i++) {
      const row = Math.floor(i / COLUMNS)
      const col = i % COLUMNS

      // Calcola posizione centrata nella cella
      // X starts from: screen edge (0) + margin + internal padding
      const cellX = WIDGET_MARGIN + PADDING_X + (col * (BUTTON_W + BUTTON_GAP_X))
      const cellY = currentY + (row * (BUTTON_H + BUTTON_GAP_Y))

      // Centra l'icona nella cella
      const iconX = cellX + (BUTTON_W - ICON_SIZE) / 2
      const iconY = cellY

      const shortcut = this.state.configuredShortcuts[i]
      const buttonText = this.truncateName(shortcut.name || shortcut.lightName || 'Light', 60)

      logger.debug(`Button ${i}: row=${row}, col=${col}, cellX=${cellX}, iconX=${iconX}`)

      this.renderShortcutTile(iconX, iconY, shortcut)

      // TESTO sotto l'icona
      this.createTrackedWidget(widget.TEXT, {
        x: cellX,
        y: iconY + ICON_SIZE,  // Sotto l'icona
        w: BUTTON_W,
        h: TEXT_H,
        color: COLORS.text || 0xffffff,
        text_size: TEXT_SIZE,
        align_h: align.CENTER_H,
        align_v: align.TOP,
        text_style: text_style.WRAP,
        text: buttonText
      })
    }
  },

  // The light as zhue last saw it (utils/shortcuts.js; the card can't ask
  // the phone): its model's icon over its color with a green ring while on,
  // grey with a grey ring while off, as on the light's page. Only while the
  // state was confirmed less than CARD_STATE_FRESH_MS ago (an app start, a
  // tap on the card, the light seen in the app): older, it is unknown, grey
  // with no ring (the lights may have changed meanwhile). The icon is a
  // #333333 mask: it sits on a tile of that grey, whatever the card's own
  // background (#303030 in the simulator). The tile doesn't darken when
  // pressed (the mask's square would show); the tap opens quick-toggle at once
  renderShortcutTile(x, y, shortcut) {
    const box = { x, y, w: ICON_SIZE, h: ICON_SIZE }
    const passThrough = (w) => { try { w.setEnable(false) } catch (e) {} return w }
    this.createTrackedWidget(widget.BUTTON, {
      ...box,
      text: '',
      radius: TILE_RADIUS,
      normal_color: COLORS.lightBg,
      press_color: COLORS.lightBg,
      click_func: () => this.onShortcutClick(shortcut)
    })
    const ix = x + (ICON_SIZE - ICON_IMAGE_SIZE) / 2
    const iy = y + (ICON_SIZE - ICON_IMAGE_SIZE) / 2
    const fresh = typeof shortcut.at === 'number' && Date.now() - shortcut.at < CARD_STATE_FRESH_MS
    const isOn = fresh && shortcut.ison === true
    const isOff = fresh && shortcut.ison === false
    passThrough(this.createTrackedWidget(widget.FILL_RECT, {
      x: ix + 1, y: iy + 1, w: ICON_IMAGE_SIZE - 2, h: ICON_IMAGE_SIZE - 2,
      color: isOn && shortcut.color !== undefined ? shortcut.color : COLORS.inactive
    }))
    passThrough(this.createTrackedWidget(widget.IMG, {
      x: ix, y: iy, w: ICON_IMAGE_SIZE, h: ICON_IMAGE_SIZE,
      // A light: its model's icon; a group: its room / zone class's
      src: shortcut.kind === 'group' ? getGroupIconPath(shortcut.groupClass || 'Other') : `icons/${lightIconName(shortcut)}.png`
    }))
    if (isOn || isOff) {
      passThrough(this.createTrackedWidget(widget.STROKE_RECT, {
        ...box,
        radius: TILE_RADIUS,
        line_width: px(3),
        // Off: a mid grey (#444444 vanished on the #333333 tile), so off reads
        // apart from an unknown state (no ring)
        color: isOn ? COLORS.success : CARD_OFF_RING
      }))
    }
  },

  truncateName(name, maxLen) {
    if (!name) return '---'
    if (name.length <= maxLen) return name
    return name.substring(0, maxLen - 1) + '…'
  },

  openApp() {
    logger.log('Widget: Opening app')
    push({ url: 'page/index' })
  },

  onShortcutClick(shortcut) {
    logger.log('Widget: Shortcut clicked:', shortcut.kind || 'light', shortcut.lightId ?? shortcut.groupId)
    push({
      url: 'page/quick-toggle',
      params: JSON.stringify(shortcut.kind === 'group'
        ? { kind: 'group', groupId: shortcut.groupId, name: shortcut.name }
        : { lightId: shortcut.lightId, lightName: shortcut.lightName })
    })
  },

  clearAllWidgets() {
    this.widgets.forEach(w => {
      try { deleteWidget(w) } catch (e) {
        logger.error('Del widget err', e)
      }
    })
    this.widgets = []
  },

  createTrackedWidget(type, props) {
    const w = createWidget(type, props)
    this.widgets.push(w)
    return w
  },

  onDestroy() {
    logger.debug('Widget: onDestroy')
    this.clearAllWidgets()
  }
})