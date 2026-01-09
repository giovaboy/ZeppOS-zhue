// app-widget/index.js
import { createWidget, widget, text_style, deleteWidget, align, getAppWidgetSize, setAppWidgetSize } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { localStorage } from '@zos/storage'
import { push } from '@zos/router'
import { px } from '@zos/utils'
import { getText } from '@zos/i18n'
import { COLORS, MAX_WIDGET_SHORTCUTS, WIDGET_SHORTCUTS_KEY, DEFAULT_WIDGET_SHORTCUTS, btnPressColor } from '../utils/constants'
import { getLogger } from '../utils/logger.js'

const logger = getLogger('zhue-app-widget')
const { width: DEVICE_WIDTH } = getDeviceInfo()
let { w: WIDGET_W, radius: WIDGET_RADIUS } = getAppWidgetSize()

// Layout constants
const COLUMNS = 3
const HEADER_H = px(40)
const PADDING_Y = px(10)

// Button layout: icona 70x70 + testo sotto
const ICON_SIZE = px(70)
const TEXT_H = px(40)
const BUTTON_H = ICON_SIZE + TEXT_H  // 70 + 40 = 110
const BUTTON_GAP_X = px(8)
const BUTTON_GAP_Y = px(8)
const PADDING_X = px(10)// Internal padding

let AVAILABLE_W
let BUTTON_W
let WIDGET_MARGIN  // Distance from screen edge to widget area

const NO_BUTTONS_TEXT_HINT_H = px(100)

// Minimum widget height (header + hint text, no shortcuts)
const MIN_WIDGET_H = PADDING_Y + HEADER_H + NO_BUTTONS_TEXT_HINT_H + PADDING_Y

// Colors
const COLOR_HEADER = COLORS.activeTab || 0x984ce5
const COLOR_HEADER_PRESS = btnPressColor ? btnPressColor(COLOR_HEADER, 0.7) : 0x6a35a0

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
    this.state.configuredShortcuts = this.state.shortcuts.filter(s => s && s.lightId !== null)

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
    this.state.configuredShortcuts = this.state.shortcuts.filter(s => s && s.lightId !== null)

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
        text: getText('WIDGET_NOT_CONFIGURED') || 'Long-press SELECT on a light to add shortcuts'
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
      const buttonText = this.truncateName(shortcut.lightName || 'Light', 60)

      logger.debug(`Button ${i}: row=${row}, col=${col}, cellX=${cellX}, iconX=${iconX}`)

      // ICONA (bottone cliccabile con immagine)
      this.createTrackedWidget(widget.BUTTON, {
        x: iconX,
        y: iconY,
        w: ICON_SIZE,
        h: ICON_SIZE,
        normal_src: 'light-switch_normal.png',    // 70x70 icona normale
        press_src: 'light-switch_press.png',      // 70x70 icona premuta
        click_func: () => this.onShortcutClick(shortcut)
      })

      // TESTO sotto l'icona
      this.createTrackedWidget(widget.TEXT, {
        x: cellX,
        y: iconY + ICON_SIZE,  // Sotto l'icona
        w: BUTTON_W,
        h: TEXT_H,
        color: COLORS.text || 0xffffff,
        text_size: px(18),
        align_h: align.CENTER_H,
        align_v: align.TOP,
        text_style: text_style.WRAP,
        text: buttonText
      })
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
    logger.log('Widget: Shortcut clicked:', shortcut.lightId, shortcut.lightName)
    push({
      url: 'page/quick-toggle',
      params: JSON.stringify({
        lightId: shortcut.lightId,
        lightName: shortcut.lightName
      })
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