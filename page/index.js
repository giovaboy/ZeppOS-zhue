import { BasePage } from '@zeppos/zml/base-page'
import { COLORS } from 'zosLoader:./index.[pf].layout.js'
import { px } from '@zos/utils'
import { getText } from '@zos/i18n'
import { setPageBrightTime } from '@zos/display'
import { getLogger } from '../utils/logger.js'
import { createWidget, deleteWidget, widget, align, prop, text_style } from '@zos/ui'
import { push, replace } from '@zos/router'

const logger = getLogger('hue-welcome-page')

// Stati della pagina benvenuto
const STATES = {
  SEARCHING_BRIDGE: 'SEARCHING_BRIDGE',
  WAITING_FOR_PRESS: 'WAITING_FOR_PRESS',
  FETCHING_DATA: 'FETCHING_DATA',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS'
}

Page(
  BasePage({
    state: {
      currentState: STATES.SEARCHING_BRIDGE,
      error: null,
      progress: {
        rooms: 0,
        zones: 0,
        lights: 0,
        scenes: 0
      },
      bridgeInfo: null
    },

    widgets: [],
    progressInterval: null,
    retryTimeout: null,

    onInit() {
      logger.debug('Welcome page onInit')
    },

    build() {
      logger.log('Building Welcome page')
      setPageBrightTime({ brightTime: 60000 })
      this.checkInitialConnection()
    },

    checkInitialConnection() {
      logger.log('Checking initial connection...')

      this.request({ method: 'CHECK_CONNECTION' })
        .then(result => {
          logger.log('Connection check result:', result)

          if (result.connected) {
            // Bridge già connesso -> vai alla lista luci/gruppi
            // (per ora usiamo GET_LIGHTS per verificare se ci sono dati)
            logger.log('Bridge connected, checking for data...')
            this.request({ method: 'GET_LIGHTS' })
              .then(lightsResult => {
                if (lightsResult.success && lightsResult.lights?.length > 0) {
                  logger.log('Data available, navigating to groups')
                  this.navigateToGroups()
                } else {
                  logger.log('No data, fetching...')
                  this.setState(STATES.FETCHING_DATA)
                  this.fetchAllData()
                }
              })
              .catch(err => {
                logger.error('Get lights failed:', err)
                this.setState(STATES.SEARCHING_BRIDGE)
                this.startBridgeSearch()
              })
          } else {
            // Bridge non connesso -> inizia ricerca
            logger.log('Bridge not connected, starting search')
            this.setState(STATES.SEARCHING_BRIDGE)
            this.startBridgeSearch()
          }
        })
        .catch(err => {
          logger.error('Initial connection check failed:', err)
          this.setState(STATES.SEARCHING_BRIDGE)
          this.startBridgeSearch()
        })
    },

    setState(newState, data = {}) {
      logger.log(`State transition: ${this.state.currentState} -> ${newState}`)
      this.state.currentState = newState

      if (data.error) this.state.error = data.error
      if (data.progress) this.state.progress = { ...this.state.progress, ...data.progress }
      if (data.bridgeInfo) this.state.bridgeInfo = data.bridgeInfo

      this.renderPage()
    },

    clearAllWidgets() {
      if (this.progressInterval) {
        clearInterval(this.progressInterval)
        this.progressInterval = null
      }
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout)
        this.retryTimeout = null
      }

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

      switch (this.state.currentState) {
        case STATES.SEARCHING_BRIDGE:
          this.renderSearchingState()
          break
        case STATES.WAITING_FOR_PRESS:
          this.renderWaitingState()
          break
        case STATES.FETCHING_DATA:
          this.renderFetchingState()
          break
        case STATES.ERROR:
          this.renderErrorState()
          break
        case STATES.SUCCESS:
          this.navigateToGroups()
          break
      }
    },

    // --- SEARCHING_BRIDGE STATE ---
    renderSearchingState() {
      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: px(480), h: px(480),
        color: COLORS.background
      })

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(40), w: px(480), h: px(60),
        text: 'Hue Bridge',
        text_size: px(40),
        color: COLORS.text,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      // Spinner animato
      const spinner = this.createTrackedWidget(widget.CIRCLE, {
        center_x: px(240),
        center_y: px(180),
        radius: px(40),
        color: COLORS.highlight,
        alpha: 150
      })
      this.animateSpinner(spinner)

      this.createTrackedWidget(widget.TEXT, {
        x: px(40), y: px(260), w: px(400), h: px(80),
        text: 'Searching for Hue Bridge on your network...',
        text_size: px(26),
        color: COLORS.text,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP
      })

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(360), w: px(480), h: px(40),
        text: 'Make sure your bridge is powered on',
        text_size: px(20),
        color: COLORS.inactive,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      // Progress bar
      const progressBar = this.createTrackedWidget(widget.FILL_RECT, {
        x: px(140), y: px(420), w: px(10), h: px(6),
        color: COLORS.highlight,
        radius: px(3)
      })
      this.animateProgressBar(progressBar)
    },

    // --- WAITING_FOR_PRESS STATE ---
    renderWaitingState() {
      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: px(480), h: px(480),
        color: COLORS.warning
      })

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(50), w: px(480), h: px(50),
        text: 'Bridge Found!',
        text_size: px(38),
        color: COLORS.warningText,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      // Icona bridge pulsante
      const bridgeIcon = this.createTrackedWidget(widget.CIRCLE, {
        center_x: px(240),
        center_y: px(180),
        radius: px(50),
        color: COLORS.warningText
      })
      this.animatePulse(bridgeIcon)

      this.createTrackedWidget(widget.TEXT, {
        x: px(40), y: px(270), w: px(400), h: px(100),
        text: 'Press the button on your Hue Bridge to pair',
        text_size: px(28),
        color: COLORS.warningText,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP
      })

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(390), w: px(480), h: px(30),
        text: 'Waiting for button press...',
        text_size: px(20),
        color: COLORS.warningText,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      // Progress bar
      const progressBar = this.createTrackedWidget(widget.FILL_RECT, {
        x: px(140), y: px(440), w: px(10), h: px(6),
        color: COLORS.warningText,
        radius: px(3)
      })
      this.animateProgressBar(progressBar)
    },

    // --- FETCHING_DATA STATE ---
    renderFetchingState() {
      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: px(480), h: px(480),
        color: COLORS.success
      })

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(40), w: px(480), h: px(50),
        text: 'Paired Successfully!',
        text_size: px(36),
        color: 0xffffff,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      // Checkmark icon
      this.createTrackedWidget(widget.CIRCLE, {
        center_x: px(240),
        center_y: px(140),
        radius: px(45),
        color: 0xffffff
      })

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(210), w: px(480), h: px(40),
        text: 'Loading your Hue setup...',
        text_size: px(26),
        color: 0xffffff,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      // Progress indicators
      const { lights } = this.state.progress
      const yStart = px(280)

      this.createTrackedWidget(widget.TEXT, {
        x: px(60), y: yStart, w: px(360), h: px(40),
        text: `Lights: ${lights}`,
        text_size: px(28),
        color: 0xffffff,
        align_h: align.LEFT
      })

      // Note: rooms, zones, scenes verranno aggiunti quando implementati
    },

    // --- ERROR STATE ---
    renderErrorState() {
      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: px(480), h: px(480),
        color: COLORS.background
      })

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(60), w: px(480), h: px(50),
        text: 'Connection Error',
        text_size: px(36),
        color: COLORS.error,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      // Error icon
      this.createTrackedWidget(widget.CIRCLE, {
        center_x: px(240),
        center_y: px(160),
        radius: px(45),
        color: COLORS.error
      })

      this.createTrackedWidget(widget.TEXT, {
        x: px(40), y: px(240), w: px(400), h: px(100),
        text: this.state.error || 'Could not connect to Hue Bridge',
        text_size: px(24),
        color: COLORS.text,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP
      })

      this.createTrackedWidget(widget.BUTTON, {
        x: px(90), y: px(360), w: px(300), h: px(60),
        text: 'RETRY',
        text_size: px(28),
        normal_color: COLORS.highlight,
        press_color: COLORS.success,
        radius: px(10),
        click_func: () => this.retry()
      })
    },

    // --- ANIMATIONS ---
    animateSpinner(spinner) {
      let angle = 0
      this.progressInterval = setInterval(() => {
        angle = (angle + 10) % 360
        // Note: actual rotation would need custom implementation
      }, 50)
    },

    animateProgressBar(progressBar) {
      let progress = 0
      const interval = setInterval(() => {
        if (!this.widgets.includes(progressBar)) {
          clearInterval(interval)
          return
        }
        progress = (progress + 5) % 100
        try {
          progressBar.setProperty(prop.W, px(10 + 2 * progress))
        } catch {}
      }, 150)
    },

    animatePulse(circle) {
      let scale = 0
      let growing = true
      const interval = setInterval(() => {
        if (!this.widgets.includes(circle)) {
          clearInterval(interval)
          return
        }
        if (growing) {
          scale += 2
          if (scale >= 10) growing = false
        } else {
          scale -= 2
          if (scale <= 0) growing = true
        }
        try {
          circle.setProperty(prop.RADIUS, px(50 + scale))
        } catch {}
      }, 100)
    },

    // --- BRIDGE OPERATIONS ---
    startBridgeSearch() {
      this.request({ method: 'DISCOVER_BRIDGES' })
        .then(result => {
          logger.log('Discovery result:', result)

          // Fix: app-side risponde con { success: true, bridges: [...], autoSelected: '...' }
          if (result.success && result.bridges?.length > 0) {
            logger.log('Bridge found:', result.autoSelected)
            this.state.bridgeInfo = {
              ip: result.autoSelected,
              bridges: result.bridges
            }
            this.setState(STATES.WAITING_FOR_PRESS)
            this.startPairing()
          } else {
            this.setState(STATES.ERROR, { error: 'No bridge found on network' })
          }
        })
        .catch(err => {
          logger.error('Bridge discovery error:', err)
          this.setState(STATES.ERROR, { error: err.message || 'Discovery failed' })
        })
    },

    startPairing() {
      // Fix: app-side usa 'PAIR' non 'PAIR_BRIDGE'
      // Il retry è gestito lato app-side con pairWithRetry()
      this.request({ method: 'PAIR' })
        .then(result => {
          logger.log('Pairing result:', result)

          if (result.success) {
            logger.log('Pairing successful')
            this.setState(STATES.FETCHING_DATA)
            this.fetchAllData()
          } else if (result.error === 'BUTTON_NOT_PRESSED') {
            // Non dovrebbe più succedere con pairWithRetry, ma gestiamo comunque
            logger.log('Button not pressed (unexpected with retry)')
            this.setState(STATES.ERROR, { error: 'Button not pressed in time' })
          } else {
            this.setState(STATES.ERROR, { error: result.message || 'Pairing failed' })
          }
        })
        .catch(err => {
          logger.error('Pairing error:', err)
          this.setState(STATES.ERROR, { error: err.message || 'Pairing failed' })
        })
    },

    fetchAllData() {
      // Per ora usiamo solo GET_LIGHTS
      // TODO: quando implementato, usare FETCH_ALL_DATA per rooms/zones/scenes
      this.request({ method: 'GET_LIGHTS' })
        .then(result => {
          logger.log('Lights fetch result:', result)

          if (result.success && result.lights) {
            this.setState(STATES.FETCHING_DATA, {
              progress: {
                lights: result.lights.length,
                rooms: 0,  // TODO
                zones: 0,  // TODO
                scenes: 0  // TODO
              }
            })

            // Wait a moment to show the progress, then navigate
            setTimeout(() => {
              this.setState(STATES.SUCCESS)
            }, 1500)
          } else {
            this.setState(STATES.ERROR, { error: 'Failed to fetch lights data' })
          }
        })
        .catch(err => {
          logger.error('Data fetch error:', err)
          this.setState(STATES.ERROR, { error: err.message || 'Failed to fetch data' })
        })
    },

    retry() {
      this.state.error = null
      this.state.progress = { rooms: 0, zones: 0, lights: 0, scenes: 0 }
      this.setState(STATES.SEARCHING_BRIDGE)
      this.startBridgeSearch()
    },

    navigateToGroups() {
      logger.log('Navigating to groups page')
      push({ url: 'page/groups', params: {} })

      // Per ora usiamo la pagina lights esistente
      // (commentare quando groups.js sarà implementata)
      //this.navigateToLights()
    },

    navigateToLights() {
      // Temporary: mostra la pagina luci base
      logger.log('Showing lights page (temporary)')
      this.renderLightsPage()
    },

    renderLightsPage() {
      // Placeholder: render simple lights list
      this.clearAllWidgets()

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

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(200), w: px(480), h: px(50),
        text: 'Connected!',
        text_size: px(30),
        color: COLORS.success,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      // Refresh button
      this.createTrackedWidget(widget.BUTTON, {
        x: px(90), y: px(320), w: px(300), h: px(60),
        text: 'REFRESH LIGHTS',
        text_size: px(24),
        normal_color: COLORS.highlight,
        press_color: COLORS.success,
        radius: px(10),
        click_func: () => this.fetchAllData()
      })
    },

    onDestroy() {
      logger.debug('Welcome page onDestroy')
      this.clearAllWidgets()
    }
  })
)