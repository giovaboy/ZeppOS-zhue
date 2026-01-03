// app-widget/index.js
import { createWidget, widget, align, prop, getAppWidgetSize } from '@zos/ui'
import { localStorage } from '@zos/storage'
import { push } from '@zos/router'
import { px } from '@zos/utils'
import { getText } from '@zos/i18n'
import { COLORS, MAX_WIDGET_SHORTCUTS, WIDGET_SHORTCUTS_KEY, DEFAULT_WIDGET_SHORTCUTS, btnPressColor } from '../utils/constants'
import { getLogger } from '../utils/logger.js'

const logger = getLogger('zhue-app-widget')
const { width: WIDGET_W, height: WIDGET_H } = getAppWidgetSize()

// Layout constants
const BUTTON_GAP = px(8)
const BUTTON_H = px(50)
const PADDING_X = px(10)
const AVAILABLE_W = WIDGET_W - (PADDING_X * 2)
const BUTTON_W = Math.floor((AVAILABLE_W - (BUTTON_GAP * 2)) / MAX_WIDGET_SHORTCUTS)

// Colors
const COLOR_CONFIGURED = COLORS.activeTab || 0x984ce5
const COLOR_UNCONFIGURED = COLORS.inactive || 0x666666
const COLOR_PRESS = btnPressColor ? btnPressColor(COLOR_CONFIGURED, 0.7) : 0x6a35a0

AppWidget({
  state: {
    shortcuts: DEFAULT_WIDGET_SHORTCUTS,
    buttons: []
  },
  
  build() {
    logger.log('Widget build')
    
    // Load shortcuts from device localStorage
    this.loadShortcuts()
    
    // Render buttons
    this.renderButtons()
  },
  
  loadShortcuts() {
    try {
      const stored = localStorage.getItem(WIDGET_SHORTCUTS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length === 3) {
          this.state.shortcuts = parsed
          logger.log('Widget: Loaded shortcuts from localStorage')
        }
      }
    } catch (e) {
      logger.error('Widget: Failed to load shortcuts:', e)
    }
  },
  
  renderButtons() {
    const startY = (WIDGET_H - BUTTON_H) / 2
    
    for (let i = 0; i < 3; i++) {
      const shortcut = this.state.shortcuts[i]
      const isConfigured = shortcut && shortcut.lightId !== null
      
      const x = PADDING_X + (i * (BUTTON_W + BUTTON_GAP))
      
      // Determine button text
      const buttonText = isConfigured ?
        this.truncateName(shortcut.lightName || 'Light', 8) :
        getText('NOT_CONFIGURED') || '---'
      
      // Create button
      const btn = createWidget(widget.BUTTON, {
        x: x,
        y: startY,
        w: BUTTON_W,
        h: BUTTON_H,
        text: buttonText,
        text_size: px(14),
        radius: px(8),
        normal_color: isConfigured ? COLOR_CONFIGURED : COLOR_UNCONFIGURED,
        press_color: isConfigured ? COLOR_PRESS : COLOR_UNCONFIGURED,
        click_func: isConfigured ?
          () => this.onShortcutClick(shortcut) :
          null
      })
      
      this.state.buttons[i] = btn
    }
  },
  
  truncateName(name, maxLen) {
    if (!name) return '---'
    if (name.length <= maxLen) return name
    return name.substring(0, maxLen - 1) + '…'
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
  }
})