import { BasePage } from '@zeppos/zml/base-page'
import { createWidget, deleteWidget } from '@zos/ui'
import { exit, push } from '@zos/router'
import { getText } from '@zos/i18n'
import { onGesture, onKey, GESTURE_RIGHT, KEY_BACK, KEY_EVENT_CLICK } from '@zos/interaction'
import { setPageBrightTime } from '@zos/display'
import { renderGroupsPage } from 'zosLoader:./groups.[pf].layout.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger('zhue-groups-page')

Page(
  BasePage({
    state: {
      rooms: [],
      zones: [],
      currentTab: 'ROOMS',
      isLoading: false,
      error: null
    },
    
    widgets: [],
    
    onInit(p) {
      logger.debug('Groups page onInit')
      
      // ✅ Controlla se abbiamo dati precaricati
      let params = {}
      try {
        params = typeof p === 'string' ? JSON.parse(p) : (p || {})
      } catch (e) {
        logger.error('Error parsing params:', e)
      }
      
      // Se abbiamo dati precaricati, usali subito
      if (params.preloadedData) {
        logger.log('Using preloaded data from index page')
        this.state.rooms = params.preloadedData.rooms || []
        this.state.zones = params.preloadedData.zones || []
        this.state.isLoading = false
      }
    },
    
    build() {
      setPageBrightTime({ brightTime: 60000 })
      
      // Setup interazioni fisiche
      onGesture({
        callback: (event) => {
          if (event === GESTURE_RIGHT) {
            exit()
          }
          return true
        }
      })
      
      onKey({
        callback: (key, keyEvent) => {
          if (key === KEY_BACK && keyEvent === KEY_EVENT_CLICK) {
            exit()
          }
          return true
        }
      })
      
      // ✅ Se NON abbiamo dati, caricali
      if (this.state.rooms.length === 0 && this.state.zones.length === 0) {
        logger.log('No preloaded data, loading from API...')
        this.loadGroupsData()
      } else {
        logger.log('Rendering with preloaded data')
        this.renderPage()
      }
    },
    
    // --- HELPER WIDGET ---
    
    createTrackedWidget(type, props) {
      const w = createWidget(type, props)
      if (!this.widgets) this.widgets = []
      this.widgets.push(w)
      return w
    },
    
    clearAllWidgets() {
      this.widgets.forEach(w => {
        try { deleteWidget(w) } catch (e) {
          logger.error('clearAllWidgets error:', e)
        }
      })
      this.widgets = []
    },
    
    // --- DATA LOGIC ---
    
    loadGroupsData() {
      this.state.isLoading = true
      this.state.error = null
      this.renderPage()
      
      this.request({ method: 'GET_GROUPS' })
        .then(result => {
          this.state.isLoading = false
          if (result.success && result.data) {
            this.state.rooms = result.data.rooms || []
            this.state.zones = result.data.zones || []
            logger.log(`Loaded ${this.state.rooms.length} rooms, ${this.state.zones.length} zones`)
            this.renderPage()
          } else {
            this.state.error = 'Failed to load groups'
            this.renderPage()
          }
        })
        .catch(err => {
          logger.error('Load groups error:', err)
          this.state.isLoading = false
          this.state.error = err.message || 'Network Error'
          this.renderPage()
        })
    },
    
    toggleGroup(groupRaw) {
      logger.log('Toggle group:', groupRaw.name)
      
      const currentOnState = !!(groupRaw.on_off || groupRaw.anyOn)
      const newState = !currentOnState
      
      this.request({
          method: 'TOGGLE_GROUP',
          params: {
            groupId: groupRaw.id,
            state: newState
          }
        })
        .then(result => {
          if (result.success) {
            // Aggiorna lo stato
            groupRaw.on_off = newState
            if (groupRaw.hasOwnProperty('anyOn')) {
              groupRaw.anyOn = newState
            }
            this.renderPage()
          }
        })
        .catch(err => logger.error('Toggle group error:', err))
    },
    
    switchTab(tabName) {
      if (this.state.currentTab === tabName) return
      this.state.currentTab = tabName
      this.renderPage()
    },
    
    // --- RENDERING ---
    
    renderPage() {
      this.clearAllWidgets()
      
      // Prepara i dati per la lista
      const rawList = this.state.currentTab === 'ROOMS' ? this.state.rooms : this.state.zones
      
      const viewData = rawList.map(item => ({
        name: item.name,
        status: `${item.lights?.length || 0} ${item.lights?.length === 1 ? getText('LIGHT') : getText('LIGHTS')}`,
        on_off: (item.anyOn === true || item.on_off === true) ? getText('ON') : getText('OFF'),
        raw: item
      }))
      
      // Chiama il layout
      renderGroupsPage(this, this.state, viewData, {
        switchTab: (tab) => this.switchTab(tab),
        refresh: () => this.loadGroupsData(),
        
        handleListItemClick: (index, data_key) => {
          const item = viewData[index]
          if (!item) return
          
          logger.debug('List click:', item.raw.name, 'key:', data_key)
          
          if (data_key === 'on_off') {
            // Toggle
            this.toggleGroup(item.raw)
          } else {
            // Naviga al dettaglio
            const paramsString = JSON.stringify({
              groupId: item.raw.id,
              groupType: item.raw.type,
              groupName: item.raw.name
            })
            push({
              url: 'page/group-detail',
              params: paramsString
            })
          }
        }
      })
    },
    
    onDestroy() {
      this.clearAllWidgets()
      this.state.rooms = []
      this.state.zones = []
    }
  })
)