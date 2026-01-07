// app-widget/index.js
import { createWidget, widget, deleteWidget, align, getAppWidgetSize, setAppWidgetSize } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { localStorage } from '@zos/storage'
import { push } from '@zos/router'
import { px } from '@zos/utils'
import { getText } from '@zos/i18n'
import { COLORS, MAX_WIDGET_SHORTCUTS, WIDGET_SHORTCUTS_KEY, DEFAULT_WIDGET_SHORTCUTS, btnPressColor } from '../utils/constants'
import { getLogger } from '../utils/logger.js'

const logger = getLogger('zhue-app-widget')
const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()
let { w: WIDGET_W, radius: WIDGET_RADIUS } = getAppWidgetSize()

// Layout constants
const COLUMNS = 3
const HEADER_H = px(40)
const BUTTON_GAP = px(8)
const BUTTON_H = px(80)
const PADDING_Y = px(10)

let PADDING_X = (DEVICE_WIDTH - WIDGET_W) / 2
let AVAILABLE_W = WIDGET_W - (PADDING_X * 2)
let BUTTON_W = Math.floor((AVAILABLE_W - (BUTTON_GAP * (COLUMNS - 1))) / COLUMNS)
const NO_BUTTONS_TEXT_HINT_H = px(60)

// Minimum widget height (header + hint text, no shortcuts)
const MIN_WIDGET_H = PADDING_Y + HEADER_H + NO_BUTTONS_TEXT_HINT_H + PADDING_Y

// Colors
const COLOR_HEADER = COLORS.activeTab || 0x984ce5
const COLOR_HEADER_PRESS = btnPressColor ? btnPressColor(COLOR_HEADER, 0.7) : 0x6a35a0
const COLOR_CONFIGURED = COLORS.highlight || 0x0055ff
const COLOR_UNCONFIGURED = COLORS.inactive || 0x666666
const COLOR_PRESS = btnPressColor ? btnPressColor(COLOR_CONFIGURED, 0.7) : 0x003399

AppWidget({
  state: {
    shortcuts: [...DEFAULT_WIDGET_SHORTCUTS],
    configuredShortcuts: [], // Solo quelli con lightId !== null
  },
  widgets: [],

  build() {
    logger.debug('Widget build')
    let appWidgetSize =  getAppWidgetSize()
    WIDGET_W = appWidgetSize.w
    WIDGET_RADIUS = appWidgetSize.radius
    PADDING_X = (DEVICE_WIDTH - WIDGET_W) / 2
    AVAILABLE_W = WIDGET_W - (PADDING_X * 2)
    BUTTON_W = Math.floor((AVAILABLE_W - (BUTTON_GAP * (COLUMNS - 1))) / COLUMNS)

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

    let appWidgetSize =  getAppWidgetSize()
    WIDGET_W = appWidgetSize.w
    WIDGET_RADIUS = appWidgetSize.radius
    PADDING_X = (DEVICE_WIDTH - WIDGET_W) / 2
    AVAILABLE_W = WIDGET_W - (PADDING_X * 2)
    BUTTON_W = Math.floor((AVAILABLE_W - (BUTTON_GAP * (COLUMNS - 1))) / COLUMNS)

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
          // Ensure we have exactly MAX_WIDGET_SHORTCUTS items
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
      // Solo header, nessun bottone
      return MIN_WIDGET_H
    }

    // Calcola righe necessarie
    const rows = Math.ceil(numConfigured / COLUMNS)

    // Header + padding + righe di bottoni + gap tra righe + padding finale
    const height = PADDING_Y + HEADER_H + PADDING_Y +
      (rows * BUTTON_H) +
      ((rows - 1) * BUTTON_GAP) +
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
      x: DEVICE_WIDTH/2 - px(50),
      y: currentY,
      w: px(100),//AVAILABLE_W,
      h: HEADER_H,
      text: 'zhue',
      text_size: px(24),
      radius: px(10),
      normal_color: COLOR_HEADER,
      alpha: 0.9,
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
        x: PADDING_X,
        y: PADDING_Y + HEADER_H,
        w: AVAILABLE_W,
        h: NO_BUTTONS_TEXT_HINT_H,
        color: 0xffffff,
        text_size: px(24),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text: getText('WIDGET_NOT_CONFIGURED')
      })
      return
    }

    // ==========================================
    // SHORTCUT BUTTONS - Dynamic grid layout
    // ==========================================
    for (let i = 0; i < numConfigured; i++) {
      const row = Math.floor(i / COLUMNS)
      const col = i % COLUMNS

      const x = PADDING_X + (col * (BUTTON_W + BUTTON_GAP))
      const y = currentY + (row * (BUTTON_H + BUTTON_GAP))

      const shortcut = this.state.configuredShortcuts[i]

      // Button text (truncate to fit)
      const buttonText = this.truncateName(shortcut.lightName || 'Light', 40)

      logger.debug(`Button ${i}: row=${row}, col=${col}, x=${x}, y=${y}, name=${buttonText}`)

      this.createTrackedWidget(widget.BUTTON, {
        x: x,
        y: y,
        w: BUTTON_W,
        h: BUTTON_H,
        text: buttonText,
        text_size: px(18),
        radius: WIDGET_RADIUS,//px(10),
        normal_color: COLOR_CONFIGURED,
        press_color: COLOR_PRESS,
        click_func: () => this.onShortcutClick(shortcut)
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
    push({
      url: 'page/index'
    })
  },

  onShortcutClick(shortcut) {
    logger.log('Widget: Shortcut clicked:', shortcut.lightId, shortcut.lightName)

    // Navigate to quick-toggle page which will handle the actual toggle
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
    logger.debug('Widget: onDestroy, clearing widgets')
    this.clearAllWidgets()
  }
})