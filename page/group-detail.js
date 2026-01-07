import { BasePage } from '@zeppos/zml/base-page'
import { setPageBrightTime } from '@zos/display'
import { getLogger } from '../utils/logger.js'
import { getText } from '@zos/i18n'
import { createWidget, deleteWidget } from '@zos/ui'
import { push } from '@zos/router'
import { renderGroupDetailPage } from 'zosLoader:./group-detail.[pf].layout.js'
import { DEFAULT_USER_SETTINGS, COLORS, LIGHT_MODELS, ct2hex, xy2hex } from '../utils/constants.js'

const logger = getLogger('zhue-group-detail-page')
const app = getApp()

Page(
  BasePage({
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
        this.state.scrollPos_y = app.getGroupDetailScrollY(this.state.groupId)
      }

      // 1. Controlla se dobbiamo ricaricare
      /*const needsRefresh = app.globalData.needsGroupDetailRefresh

      if (needsRefresh) {
        logger.debug('Refresh flag set, will reload from API')
        app.globalData.needsGroupDetailRefresh = false
        // Non carichiamo qui, lo farà build()
        return
      }*/

      // ✅ Prova a usare la cache
      const cachedData = app.getGroupDetailCache(this.state.groupId)

      if (cachedData) {
        logger.log('Using cached detail data')
        this.processDataAndRender(cachedData)
      } else {
        logger.log('No cache, will load from API')
        // build() caricherà i dati
      }
    },

    build() {
      setPageBrightTime({ brightTime: 60000 })

      // Se non abbiamo dati, carica
      if (this.state.lights.length === 0 && !this.state.isLoading && !this.state.error) {
        this.loadGroupDetail()
      } else if (this.state.lights.length > 0) {
        this.renderPage()
      }
    },

    processDataAndRender(data) {
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

      logger.log(`Processed ${this.state.lights.length} lights, ${this.state.scenes.length} scenes`)

      this.state.isLoading = false
      this.renderPage()
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

    toggleGroup() {
      const anyOn = this.state.lights.some(light => !!light.ison)
      const newState = !anyOn

      this.request({
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

            const cachedGroup = app.getGroupDetailCache(this.state.groupId)
            if (cachedGroup) {
              cachedGroup.anyOn = newState
              cachedGroup._timestamp = Date.now()
            }

            // ✅ Flag refresh lista gruppi
            app.invalidateGroupsCache()

            this.renderPage()
          }
        })
        .catch(err => {
          logger.error('Toggle group error:', err)
          
          // ✅ Ripristina stato in caso di errore
          this.state.lights.forEach(light => {
            light.ison = !newState
          })
          this.renderPage()
        })
    },

    toggleLight(light) {
      const currentOnState = light.ison
      const newState = !currentOnState

      this.request({
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

            // ✅ Refresh timestamp cache gruppo
            const cachedGroup = app.getGroupDetailCache(this.state.groupId)
            if (cachedGroup) {
              cachedGroup._timestamp = Date.now()
            }

            this.renderPage()
          }
        })
        .catch(err => {
          // Ripristina stato in caso di errore
          light.ison = currentOnState
          this.renderPage()
          logger.error('Toggle light error:', err)
        })
    },


    applyScene(scene) {
      this.request({
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
            setTimeout(() => this.loadGroupDetail(), 300)
          }
        })
        .catch(err => logger.error('Apply scene error:', err))
    },

    navigateToLightDetail(light) {
      app.setGroupDetailScrollY(this.state.groupId, this.state.scrollPos_y)
      app.setLightData(light.id, light)

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

      let btnColor
      if (light.colormode === 'hs' && light.hex) {
        btnColor = parseInt(light.hex.replace('#', '0x'), 16)
      } else if (light.colormode === 'ct' && light.ct) {
        btnColor = ct2hex(light.ct)
      } else if (light.colormode === 'xy' && light.xy) {
        btnColor = xy2hex(light.xy, light.bri || 254)
      } else if (light.hex) {
        btnColor = parseInt(light.hex.replace('#', '0x'), 16)
      } else {
        btnColor = COLORS.white
      }
      return btnColor
    },

    renderPage() {
      this.clearAllWidgets()
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
        toggleGroup: () => this.toggleGroup(),
        retry: () => this.loadGroupDetail(),
        applyScene: (item) => this.applyScene(item),
        toggleLight: (light) => this.toggleLight(light),
        navigateToLightDetail: (light) => this.navigateToLightDetail(light),
        onScrollChange: (y) => this.onScrollChange(y)
      }, COLORS)
    },

    onDestroy() {
      this.clearAllWidgets()
      app.setGroupDetailScrollY(this.state.groupId, this.state.scrollPos_y)
    }
  })
)