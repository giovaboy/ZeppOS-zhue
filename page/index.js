import { BasePage } from '@zeppos/zml/base-page'
import { createWidget, deleteWidget, prop } from '@zos/ui'
import { push } from '@zos/router'
import { connectStatus } from '@zos/ble'
import { renderMainWidgets } from 'zosLoader:./index.[pf].layout.js'
import { getText } from '@zos/i18n'
import { px } from '@zos/utils'
import { setPageBrightTime } from '@zos/display'
import { getLogger } from '../utils/logger.js'

const STATES = {
  LOADING: 'LOADING',
  SEARCHING_BRIDGE: 'SEARCHING_BRIDGE',
  WAITING_FOR_PRESS: 'WAITING_FOR_PRESS',
  FETCHING_DATA: 'FETCHING_DATA',
  ERROR: 'ERROR',
  BT_ERROR: 'BT_ERROR',
  SUCCESS: 'SUCCESS'
}

const logger = getLogger('zhue-index-page')

Page(
  BasePage({
    state: {
      currentState: STATES.LOADING,
      error: null,
      progress: {
        lights: 0
      },
      bridgeInfo: null
    },

    widgets: [],
    progressInterval: null,
    btCheckInterval: null, // ← Nuovo: per controllare periodicamente il BT

    onInit() {
      logger.debug('index page onInit')
    },

    build() {
      logger.log('Building index page')
      setPageBrightTime({ brightTime: 60000 })

      // Prima controlla il Bluetooth
      this.checkBluetoothConnection()
    },

    // --- BLUETOOTH CHECK ---

    checkBluetoothConnection() {
      logger.log('Checking Bluetooth connection...')

      if (!connectStatus()) {
        logger.warn('Bluetooth not connected')
        this.setState(STATES.BT_ERROR, {
          error: getText('BT_NOT_CONNECTED')
        })

        // Avvia un controllo periodico per vedere se il BT si riconnette
        this.startBluetoothMonitoring()
      } else {
        logger.log('Bluetooth connected')
        this.renderPage()
        this.checkInitialConnection()
      }
    },

    startBluetoothMonitoring() {
      // Controlla ogni 5 secondi se il BT si è riconnesso
      if (this.btCheckInterval) {
        clearInterval(this.btCheckInterval)
      }

      this.btCheckInterval = setInterval(() => {
        if (connectStatus()) {
          logger.log('Bluetooth reconnected!')
          this.stopBluetoothMonitoring()
          this.setState(STATES.LOADING)
          this.checkInitialConnection()
        }
      }, 5000)
    },

    stopBluetoothMonitoring() {
      if (this.btCheckInterval) {
        clearInterval(this.btCheckInterval)
        this.btCheckInterval = null
      }
    },

    // --- STATE MANAGEMENT ---

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

      this.widgets.forEach(w => {
        try { deleteWidget(w) } catch (e) {
          logger.error('Delete widget:', e)
        }
      })
      this.widgets = []
    },

    createTrackedWidget(type, props) {
      const w = createWidget(type, props)
      this.widgets.push(w)
      return w
    },

    // --- API/NETWORK LOGIC ---

    checkInitialConnection() {
      // Verifica nuovamente il BT prima di procedere
      if (!connectStatus()) {
        this.setState(STATES.BT_ERROR, {
          error: getText('BT_NOT_CONNECTED') || 'Bluetooth connection lost'
        })
        this.startBluetoothMonitoring()
        return
      }

      logger.log('Checking initial connection...')
      this.request({ method: 'CHECK_CONNECTION' })
        .then(result => {
          if (result.connected) {
            this.setState(STATES.FETCHING_DATA)
            this.fetchAllData()
          } else {
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

    startBridgeSearch() {
      // Verifica BT prima di cercare il bridge
      if (!connectStatus()) {
        this.setState(STATES.BT_ERROR, {
          error: getText('BT_NOT_CONNECTED') || 'Bluetooth connection required'
        })
        this.startBluetoothMonitoring()
        return
      }

      this.request({ method: 'DISCOVER_BRIDGES' })
        .then(result => {
          if (result.success && result.bridges?.length > 0) {
            this.state.bridgeInfo = { ip: result.autoSelected, bridges: result.bridges }
            this.setState(STATES.WAITING_FOR_PRESS)
            this.startPairing()
          } else {
            this.setState(STATES.ERROR, { error: getText('BRIDGE_NOT_FOUND') })
          }
        })
        .catch(err => {
          this.setState(STATES.ERROR, { error: err.message || getText('DISCOVERY_FAILED') })
        })
    },

    startPairing() {
      this.request({ method: 'PAIR' })
        .then(result => {
          if (result.success) {
            this.setState(STATES.FETCHING_DATA)
            this.fetchAllData()
          } else {
            this.setState(STATES.ERROR, { error: result.message || getText('PAIRING_FAILED') })
          }
        })
        .catch(err => {
          this.setState(STATES.ERROR, { error: err.message || getText('PAIRING_FAILED') })
        })
    },

    fetchAllData() {
      this.request({ method: 'GET_LIGHTS' })
        .then(result => {
          if (result.success && result.lights) {
            this.setState(STATES.FETCHING_DATA, { progress: { lights: result.lights.length } })
            this.setState(STATES.SUCCESS)
          } else {
            this.setState(STATES.ERROR, { error: getText('FAILED_TO_FETCH_LIGHTS_DATA') })
          }
        })
        .catch(err => {
          this.setState(STATES.ERROR, { error: err.message || getText('FAILED_TO_FETCH_LIGHTS_DATA') })
        })
    },

    retry() {
      // Controlla prima il BT prima di ritentare
      if (!connectStatus()) {
        this.setState(STATES.BT_ERROR, {
          error: getText('BT_NOT_CONNECTED') || 'Please connect Bluetooth first'
        })
        this.startBluetoothMonitoring()
        return
      }

      this.state.error = null
      this.state.progress = { lights: 0 }
      this.setState(STATES.SEARCHING_BRIDGE)
      this.startBridgeSearch()
    },

    navigateToGroups() {
      logger.log('Navigating to groups page')
      this.stopBluetoothMonitoring() // Ferma il monitoring quando si esce
      push({ url: 'page/groups', params: {} })
    },

    // --- UI RENDERING (DELEGATO) ---

    renderPage() {
      this.clearAllWidgets()

      // L'unica vera logica qui è decidere quale UI disegnare.
      if (this.state.currentState === STATES.SUCCESS) {
        this.navigateToGroups()
        return
      }

      // Chiama la funzione di layout importata, passando il contesto e lo stato.
      renderMainWidgets(this, this.state, {
        retryFunc: () => this.retry(),
        animateSpinner: (w) => this.animateSpinner(w),
        animateProgressBar: (w) => this.animateProgressBar(w)
      })
    },

    // --- ANIMATIONS (MANIPOLAZIONE WIDGET) ---

    animateSpinner(spinner) {
      let alpha = 255
      let direction = -1

      if (this.progressInterval) clearInterval(this.progressInterval)

      this.progressInterval = setInterval(() => {
        alpha += direction * 15
        if (alpha < 100) {
          direction = 1
        } else if (alpha > 255) {
          direction = -1
        }
        try {
          spinner.setProperty(prop.ALPHA, alpha)
        } catch {
          logger.error('spinner.setProperty')
        }
      }, 150)
    },

    animateProgressBar(progressBar) {
      let progress = 0
      this.progressInterval = setInterval(() => {
        if (!this.widgets.includes(progressBar)) {
          clearInterval(this.progressInterval)
          this.progressInterval = null
          return
        }
        progress = (progress + 5) % 100
        try {
          progressBar.setProperty(prop.W, px(10 + 2 * progress))
        } catch {
          logger.error('progressBar.setProperty')
        }
      }, 150)
    },

    onDestroy() {
      logger.debug('index page onDestroy')
      this.stopBluetoothMonitoring() // ← Importante: ferma il monitoring
      this.clearAllWidgets()
    }
  })
)