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
      error: null,
      scrollPos_y: null
    },
    
    widgets: [],
    
    onInit(p) {
      logger.debug('Groups page onInit')
      const app = getApp()
      this.state.currentTab = app.getCurrentTab()
      logger.debug('Restored tab:', this.state.currentTab)
      
      // 1. Controlla se dobbiamo ricaricare
      const needsRefresh = app.globalData.needsGroupsRefresh
      
      if (needsRefresh) {
        logger.debug('Refresh flag set, will reload from API')
        app.globalData.needsGroupsRefresh = false
        // Non carichiamo qui, lo farà build()
        return
      }
      
      // 2. Prova a usare dati dal global store
      const globalData = app.getGroupsData()
      
      if (globalData.hasLoadedOnce) {
        logger.log('Using global store data')
        this.state.rooms = globalData.rooms
        this.state.zones = globalData.zones
        this.state.isLoading = false
      } else {
        logger.log('No global data available')
        // build() caricherà i dati
      }
    },
    
    build() {
      setPageBrightTime({ brightTime: 60000 })
      
      // Setup gesture di uscita
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
      
      // Carica SOLO se non abbiamo dati
      if (this.state.rooms.length === 0 && this.state.zones.length === 0) {
        logger.log('No data in state, loading from API...')
        this.loadGroupsData()
      } else {
        logger.log('Rendering with existing data')
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
            // ✅ Salva nel global store
            const app = getApp()
            app.setGroupsData(result.data)
            
            // ✅ Aggiorna anche lo stato locale per il render
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
            // ✅ Aggiorna stato locale
            groupRaw.on_off = newState
            if (groupRaw.hasOwnProperty('anyOn')) {
              groupRaw.anyOn = newState
            }
            
            // ✅ Aggiorna anche global store
            const app = getApp()
            const globalData = app.getGroupsData()
            
            // Trova e aggiorna nel global store
            const list = groupRaw.type === 'room' ? globalData.rooms : globalData.zones
            const item = list.find(g => g.id === groupRaw.id)
            if (item) {
              item.anyOn = newState
              item.on_off = newState
            }
            
            this.renderPage()
          }
        })
        .catch(err => logger.error('Toggle group error:', err))
    },
    
    switchTab(tabName) {
      if (this.state.currentTab === tabName) return
      this.state.currentTab = tabName
      const app = getApp()
      app.setCurrentTab(tabName)
      this.renderPage()
    },
    
    onScrollChange(y) {
        // Questa funzione viene chiamata dal VIEW_CONTAINER nel layout
        if (this.state.scrollPos_y !== y) {
            this.state.scrollPos_y = y
            // Nota: Non chiamiamo renderPage() qui per evitare un ciclo infinito 
            // e un consumo eccessivo di risorse. Lo stato viene solo aggiornato.
            logger.debug(`Scroll Y saved: ${y}`)
        }
    },
    
    // --- RENDERING ---
    
    renderPage() {
      this.clearAllWidgets()
      
      const rawList = this.state.currentTab === 'ROOMS' ? this.state.rooms : this.state.zones
      
      const viewData = rawList.map(item => ({
        name: item.name,
        status: `${item.lights?.length || 0} ${item.lights?.length === 1 ? getText('LIGHT') : getText('LIGHTS')}`,
        on_off: (item.anyOn === true || item.on_off === true) ? getText('ON') : getText('OFF'),
        raw: item
      }))
      
      renderGroupsPage(this, this.state, viewData, {
        switchTab: (tab) => this.switchTab(tab),
        refresh: () => this.loadGroupsData(),
        
        handleListItemClick: (index, data_key) => {
          const item = viewData[index]
          if (!item) return
          
          logger.debug('List click:', item.raw.name, 'key:', data_key)
          
          if (data_key === 'on_off') {
            this.toggleGroup(item.raw)
          } else {
            const app = getApp()
            app.setCurrentTab(this.state.currentTab)
            app.globalData.isComingBackFromDetail = true
            
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
      const app = getApp()
      app.setCurrentTab(this.state.currentTab)
      this.clearAllWidgets()
    }
  })
)