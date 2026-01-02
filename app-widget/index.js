// index.js
import { createWidget, widget,prop, align, text_style, px, getAppWidgetSize } from '@zos/ui'
import { push } from '@zos/router'
import { LocalStorage } from '@zos/storage'
import { COLORS, MAX_WIDGET_SHORTCUTS, PRESET_TYPES, btnPressColor, ct2hex } from '../utils/constants'
import { getText } from '@zos/i18n'
import { getLogger } from '../utils/logger.js'

const { width: WIDGET_W, height: WIDGET_H } = getAppWidgetSize()
const logger = getLogger('zhue-app-widget')

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
      shortcuts: [
        { lightId: 1, lightName: 'Living Room' },
        { lightId: null, lightName: null },
        { lightId: null, lightName: null }
      ],
      buttons: [],
      isLoading: false
    },
  build() {
    createWidget(widget.BUTTON, {
      x: px(60),
      y: px(10),
      w: px(160),
      h: px(50),
      text: 'TEST APP',
      normal_color: COLORS.activeTab,
      press_color: btnPressColor(COLORS.activeTab, 0.8),
      radius: px(25),
      click_func: () => push({
        url: 'page/index',
        params: 'type=1',
      })
    })
   // Render placeholder buttons immediately
      this.renderButtons()

      // Load shortcuts from backend
      //this.loadShortcuts()
  },

  loadShortcuts() {
      /*this.request({ method: 'GET_WIDGET_SHORTCUTS' })
        .then(result => {
          logger.log('Widget shortcuts loaded:', result)
          if (result.success && result.shortcuts) {
            this.state.shortcuts = result.shortcuts
          }
          this.state.isLoading = false
          this.renderButtons()
        })
        .catch(err => {
          console.error('Widget: Failed to load shortcuts:', err)
          this.state.isLoading = false
          this.renderButtons()
        })*/
    },

    renderButtons() {
      // Clear existing buttons
      /*this.state.buttons.forEach(btn => {
        try {
          // Can't delete widgets in app-widget, just update them
        } catch (e) {}
      })*/

      const startY = (WIDGET_H - BUTTON_H) / 2

      for (let i = 0; i < MAX_WIDGET_SHORTCUTS; i++) {
        const shortcut = this.state.shortcuts[i]
        const isConfigured = shortcut && shortcut.lightId !== null

        const x = PADDING_X + (i * (BUTTON_W + BUTTON_GAP))

        // Determine button text
        let buttonText = '...'
        if (!this.state.isLoading) {
          buttonText = isConfigured
            ? this.truncateName(shortcut.lightName || 'Light', 8)
            : getText('NOT_CONFIGURED') || '---'
        }

        // Create or update button
        if (this.state.buttons[i]) {
          // Update existing button
          this.state.buttons[i].setProperty(prop.TEXT, buttonText)
          this.state.buttons[i].setProperty(prop.NORMAL_COLOR,
            isConfigured ? COLOR_CONFIGURED : COLOR_UNCONFIGURED)
        } else {
          // Create new button
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
            click_func: isConfigured
              ? () => this.toggleLight(shortcut.lightId, shortcut.lightName)
              : null
          })
          this.state.buttons[i] = btn
        }
      }
    },

    truncateName(name, maxLen) {
      if (!name) return '---'
      if (name.length <= maxLen) return name
      return name.substring(0, maxLen - 1) + '…'
    },

    toggleLight(lightId, lightName) {
      push({
        url: 'page/index',
        params: `lightId=${lightId}`,
      })
    },

    onDestroy() {
      logger.log('Widget destroyed')
    }

})