import { BasePage } from '@zeppos/zml/base-page'
import { createWidget, deleteWidget } from '@zos/ui'
import { exit, push } from '@zos/router'
import { getText } from '@zos/i18n'
import { onGesture, onKey, GESTURE_RIGHT, KEY_BACK, KEY_EVENT_CLICK } from '@zos/interaction'
import { setPageBrightTime } from '@zos/display'
import { renderGroupsPage } from 'zosLoader:./groups.[pf].layout.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger('hue-groups-page')

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

    onInit() {
      logger.debug('Groups page onInit')
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
        },
      })
      onKey({
        callback: (key, keyEvent) => {
          if (key === KEY_BACK && keyEvent === KEY_EVENT_CLICK) {
            exit()
          }
          return true
        },
      })

      // Avvia caricamento
      this.loadGroupsData()
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
      this.renderPage() // Mostra stato loading/scheletro

      this.request({ method: 'GET_GROUPS' })
        .then(result => {
          this.state.isLoading = false
          if (result.success && result.data) {
            this.state.rooms = result.data.rooms || []
            this.state.zones = result.data.zones || []
            this.renderPage()
          } else {
             this.state.error = 'Failed to load groups'
             this.renderPage()
          }
        })
        .catch(err => {
          logger.error('Load groups error:', err)
          this.state.isLoading = false
          this.state.error = err.message || "Network Error"
          this.renderPage()
        })
    },

    toggleGroup(groupRaw) {
      logger.log('Toggle group:', groupRaw.name)

      const currentOnState = groupRaw.on_off; // Assicurati che questo campo esista nel raw
      const newState = !currentOnState;

      // Aggiornamento ottimistico UI (opzionale, per reattività)
      // groupRaw.on_off = newState;
      // this.renderPage();

      this.request({
        method: 'TOGGLE_GROUP',
        params: {
          groupId: groupRaw.id,
          state: newState
        }
      })
        .then(result => {
          if (result.success) {
            // Aggiorna lo stato reale
            groupRaw.on_off = newState // Nota: questo modifica l'oggetto dentro state.rooms/zones

            // Aggiorna anche anyOn se presente
            if (groupRaw.hasOwnProperty('anyOn')) {
                 groupRaw.anyOn = newState;
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

      // 1. Prepara i dati per la lista (ViewModel)
      //    Trasformiamo i dati grezzi in ciò che la SCROLL_LIST deve visualizzare
      const rawList = this.state.currentTab === 'ROOMS' ? this.state.rooms : this.state.zones

      const viewData = rawList.map(item => ({
        name: item.name,
        status: `${item.lights?.length || 0} luci`,
        // Logica visuale: se anyOn è true scrivi ON, altrimenti OFF
        on_off: (item.anyOn === true || item.on_off === true) ? getText('ON') : getText('OFF'),
        raw: item // Manteniamo il riferimento all'oggetto originale per le azioni
      }))

      // 2. Chiama il layout
      renderGroupsPage(this, this.state, viewData, {
          switchTab: (tab) => this.switchTab(tab),
          refresh: () => this.loadGroupsData(),

          // Gestore Click Lista Complesso
          handleListItemClick: (index, data_key) => {
              const item = viewData[index]
              if (!item) return;

              logger.debug('List click:', item.raw.name, 'key:', data_key)

              if (data_key === 'on_off') {
                  // Click sul testo ON/OFF -> Toggle
                  this.toggleGroup(item.raw)
              } else {
                  // Click sulla riga -> Dettaglio
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
    }
  })
)