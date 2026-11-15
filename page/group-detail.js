import { BasePage } from '@zeppos/zml/base-page'
import { countCommands, commandCount } from '../utils/commands.js'
import { loggedPage, infoLog, warnLog } from '../utils/remote-log.js'
import { createGate } from '../utils/request-gate.js'
import { bindKeyNav } from '../utils/key-nav.js'
import { busyOn, stopPulses } from '../utils/pulse.js'
import { rememberLight, rememberLights, rememberGroups, isInCard, toggleInCard, groupCardState } from '../utils/shortcuts.js'
import { setPageBrightTime } from '@zos/display'
import { getLogger } from '../utils/logger.js'
import { getText } from '@zos/i18n'
import { createWidget, deleteWidget, showToast } from '@zos/ui'
import { push } from '@zos/router'
import { renderGroupDetailPage } from 'zosLoader:./group-detail.[pf].layout.js'
import { DEFAULT_USER_SETTINGS, COLORS, LIGHT_MODELS, lightDisplayColor } from '../utils/constants.js'

const logger = getLogger('zhue-group-detail-page')
const app = getApp()

Page(
  loggedPage('group-detail', countCommands(BasePage({
    state: {
      groupId: null,
      groupType: null,
      groupName: '',
      anyOnInitial: null,
      lights: [],
      scenes: [],
      isLoading: false,
      error: null,
      scrollPos_y: 0
    },

    widgets: [],
    listWidget: null,

    onInit(p) {
      logger.debug('Group detail page onInit')
      // ZML's BasePage hands every instance of this page the same `state`
      // object (field-notes.md, "Pages and the app"): without this reset a
      // group opened without cache showed the lights of the previous one, and
      // build() didn't load its own
      Object.assign(this.state, {
        groupId: null,
        groupType: null,
        groupName: '',
        anyOnInitial: null,
        groupClass: null,
        isInCard: false,
        lights: [],
        scenes: [],
        isLoading: false,
        error: null,
        scrollPos_y: 0
      })
      this.widgets = []
      this.listWidget = null
      this._gate = createGate('group-detail')
      // The previous instance's keys (see the state reset above)
      this._keys = null
      this._nav = null
      // Parse parametri
      let params = {}
      if (typeof p === 'string' && p.startsWith('{')) {
        try {
          params = JSON.parse(p)
        } catch (e) {
          logger.error('Failed to parse params string:', e)
        }
      } else if (typeof p === 'object' && p !== null) {
        params = p
      }

      if (params) {
        this.state.groupId = params.groupId
        this.state.groupType = params.groupType
        this.state.groupName = params.groupName
        this.state.anyOnInitial = params.anyOn
        this.state.groupClass = params.groupClass || null
        this.state.isInCard = isInCard('group', params.groupId)
        this.state.scrollPos_y = app.getGroupDetailScrollY(this.state.groupId)
      }

      // The group as last known, shown at once; when older than the cache's
      // TTL it is read again behind it (build: refreshQuietly). It used to
      // show "Loading" ~1 s at every return to a group seen before
      this._stale = false
      this._refreshing = false
      this._gone = false
      const cached = app.getCachedGroupDetail(this.state.groupId)
      if (cached) {
        this.processData(cached.data)
        this._stale = !cached.fresh
      }
    },

    build() {
      // Physical buttons: UP / DOWN between the header and the rows, SELECT
      // opens a light or applies a scene (the header: switches the group),
      // held SELECT switches a light, BACK goes back
      this._keys = bindKeyNav({
        getItems: () => (this._nav && this._nav.items) || [],
        label: 'group-detail'
      })
      setPageBrightTime({ brightTime: 60000 })

      // Se non abbiamo dati, carica
      if (this.state.lights.length === 0 && !this.state.isLoading && !this.state.error) {
        this.loadGroupDetail()
      } else if (this.state.lights.length > 0) {
        this.renderPage()
        if (this._stale) this.refreshQuietly()
      }
    },

    // What the page shows of the group: a read that changes none of it
    // doesn't draw the page again
    detailSignature() {
      const l = this.state.lights.map((x) =>
        [x.id, x.name, !!x.ison, x.reachable, x.bri, x.hue, x.sat, x.ct, x.colormode, (x.xy || []).join(',')].join(':'))
      const s = this.state.scenes.map((x) => `${x.id}:${x.name}`)
      return `${l.join('|')}#${s.join('|')}`
    },

    // The group read again behind the page already shown: no "Loading", no
    // error page (what is shown stays). A tap doesn't wait for it: it acts on
    // what was on screen when tapped (waiting, it acted on what the read
    // brought: a light turned off elsewhere, tapped to turn it off, came on).
    // A command sent meanwhile, from any page, drops the read: it may
    // predate the command and would show the lights as before it
    refreshQuietly() {
      const t0 = Date.now()
      const sent = commandCount()
      const groupId = this.state.groupId
      this._refreshing = true
      this.request({
        method: 'GET_GROUP_DETAIL',
        params: { groupId }
      })
        .then(result => {
          if (!result.success || !result.data) throw result
          if (commandCount() !== sent) {
            infoLog(`[group-detail] refresh dropped: a command left in its ${Date.now() - t0}ms`)
            return
          }
          // The caches take it even when this page is closed (opening a
          // light closes it)
          const lights = (result.data.lights || []).filter((l) => l && l.id && typeof l.ison !== 'undefined')
          app.setGroupDetailCache(groupId, result.data)
          // Merged: what the light page's own read brought stays
          const lightData = app.globalData.lightData
          lights.forEach((l) => { lightData[l.id] = { ...(lightData[l.id] || {}), ...l, _timestamp: Date.now() } })
          app.setGroupOnInList(groupId, lights.some((l) => !!l.ison))
          if (this._gone) {
            infoLog(`[group-detail] refresh in ${Date.now() - t0}ms, after the page closed: cache updated`)
            return
          }
          const before = this.detailSignature()
          this.processData(result.data)
          const changed = this.detailSignature() !== before
          infoLog(`[group-detail] refresh in ${Date.now() - t0}ms: ${changed ? 'changed, drawn again' : 'unchanged'}`)
          if (changed) this.renderPage()
        })
        .catch(err => {
          warnLog(`[group-detail] refresh failed after ${Date.now() - t0}ms: the cached group stays`)
          logger.error('Quiet refresh error:', err)
        })
        .then(() => { this._refreshing = false })
    },

    processDataAndRender(data) {
      this.processData(data)
      this.renderPage()
    },

    processData(data) {
      const rawLights = data.lights || []

      // ✅ Gestione Settings (CORRETTO)
      if (data.userSettings) {
        app.globalData.settings = { ...app.globalData.settings, ...data.userSettings }
        logger.log('User settings updated in global store')
      }

      // Filtro luci valide
      this.state.lights = rawLights.filter(l =>
        l && l.id && typeof l.ison !== 'undefined'
      )
      this.state.scenes = data.scenes || []
      // The shortcut card shows these lights as last seen
      rememberLights(this.state.lights.map((l) => [l.id, l]))
      rememberGroups([[this.state.groupId, { anyOn: this.state.lights.some((l) => !!l.ison) }]])

      logger.log(`Processed ${this.state.lights.length} lights, ${this.state.scenes.length} scenes`)

      this.state.isLoading = false
    },

    loadGroupDetail(isSilent = false) {
      if (!isSilent) {
        this.state.isLoading = true
        this.state.error = null
        this.renderPage()
      }

      logger.log('Loading group detail for:', this.state.groupId)

      this.request({
          method: 'GET_GROUP_DETAIL',
          params: { groupId: this.state.groupId }
        })
        .then(result => {
          if (result.success && result.data) {
            // ✅ Salva in cache globale
            app.setGroupDetailCache(this.state.groupId, result.data)
            logger.log('Detail data cached globally')

            this.processDataAndRender(result.data)
          } else {
            if (!isSilent) {
              this.state.isLoading = false
              this.state.error = result.message || 'Failed to load detail'
              this.renderPage()
            }
          }
        })
        .catch(err => {
          logger.error('Load group detail error:', err)
          if (!isSilent) {
            this.state.isLoading = false
            this.state.error = err.message || getText('NETWORK_ERROR')
            this.renderPage()
          }
        })
    },

    createTrackedWidget(type, props) {
      const w = createWidget(type, props)
      if (!this.widgets) this.widgets = []
      this.widgets.push(w)
      return w
    },

    clearAllWidgets() {
      if (this.widgets) {
        this.widgets.forEach(w => {
          try { deleteWidget(w) } catch (e) {
            logger.error('clearAllWidgets:', e)
          }
        })
      }
      this.widgets = []
      this.listWidget = null
    },

    onScrollChange(y) {
      if (this.state.scrollPos_y !== y) {
        this.state.scrollPos_y = y
      }
    },

    // One request at a time per control; a tap during one waits for it and
    // reads the state it left
    toggleGroup() {
      this._gate.run('group', () => busyOn(this, 'group', () => this._toggleGroup()))
    },

    _toggleGroup() {
      const anyOn = this.state.lights.some(light => !!light.ison)
      const newState = !anyOn

      return app.trackLight(this.state.lights.map((l) => l.id), newState, this.request({
          method: 'TOGGLE_GROUP',
          params: {
            groupId: this.state.groupId,
            groupType: this.state.groupType,
            state: newState
          }
        })
        .then(result => {
          if (result.success) {
            // ✅ Aggiorna stato locale
            this.state.lights.forEach(light => {
              light.ison = newState
              app.setLightData(light.id, { ...light, ison: newState })
              app.updateLightStatusInGroupsCache(light.id, { ison: newState })
            })
            // The shortcut card shows them as last seen
            rememberLights(this.state.lights.map((l) => [l.id, l]))
            rememberGroups([[this.state.groupId, { anyOn: newState }]])

            const cachedGroup = app.getGroupDetailCache(this.state.groupId)
            if (cachedGroup) {
              cachedGroup.anyOn = newState
              cachedGroup._timestamp = Date.now()
            }

            // The list shows it at once; flagged, it is read again behind
            app.setGroupOnInList(this.state.groupId, newState)
            app.invalidateGroupsCache()

            // An answer after the page closed (a light opened meanwhile)
            // draws nothing: the page is gone
            if (!this._gone) this.renderPage()
          }
        })
        .catch(err => {
          logger.error('Toggle group error:', err)

          // ✅ Ripristina stato in caso di errore
          this.state.lights.forEach(light => {
            light.ison = !newState
          })
          if (!this._gone) this.renderPage()
        }))
    },

    toggleLight(light) {
      // The light as the page has it now (a refresh replaces the objects;
      // the row tapped may hold the one drawn before it)
      this._gate.run(`light ${light.id}`, () => busyOn(this, `light:${light.id}`, () =>
        this._toggleLight(this.state.lights.find((l) => l.id === light.id) || light)))
    },

    _toggleLight(light) {
      const currentOnState = light.ison
      const newState = !currentOnState

      return app.trackLight([light.id], newState, this.request({
          method: 'TOGGLE_LIGHT',
          params: {
            lightId: light.id,
            state: newState
          }
        })
        .then(result => {
          if (result.success) {
            // ✅ Usa dati aggiornati dal backend se disponibili
            if (result.updatedState) {
              logger.debug('Applying updated state from backend:', result.updatedState)

              // Aggiorna oggetto luce locale
              Object.assign(light, result.updatedState)

              // Aggiorna cache globale
              app.setLightData(light.id, { ...light, ...result.updatedState })

              // Sincronizza con tutti i gruppi
              app.updateLightStatusInGroupsCache(light.id, result.updatedState)
            } else {
              // Fallback: aggiornamento ottimistico base
              logger.warn('No updatedState from backend, using optimistic update')
              app.setLightData(light.id, { ...light, ison: newState })
              app.updateLightStatusInGroupsCache(light.id, { ison: newState })
            }
            rememberLight(light.id, result.updatedState ? light : { ...light, ison: newState })

            // ✅ Refresh timestamp cache gruppo
            const cachedGroup = app.getGroupDetailCache(this.state.groupId)
            if (cachedGroup) {
              cachedGroup._timestamp = Date.now()
            }

            if (!this._gone) this.renderPage()
          }
        })
        .catch(err => {
          // Ripristina stato in caso di errore
          light.ison = currentOnState
          if (!this._gone) this.renderPage()
          logger.error('Toggle light error:', err)
        }))
    },


    // A value: only the latest scene tapped waits
    applyScene(scene) {
      this._gate.run('scene', () => busyOn(this, `scene:${scene.id}`, () => this._applyScene(scene)), true)
    },

    _applyScene(scene) {
      return this.request({
          method: 'APPLY_SCENE',
          params: {
            sceneId: scene.id,
            groupId: this.state.groupId
          }
        })
        .then(result => {
          if (result.success) {
            // ✅ Invalida cache e ricarica
            app.invalidateGroupDetailCache(this.state.groupId)
            app.invalidateGroupsCache()
            // Read again behind the page: "Loading" after every scene was
            // the same wait as at the return to the group
            setTimeout(() => { if (!this._gone) this.refreshQuietly() }, 300)
          }
        })
        .catch(err => logger.error('Apply scene error:', err))
    },

    // The group in the shortcut card, or out of it (the row at the end of the
    // list); added with its state, so the card shows it at once
    toggleCardEntry() {
      const anyOn = this.state.lights.some((l) => !!l.ison)
      const result = toggleInCard({
        kind: 'group',
        groupId: this.state.groupId,
        name: this.state.groupName,
        groupClass: this.state.groupClass,
        ...groupCardState({ anyOn })
      })
      if (result === 'full') {
        showToast({ text: getText('WIDGET_SLOTS_FULL') })
        return
      }
      this.state.isInCard = result === 'added'
      showToast({ text: getText(result === 'added' ? 'ADDED_TO_WIDGET' : 'REMOVED_FROM_WIDGET') })
      this.renderPage()
    },

    navigateToLightDetail(light) {
      app.setGroupDetailScrollY(this.state.groupId, this.state.scrollPos_y)
      app.setLightData(light.id, light)
      // Opened during the refresh: its light may be as old as the cache,
      // the light page reads it again behind (its own quiet refresh)
      if (this._refreshing) app.globalData.lightData[light.id]._timestamp = 0

      const paramsString = JSON.stringify({
        lightId: light.id,
        lightName: light.name
      })

      push({
        url: 'page/light-detail',
        params: paramsString
      })
    },

    getLightSwatchColor(light) {
      if (!light.ison || light.reachable === false) {
        return COLORS.inactive
      }

      // Its hue at full brightness (a white light at 20% came near black)
      return lightDisplayColor(light)
    },

    renderPage() {
      // Animations of the previous drawing (their widgets go with it)
      stopPulses(this)
      if (this._keys) this._keys.reset()
      this.clearAllWidgets()
      // Filled by the layout: the items the keys move between
      const nav = { items: [], view: null }
      const data = []

      const settings = app.globalData.settings || DEFAULT_USER_SETTINGS

      const addScenes = () => {
        if (settings.show_scenes && this.state.scenes.length > 0) {
          logger.log(`Adding ${this.state.scenes.length} scenes to list`)

          data.push({ type: 'header', name: getText('SCENES') })

          this.state.scenes.forEach(scene => {
            data.push({
              ...scene,
              type: 'scene'
            })
          })
        }
      }

      const addLights = () => {
        if (this.state.lights.length > 0) {
          data.push({ type: 'header', name: getText('LIGHTS') })

          this.state.lights.forEach(light => {
            const isOn = !!light.ison
            const reachable = light.reachable !== false
            const modelInfo = LIGHT_MODELS[light.modelid] || LIGHT_MODELS.default

            const finalIconPath = `icons/${modelInfo.icon}.png`

            const statusText = reachable ? (isOn ?
              `${getText('BRIGHTNESS')} ${Math.round(light.bri / 254 * 100)}%` :
              getText('OFF')
            ) : getText('UNREACHABLE')

            data.push({
              raw: light,
              type: 'light',
              name: light.name,
              icon: finalIconPath,
              status_text: statusText,
              swatch_bg_color: this.getLightSwatchColor(light)
            })
          })
        }
      }

      const displayOrder = settings.display_order || 'LIGHTS_FIRST'
      logger.log(`Display order: ${displayOrder}`)

      if (displayOrder === 'SCENES_FIRST') {
        addScenes()
        addLights()
      } else {
        addLights()
        addScenes()
      }

      logger.log(`Data prepared: ${data.length} total items`)
      const viewData = { data }

      renderGroupDetailPage(this, this.state, viewData, {
        nav,
        toggleGroup: () => this.toggleGroup(),
        retry: () => this.loadGroupDetail(),
        applyScene: (item) => this.applyScene(item),
        toggleLight: (light) => this.toggleLight(light),
        navigateToLightDetail: (light) => this.navigateToLightDetail(light),
        onScrollChange: (y) => this.onScrollChange(y),
        toggleCardFunc: () => this.toggleCardEntry(),
        isInCard: this.state.isInCard
      }, COLORS)
      this._nav = nav
      if (this._keys) this._keys.refocus()
    },

    onDestroy() {
      this._gone = true
      if (this._keys) this._keys.stop()
      stopPulses(this)
      if (this._gate) this._gate.close()
      this.clearAllWidgets()
      app.setGroupDetailScrollY(this.state.groupId, this.state.scrollPos_y)
    }
  })))
)
