import { BasePage } from '@zeppos/zml/base-page'
import { setPageBrightTime } from '@zos/display'
import { getLogger } from '../utils/logger.js'
import { getText } from '@zos/i18n'
import { createWidget, deleteWidget } from '@zos/ui'
import { push } from '@zos/router'
import { getScrollTop, scrollTo } from '@zos/page'
import { renderGroupDetailPage } from 'zosLoader:./group-detail.[pf].layout.js'
import { DEFAULT_USER_SETTINGS, COLORS, LIGHT_MODELS, ct2hex } from '../utils/constants.js'

const logger = getLogger('zhue-group-detail-page')

Page(
  BasePage({
    state: {
      groupId: null,
      groupType: null,
      groupName: '',
      lights: [],
      scenes: [],
      isLoading: false,
      error: null,
      scrollTop: null
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
      }
      
      // ✅ Prova a usare la cache
      const app = getApp()
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
        // Abbiamo già i dati (da cache)
        this.renderPage()
      }
    },
    
    processDataAndRender(data) {
      const rawLights = data.lights || []
      
      // ✅ Gestione Settings (CORRETTO)
      const app = getApp()
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
            const app = getApp()
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
            })
            
            // ✅ Invalida cache detail
            const app = getApp()
            app.setGroupDetailCache(this.state.groupId, null)
            
            // ✅ Flag per ricaricare groups
            app.globalData.needsGroupsRefresh = true
            
            this.state.scrollTop = getScrollTop()
            
            this.renderPage()
          }
        })
        .catch(err => logger.error('Toggle group error:', err))
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
            // ✅ Aggiorna stato locale
            light.ison = newState
            
            // ✅ Invalida cache detail
            const app = getApp()
            app.setGroupDetailCache(this.state.groupId, null)
            
            // ✅ Flag per ricaricare groups
            app.globalData.needsGroupsRefresh = true
            this.state.scrollTop = getScrollTop()
            this.renderPage()
          }
        })
        .catch(err => logger.error('Toggle light error:', err))
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
            const app = getApp()
            app.setGroupDetailCache(this.state.groupId, null)
            app.globalData.needsGroupsRefresh = true
            this.state.scrollTop = getScrollTop()
            setTimeout(() => this.loadGroupDetail(), 200)
          }
        })
        .catch(err => logger.error('Apply scene error:', err))
    },
    
    navigateToLightDetail(light) {
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
      if (!light.ison) {
        return COLORS.inactive
      }
      
      let btnColor
      if (light.colormode === 'hs' && light.hex) {
        btnColor = parseInt(light.hex.replace('#', '0x'), 16)
      } else if (light.colormode === 'ct' && light.ct) {
        btnColor = ct2hex(light.ct)
      } else {
        btnColor = COLORS.white
      }
      return btnColor
      
      
      const isColorModeActive = light.colormode === 'hs' || light.colormode === 'xy'
      
      if (isColorModeActive && light.hex) {
        try {
          if (typeof light.hex === 'string') {
            const hexStr = light.hex.startsWith('#') ? light.hex.substring(1) : light.hex
            return parseInt(hexStr, 16)
          }
          return light.hex
        } catch (e) {
          return COLORS.defaultSwatchColor
        }
      }
      return COLORS.defaultSwatchColor
    },
    
    renderPage() {
      this.clearAllWidgets()
      const data = []
      
      // ✅ Usa settings dal global store (CORRETTO)
      const app = getApp()
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
            const modelInfo = LIGHT_MODELS[light.modelid] || LIGHT_MODELS.default
            
            const finalIconPath = `icons/${modelInfo.icon}.png`
            
            const statusText = isOn ?
              `${getText('BRIGHTNESS')} ${Math.round(light.bri / 254 * 100)}%` :
              getText('OFF')
            
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
        navigateToLightDetail: (light) => this.navigateToLightDetail(light)
      }, COLORS)
      
      if (this.state.scrollTop) {
        scrollTo({
          y: this.state.scrollTop,
        })
      }
    },
    
    onDestroy() {
      this.clearAllWidgets()
    }
  })
)