import { BasePage } from '@zeppos/zml/base-page'
import { COLORS } from 'zosLoader:./index.[pf].layout.js'
import { px } from '@zos/utils'
import { setPageBrightTime } from '@zos/display'
import { getLogger } from '../utils/logger.js'
import { createWidget, deleteWidget, widget, align, prop, text_style } from '@zos/ui'

const logger = getLogger('hue-on-off-index-page')

Page(
  BasePage({
    state: {
      lights: [],
      isPairing: false,
      isConnected: false
    },

    widgets: [],
    progressInterval: null,
    onInit() {
      logger.debug('page onInit invoked')
    },
    build() {
      logger.log('Building Hue control page')
      setPageBrightTime({ brightTime: 60000 })
      this.checkInitialConnection()
    },

    checkInitialConnection() {
      this.request({ method: 'CHECK_CONNECTION' })
        .then(result => {
          logger.log('Connection check:', result)
          if (result.connected) {
            this.state.isConnected = true
            this.refreshLights()
          } else {
            this.renderPage()
          }
        })
        .catch(err => {
          logger.error('Initial connection error:', err)
          this.renderPage()
        })
    },

    clearAllWidgets() {
      logger.log('Clearing', this.widgets.length, 'widgets')
      this.widgets.forEach(w => {
                try { deleteWidget(w) } catch (e) {}
      })
      this.widgets = []
    },

    createTrackedWidget(type, props) {
      const w = createWidget(type, props)
      this.widgets.push(w)
      return w
    },

    renderPage() {
      this.clearAllWidgets()

      if (this.state.isPairing) {
        this.renderPairingScreen()
      } else if (!this.state.isConnected || this.state.lights.length === 0) {
        this.renderInitialScreen()
      } else {
        this.renderLightsScreen()
      }
    },

    // --- INITIAL SCREEN ---
    renderInitialScreen() {
      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: px(480), h: px(480),
        color: COLORS.background
      })

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(40), w: px(480), h: px(60),
        text: 'Hue Lights',
        text_size: px(40),
        color: COLORS.text,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(120), w: px(480), h: px(40),
        text: 'Bridge not connected',
        text_size: px(26),
        color: COLORS.error,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      this.createTrackedWidget(widget.BUTTON, {
        x: px(90), y: px(200), w: px(300), h: px(60),
        text: 'PAIR BRIDGE',
        text_size: px(26),
        normal_color: COLORS.warning,
        press_color: COLORS.highlight,
        radius: px(10),
        click_func: () => this.startPairing()
      })

      this.createTrackedWidget(widget.BUTTON, {
        x: px(90), y: px(280), w: px(300), h: px(50),
        text: 'DISCOVER BRIDGES',
        text_size: px(22),
        normal_color: COLORS.highlight,
        press_color: COLORS.success,
        radius: px(10),
        click_func: () => this.discoverBridges()
      })
    },

    // --- PAIRING SCREEN ---
    renderPairingScreen() {
      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: px(480), h: px(480),
        color: COLORS.warning
      })

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(60), w: px(480), h: px(50),
        text: 'Hue Bridge',
        text_size: px(36),
        color: COLORS.warningText,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      this.createTrackedWidget(widget.CIRCLE, {
        center_x: px(240),
        center_y: px(200),
        radius: px(50),
        color: COLORS.warningText
      })

      this.createTrackedWidget(widget.TEXT, {
        x: px(40), y: px(280), w: px(400), h: px(120),
        text: 'Press the button on your Hue bridge...',
        text_size: px(28),
        color: COLORS.warningText,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP
      })

      const progressBar = this.createTrackedWidget(widget.FILL_RECT, {
        x: px(120), y: px(420), w: px(10), h: px(6),
        color: COLORS.warningText,
        radius: px(3)
      })

      this.animateProgress(progressBar)
      this.doPairing()
    },

    animateProgress(progressBar) {
      if (this.progressInterval) clearInterval(this.progressInterval)
      let progress = 0
      this.progressInterval = setInterval(() => {
        if (!this.state.isPairing) return clearInterval(this.progressInterval)
        progress = (progress + 5) % 100
        try {
          progressBar.setProperty(prop.W, px(10 + 2.5 * progress))
        } catch {}
      }, 150)
    },

    doPairing() {
      this.state.isPairing = true
      this.request({ method: 'PAIR' })
        .then(res => {
          logger.log('Pairing response:', res)
          if (res?.success) {
            this.state.isPairing = false
            this.state.isConnected = true
            this.refreshLights()
          } else if (res?.error === 'BUTTON_NOT_PRESSED') {
            logger.log('Waiting for button press...')
          } else {
            this.endPairing(res?.message || 'Pairing failed')
          }
        })
        .catch(err => {
          logger.error('Pairing error:', err)
          this.endPairing(err.message)
        })
    },

    endPairing(msg) {
      logger.log('End pairing:', msg)
      this.state.isPairing = false
      this.renderPage()
    },

    // --- LIGHTS SCREEN ---
    renderLightsScreen() {
      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: px(480), h: px(480),
        color: COLORS.background
      })

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(20), w: px(480), h: px(50),
        text: 'Hue Lights',
        text_size: px(38),
        color: COLORS.text,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      const lights = this.state.lights.slice(0, 3)
      lights.forEach((light, i) => this.renderLightItem(light, i))

      this.createTrackedWidget(widget.BUTTON, {
        x: px(30), y: px(380), w: px(190), h: px(50),
        text: 'ALL ON',
        text_size: px(22),
        normal_color: COLORS.highlight,
        press_color: COLORS.success,
        click_func: () => this.toggleAllLights(true)
      })

      this.createTrackedWidget(widget.BUTTON, {
        x: px(260), y: px(380), w: px(190), h: px(50),
        text: 'ALL OFF',
        text_size: px(22),
        normal_color: COLORS.highlight,
        press_color: COLORS.error,
        click_func: () => this.toggleAllLights(false)
      })

      this.createTrackedWidget(widget.BUTTON, {
        x: px(190), y: px(320), w: px(100), h: px(45),
        text: 'REFRESH',
        text_size: px(18),
        normal_color: 0x333333,
        press_color: COLORS.highlight,
        click_func: () => this.refreshLights()
      })
    },

    renderLightItem(light, index) {
      const y = px(100 + index * 85)
      const color = this.getLightBgColor(light)
      const textColor = light.ison ? COLORS.text : COLORS.inactive

      this.createTrackedWidget(widget.FILL_RECT, {
        x: px(20), y, w: px(440), h: px(75),
        color, radius: px(10)
      })

      this.createTrackedWidget(widget.TEXT, {
        x: px(30), y: y + px(10), w: px(420), h: px(40),
        text: light.name,
        text_size: px(30),
        color: textColor
      })

      this.createTrackedWidget(widget.BUTTON, {
        x: px(20), y, w: px(440), h: px(75),
        text: '',
        normal_color: 0x00000000,
        press_color: 0x33ffffff,
        click_func: () => this.toggleLight(light)
      })
    },

    getLightBgColor(light) {
      if (!light.ison || !light.hex) return 0x1a1a1a
      const hex = light.hex.replace('#', '')
      const color = parseInt(hex, 16)
      return ((color >> 2) & 0x3f3f3f) + 0x202020
    },

    startPairing() {
      this.state.isPairing = true
      this.renderPage()
    },

    discoverBridges() {
      this.request({ method: 'DISCOVER_BRIDGES' })
        .then(r => logger.log('Discovery result:', r))
        .catch(e => logger.error('Discovery failed:', e))
    },

    toggleLight(light) {
      this.request({
        method: 'TOGGLE_LIGHT',
        params: { id: light.id, state: !light.ison }
      })
        .then(() => {
          light.ison = !light.ison
          this.renderPage()
        })
        .catch(e => logger.error('Toggle failed:', e))
    },

    toggleAllLights(state) {
      this.request({ method: 'ALL_LIGHTS', params: { state } })
        .then(() => setTimeout(() => this.refreshLights(), 400))
        .catch(e => logger.error('All lights error:', e))
    },

    refreshLights() {
      this.request({ method: 'GET_LIGHTS' })
        .then(res => {
          if (res?.lights) {
            this.state.lights = res.lights
            this.renderPage()
          }
        })
        .catch(e => logger.error('Get lights error:', e))
    },

    onDestroy() {
      logger.debug('page onDestroy invoked')
      if (this.progressInterval) clearInterval(this.progressInterval)
      this.clearAllWidgets()
    }
  })
)
