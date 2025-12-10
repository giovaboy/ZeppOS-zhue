import { BasePage } from '@zeppos/zml/base-page'
import { setPageBrightTime } from '@zos/display'
import { getLogger } from '../utils/logger.js'
import { getText } from '@zos/i18n'
import { createWidget, deleteWidget } from '@zos/ui'
import { push } from '@zos/router'
import { LIGHT_MODELS } from '../utils/constants.js'
import { renderGroupDetailPage } from 'zosLoader:./group-detail.[pf].layout.js'
import { COLORS } from '../utils/constants.js'

const logger = getLogger('zhue-group-detail-page')

// Default settings fallback
const DEFAULT_USER_SETTINGS = {
  show_global_toggle: true,
  show_scenes: true,
  display_order: 'LIGHTS_FIRST'
}

Page(
  BasePage({
    state: {
      userSettings: DEFAULT_USER_SETTINGS,
      groupId: null,
      groupType: null,
      groupName: '',
      lights: [],
      scenes: [],
      isLoading: false,
      error: null
    },

    widgets: [],
    listWidget: null,

    onInit(p) {
      logger.debug('Group detail page onInit')

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

      logger.log(`Initialized with Group ID: ${this.state.groupId}`)
    },

    build() {
      setPageBrightTime({ brightTime: 60000 })

      if (this.state.groupId) {
        this.loadGroupDetail()
      } else {
        this.state.error = "ID Gruppo Mancante. Torna Indietro."
        this.renderPage()
      }
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

    loadGroupDetail() {
      this.state.isLoading = true
      this.state.error = null
      this.renderPage()

      logger.log('Requesting GET_GROUP_DETAIL for Group ID:', this.state.groupId)

      this.request({
        method: 'GET_GROUP_DETAIL',
        params: { groupId: this.state.groupId }
      })
        .then(result => {
          logger.log('Response received:', result)
          this.state.isLoading = false

          if (result.success && result.data) {
            const rawLights = result.data.lights || []

            if (result.data.userSettings) {
              this.state.userSettings = result.data.userSettings
              logger.log('User settings loaded:', this.state.userSettings)
            } else {
              logger.warn('No user settings in response, using defaults')
              this.state.userSettings = DEFAULT_USER_SETTINGS
            }

            logger.log('Raw lights received:', rawLights.length)

            // Filtra luci valide
            this.state.lights = rawLights.filter(light =>
              light &&
              light.id &&
              typeof light.ison !== 'undefined'
            )

            logger.log('Filtered lights:', this.state.lights.length)

            this.state.scenes = result.data.scenes || []
            this.renderPage()
          } else {
            logger.error('Response failed:', result.message || 'No error message')
            this.state.isLoading = false
            this.state.error = 'Failed to load detail'
            this.renderPage()
          }
        })
        .catch(err => {
          const errorMessage = (err && err.message) ? err.message : getText('NETWORK_ERROR')
          logger.error('Load group detail error:', errorMessage, err)

          this.state.isLoading = false
          this.state.error = errorMessage
          this.renderPage()
        })
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
            this.state.lights.forEach(light => {
              light.ison = newState
            })
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
            light.ison = newState
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

      // Helper function per aggiungere le scene
      const addScenes = () => {
        if (this.state.userSettings.show_scenes && this.state.scenes.length > 0) {
          logger.log(`Adding ${this.state.scenes.length} scenes to list`)

          // Header scene
          data.push({ type: 'header', name: getText('SCENES') })

          // Scene items
          this.state.scenes.forEach(scene => {
            data.push({
              ...scene,
              type: 'scene'
            })
          })
        }
      }

      // Helper function per aggiungere le luci
      const addLights = () => {
        if (this.state.lights.length > 0) {
          // Header luci
          data.push({ type: 'header', name: getText('LIGHTS') })

          // Light items
          this.state.lights.forEach(light => {
            logger.debug('Processing light for list:', light)
            const isOn = !!light.ison
            const modelInfo = LIGHT_MODELS[light.modelid] || LIGHT_MODELS.default

            let stateSuffix = '_off'
            if (isOn) {
              const isColorModeActive = light.colormode === 'hs' || light.colormode === 'xy'
              stateSuffix = isColorModeActive ? '_color' : '_on'
            }
            const finalIconPath = `icons/${modelInfo.icon}${stateSuffix}.png`

            logger.debug(`Prepared light item: ${modelInfo} (Name: ${light.name}, On: ${isOn}, Icon: ${finalIconPath})`)

            const statusText = isOn
              ? `${getText('BRIGHTNESS')} ${Math.round(light.bri / 254 * 100)}%`
              : getText('OFF')

            data.push({
              raw: light,      // Oggetto light originale per callbacks
              type: 'light',
              name: light.name,
              icon: finalIconPath,
              status_text: statusText,
              swatch_bg_color: this.getLightSwatchColor(light)
            })
          })
        }
      }

      // DISPLAY_ORDER
      const displayOrder = this.state.userSettings.display_order || 'LIGHTS_FIRST'
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
        retry: () => this.build(),
        applyScene: (item) => this.applyScene(item),
        toggleLight: (light) => this.toggleLight(light),
        navigateToLightDetail: (light) => this.navigateToLightDetail(light)
      }, COLORS)
    },

    onDestroy() {
      this.clearAllWidgets()
    }
  })
)