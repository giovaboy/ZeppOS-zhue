import { BasePage } from '@zeppos/zml/base-page'
import { createWidget, deleteWidget } from '@zos/ui'
import { exit, push } from '@zos/router'
import { getText } from '@zos/i18n'
import { onGesture, onKey, GESTURE_RIGHT, KEY_BACK, KEY_EVENT_CLICK } from '@zos/interaction'
import { setPageBrightTime } from '@zos/display'
import { renderGroupsPage } from 'zosLoader:./groups.[pf].layout.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger('zhue-groups-page')
const app = getApp()

Page(
  BasePage({
    state: {
      rooms: [],
      zones: [],
      currentTab: 'ROOMS',
      isLoading: false,
      error: null,
      scrollPos_y: 0
    },

    widgets: [],

    onInit(p) {
      logger.debug('Groups page onInit')

      this.state.currentTab = app.getCurrentTab()
      this.state.scrollPos_y = app.getGroupsScrollY()
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

      // Calcolo ottimistico
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
            // 1. Aggiorna l'oggetto locale (per la UI immediata)
            groupRaw.on_off = newState
            if (groupRaw.hasOwnProperty('anyOn')) {
              groupRaw.anyOn = newState
            }

            // 2. Aggiorna la lista nel Global Store (per coerenza se cambi tab)
            const globalData = app.getGroupsData()
            const list = groupRaw.type === 'room' ? globalData.rooms : globalData.zones
            const item = list.find(g => g.id === groupRaw.id)
            if (item) {
              item.anyOn = newState
              item.on_off = newState
            }

            // 3. ✅ IL PEZZO MANCANTE: Aggiorna la cache del dettaglio!
            // Questo usa la funzione che abbiamo aggiunto in app.js
            if (typeof app.updateGroupStatusInCache === 'function') {
              app.updateGroupStatusInCache(groupRaw.id, newState)
            } else {
              logger.warn('app.updateGroupStatusInCache is missing!')
            }

            this.renderPage()
          }
        })
        .catch(err => logger.error('Toggle group error:', err))
    },

    switchTab(tabName) {
      if (this.state.currentTab === tabName) return
      app.setGroupsScrollY(this.state.scrollPos_y)

      this.state.currentTab = tabName
      app.setCurrentTab(tabName)

      // 👇 RECUPERA scroll position del nuovo tab
      this.state.scrollPos_y = app.getGroupsScrollY()
      this.renderPage()
    },

    onScrollChange(y) {
      // Questa funzione viene chiamata dal VIEW_CONTAINER nel layout
      if (this.state.scrollPos_y !== y) {
        this.state.scrollPos_y = y

        // Nota: Non chiamiamo renderPage() qui per evitare un ciclo infinito
        // e un consumo eccessivo di risorse. Lo stato viene solo aggiornato.
        //logger.debug(`Scroll Y saved: ${y}`)
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
        onScrollChange: (y) => this.onScrollChange(y),
        handleListItemClick: (index, data_key) => {
          const item = viewData[index]
          if (!item) return

          logger.debug('List click:', item.raw.name, 'key:', data_key)

          if (data_key === 'on_off') {
            this.toggleGroup(item.raw)
          } else {
            app.setGroupsScrollY(this.state.scrollPos_y)
            app.setCurrentTab(this.state.currentTab)
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
      app.setCurrentTab(this.state.currentTab)
      app.setGroupsScrollY(this.state.scrollPos_y)
      this.clearAllWidgets()
    }
  })
)