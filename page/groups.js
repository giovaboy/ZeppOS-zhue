import { BasePage } from '@zeppos/zml/base-page'
import { countCommands, commandCount } from '../utils/commands.js'
import { loggedPage, infoLog, warnLog } from '../utils/remote-log.js'
import { createGate } from '../utils/request-gate.js'
import { bindKeyNav } from '../utils/key-nav.js'
import { busyOn, stopPulses } from '../utils/pulse.js'
import { rememberGroups } from '../utils/shortcuts.js'
import { createWidget, deleteWidget } from '@zos/ui'
import { exit, push } from '@zos/router'
import { getText } from '@zos/i18n'
import { onGesture, GESTURE_RIGHT } from '@zos/interaction'
import { keepScreenOn } from '../utils/screen.js'
import { renderGroupsPage } from 'zosLoader:./groups.[pf].layout.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger('zhue-groups-page')
const app = getApp()

Page(
  loggedPage('groups', countCommands(BasePage({
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
      // BasePage shares `state` between instances of this page: start clean
      Object.assign(this.state, { rooms: [], zones: [], isLoading: false, error: null })
      this.widgets = []
      this._gate = createGate('groups')
      this._keys = null
      this._nav = null

      this._stale = false
      this._gone = false

      this.state.currentTab = app.getCurrentTab()
      this.state.scrollPos_y = app.getGroupsScrollY()

      // The list as last known, shown at once; when old or flagged (a group
      // switched elsewhere) it is read again behind it (build:
      // refreshQuietly). It used to show "Loading" 2-3 s at every return
      // from a group (log 15:44:07: 2.9 s)
      const globalData = app.globalData.groupsData
      if (globalData.hasLoadedOnce) {
        this.state.rooms = globalData.rooms
        this.state.zones = globalData.zones
        this._stale = app.shouldRefreshGroups()
      }
    },

    build() {
      keepScreenOn('groups')

      // Setup gesture di uscita
      onGesture({
        callback: (event) => {
          if (event === GESTURE_RIGHT) {
            exit()
          }
          return true
        }
      })

      // Physical buttons: UP / DOWN between the tabs and the groups, SELECT
      // opens (or switches tab), held SELECT switches the group, BACK leaves
      // the app (this page is the app's first after the start)
      this._keys = bindKeyNav({
        getItems: () => (this._nav && this._nav.items) || [],
        onBack: () => exit(),
        label: 'groups'
      })

      const hasData = this.state.rooms.length > 0 || this.state.zones.length > 0
      if (!hasData) {
        logger.log('No data in state, loading from API...')
        this.loadGroupsData()
      } else {
        this.renderPage()
        if (this._stale) this.refreshQuietly()
      }
    },

    // What the list shows of each group: a read that changes none of it
    // doesn't draw the page again
    listSignature(rooms, zones) {
      return [...(rooms || []), ...(zones || [])]
        .map((g) => `${g.id}:${g.name}:${!!(g.anyOn || g.on_off)}:${(g.lights || []).length}`)
        .join('|')
    },

    // The list read again behind the one already shown: no "Loading", no
    // error page (what is shown stays). A tap doesn't wait for it: it acts on
    // what was on screen when tapped (waiting, it acted on what the read
    // brought: a room turned off elsewhere, tapped to turn it off, came on).
    // A command sent meanwhile, from any page, drops the read: it may
    // predate the command and would show the group as before it
    refreshQuietly() {
      const t0 = Date.now()
      const sent = commandCount()
      this.request({ method: 'GET_GROUPS' })
        .then(result => {
          if (!result.success || !result.data) throw result
          if (commandCount() !== sent) {
            infoLog(`[groups] refresh dropped: a command left in its ${Date.now() - t0}ms`)
            return
          }
          // The store takes it even when this page is closed (opening a
          // group closes it)
          app.setGroupsData(result.data)
          rememberGroups([...(result.data.rooms || []), ...(result.data.zones || [])].map((g) => [g.id, g]))
          if (this._gone) {
            infoLog(`[groups] refresh in ${Date.now() - t0}ms, after the page closed: store updated`)
            return
          }
          const before = this.listSignature(this.state.rooms, this.state.zones)
          this.state.rooms = result.data.rooms || []
          this.state.zones = result.data.zones || []
          const changed = this.listSignature(this.state.rooms, this.state.zones) !== before
          infoLog(`[groups] refresh in ${Date.now() - t0}ms: ${changed ? 'changed, drawn again' : 'unchanged'}`)
          if (changed) this.renderPage()
        })
        .catch(err => {
          warnLog(`[groups] refresh failed after ${Date.now() - t0}ms: the cached list stays`)
          logger.error('Quiet refresh error:', err)
        })
    },

    // The group as the list has it now (a refresh replaces the objects; the
    // row tapped may hold the one drawn before it)
    currentGroup(groupRaw) {
      return [...this.state.rooms, ...this.state.zones]
        .find((g) => g.id === groupRaw.id && g.type === groupRaw.type) || groupRaw
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
            // The shortcut card shows its groups as last seen
            rememberGroups([...(result.data.rooms || []), ...(result.data.zones || [])].map((g) => [g.id, g]))

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

    // One request at a time per group; a tap during one waits for it and
    // reads the state it left
    toggleGroup(groupRaw) {
      this._gate.run(`group ${groupRaw.id}`, () => busyOn(this, `group:${groupRaw.id}`,
        () => this._toggleGroup(this.currentGroup(groupRaw))))
    },

    _toggleGroup(groupRaw) {
      logger.log('Toggle group:', groupRaw.name)

      // Calcolo ottimistico
      const currentOnState = !!(groupRaw.on_off || groupRaw.anyOn)
      const newState = !currentOnState

      return this.request({
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

            // 3. ✅ Aggiorna la cache del dettaglio!
            app.updateGroupStatusInCache(groupRaw.id, newState)
            rememberGroups([[groupRaw.id, { anyOn: newState }]])
            globalData._timestamp = Date.now()

            if (!this._gone) this.renderPage()
          }
        })
        .catch(err => {
          logger.error('Toggle group error:', err)

          // ✅ Ripristina stato in caso di errore
          groupRaw.on_off = currentOnState
          if (groupRaw.hasOwnProperty('anyOn')) {
            groupRaw.anyOn = currentOnState
          }
          if (!this._gone) this.renderPage()
        })
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
      }
    },

    // --- RENDERING ---

    renderPage() {
      // Animations of the previous drawing (their widgets go with it)
      stopPulses(this)
      if (this._keys) this._keys.reset()
      this.clearAllWidgets()
      // Filled by the layout: the items the keys move between
      const nav = { items: [], view: null }

      const rawList = this.state.currentTab === 'ROOMS' ? this.state.rooms : this.state.zones

      const viewData = rawList.map(item => ({
        name: item.name,
        status: `${item.lights?.length || 0} ${item.lights?.length === 1 ? getText('LIGHT') : getText('LIGHTS')}`,
        on_off: (item.anyOn === true || item.on_off === true) ? getText('ON') : getText('OFF'),
        raw: item
      }))

      renderGroupsPage(this, this.state, viewData, {
        nav,
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
              groupName: item.raw.name,
              groupClass: item.raw.class,
              anyOn: item.raw.anyOn || item.raw.on_off
            })

            push({
              url: 'page/group-detail',
              params: paramsString
            })
          }
        }
      })
      this._nav = nav
      if (this._keys) this._keys.refocus()
    },

    onDestroy() {
      this._gone = true
      if (this._keys) this._keys.stop()
      stopPulses(this)
      if (this._gate) this._gate.close()
      app.setCurrentTab(this.state.currentTab)
      app.setGroupsScrollY(this.state.scrollPos_y)
      this.clearAllWidgets()
    }
  })))
)
