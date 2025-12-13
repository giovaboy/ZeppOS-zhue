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
        rooms: 0,
        zones: 0
      },
      bridgeInfo: null,
      groupsData: null // ← Nuovo: per salvare i dati da passare
    },

    widgets: [],
    progressInterval: null,
    btCheckInterval: null,

    onInit() {
      logger.debug('index page onInit')
    },

    build() {
      logger.log('Building index page')
      setPageBrightTime({ brightTime: 60000 })
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
        this.startBluetoothMonitoring()
      } else {
        logger.log('Bluetooth connected')
        this.renderPage()
        this.checkInitialConnection()
      }
    },

    startBluetoothMonitoring() {
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

    fetchAllData_old() {
      // ✅ CAMBIATO: Ora chiamiamo GET_GROUPS invece di GET_LIGHTS
      this.request({ method: 'GET_GROUPS' })
        .then(result => {
          if (result.success && result.data) {
            // Salva i dati per passarli alla pagina groups
            this.state.groupsData = result.data
            
            const totalGroups = (result.data.rooms?.length || 0) + (result.data.zones?.length || 0)
            
            logger.log(`Loaded ${totalGroups} groups (${result.data.rooms?.length || 0} rooms, ${result.data.zones?.length || 0} zones)`)
            
            /*this.setState(STATES.FETCHING_DATA, { 
              progress: { 
                rooms: result.data.rooms?.length || 0,
                zones: result.data.zones?.length || 0
              } 
            })*/
            
            this.setState(STATES.SUCCESS)
          } else {
            this.setState(STATES.ERROR, { error: getText('FAILED_TO_FETCH_DATA')})
          }
        })
        .catch(err => {
          this.setState(STATES.ERROR, { error: err.message || getText('FAILED_TO_FETCH_DATA') })
        })
    },
    
    fetchAllData() {
      this.request({ method: 'GET_GROUPS' })
        .then(result => {
          if (result.success && result.data) {
            
            // 🔥 MODIFICA QUI: Salviamo nel Global Store invece che nello stato locale
            const app = getApp()
            app.setGroupsData(result.data)
            
            const totalGroups = (result.data.rooms?.length || 0) + (result.data.zones?.length || 0)
            logger.log(`Loaded and stored ${totalGroups} groups globally`)
            
            this.setState(STATES.SUCCESS)
          } else {
            this.setState(STATES.ERROR, { error: getText('FAILED_TO_FETCH_DATA')})
          }
        })
        .catch(err => {
          this.setState(STATES.ERROR, { error: err.message || getText('FAILED_TO_FETCH_DATA') })
        })
    },

    retry() {
      if (!connectStatus()) {
        this.setState(STATES.BT_ERROR, {
          error: getText('BT_NOT_CONNECTED')
        })
        this.startBluetoothMonitoring()
        return
      }

      this.state.error = null
      this.state.progress = { rooms: 0, zones: 0 }
      this.state.groupsData = null
      this.setState(STATES.SEARCHING_BRIDGE)
      this.startBridgeSearch()
    },

    navigateToGroups_old() {
      logger.log('Navigating to groups page with preloaded data')
      this.stopBluetoothMonitoring()
      
      // ✅ Passa i dati come parametro
      const params = this.state.groupsData ? JSON.stringify({
        preloadedData: this.state.groupsData
      }) : '{}'
      
      push({ 
        url: 'page/groups', 
        params: params
      })
    },
    
    navigateToGroups() {
      logger.log('Navigating to groups page')
      this.stopBluetoothMonitoring()
      
      // 🔥 MODIFICA QUI: Nessun parametro pesante!
      // Il router ringrazia.
      push({ 
        url: 'page/groups'
      })
    },

    // --- UI RENDERING ---

    renderPage() {
      this.clearAllWidgets()

      if (this.state.currentState === STATES.SUCCESS) {
        this.navigateToGroups()
        return
      }

      renderMainWidgets(this, this.state, {
        retryFunc: () => this.retry(),
        animateSpinner: (w) => this.animateSpinner(w),
        animateProgressBar: (w) => this.animateProgressBar(w)
      })
    },

    // --- ANIMATIONS ---

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
      }, 100)
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
      this.stopBluetoothMonitoring()
      this.clearAllWidgets()
    }
  })
)