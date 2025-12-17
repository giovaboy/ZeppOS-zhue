import { BasePage } from '@zeppos/zml/base-page'
import { setPageBrightTime } from '@zos/display'
import { setScrollLock } from '@zos/page'
import { getText } from '@zos/i18n'
import { createWidget, deleteWidget, widget, prop, align, showToast } from '@zos/ui'
import { back, push } from '@zos/router'
import { onGesture, GESTURE_RIGHT, createModal, MODAL_CONFIRM } from '@zos/interaction'
import { px } from '@zos/utils'
import { renderLightDetail, LAYOUT_CONFIG } from 'zosLoader:./light-detail.[pf].layout.js'
import { getLogger } from '../utils/logger.js'
import { DEFAULT_PRESETS, PRESET_TYPES, hsb2hex, ct2hex, ct2hexString, xy2hex, xy2hexString, normalizeHex, DEFAULT_USER_SETTINGS } from '../utils/constants.js'

const logger = getLogger('zhue-light-detail-page')

function getPresetTypePriority(type) {
  switch (type) {
    case PRESET_TYPES.WHITE:
      return 1
    case PRESET_TYPES.CT:
      return 2
    case PRESET_TYPES.COLOR:
      return 3
    default:
      return 99
  }
}

function comparePresets(a, b) {
  const priorityA = getPresetTypePriority(a.type)
  const priorityB = getPresetTypePriority(b.type)
  if (priorityA !== priorityB) return priorityA - priorityB
  if (a.type === PRESET_TYPES.WHITE) return a.bri - b.bri
  if (a.type === PRESET_TYPES.CT) return a.ct - b.ct
  if (a.type === PRESET_TYPES.COLOR) return a.hue - b.hue
  return 0
}

Page(
  BasePage({
    state: {
      lightId: null,
      lightName: '',
      light: null,
      isLoading: false,
      // 👇 RIMOSSO: Non serve più questo stato locale
      // favoriteColors: null,
      isDraggingBrightness: false,
      tempBrightness: 0,
      brightnessSliderFillWidget: null,
      brightnessLabel: null,
      error: null
    },
    
    widgets: [],
    currentModal: null,
    exitGestureListener: null,
    
    onInit(p) {
      let params = {}
      try {
        params = typeof p === 'string' ? JSON.parse(p) : p
      } catch (e) {
        logger.error('Error parsing params', e)
      }
      
      this.state.lightId = params?.lightId
      this.state.lightName = params?.lightName || getText('LIGHT')
      
      // Prova a usare i dati dal global store
      const app = getApp()
      const cachedLightData = app.getCurrentLightData()
      
      if (cachedLightData && cachedLightData.id === this.state.lightId) {
        logger.log('Using cached light data from global store')
        this.state.light = cachedLightData
        app.clearCurrentLightData()
      } else {
        logger.log('No cached light data available, will load from API')
        this.state.isLoading = true
      }
    },
    
    build() {
      logger.log('Building Light Detail page')
      logger.debug('Initial state - light:', !!this.state.light, 'isLoading:', this.state.isLoading)
      
      setPageBrightTime({ brightTime: 60000 })
      setScrollLock({ lock: false })
      this.unlockExitGesture()
      
      if (this.state.isLoading) {
        logger.log('Rendering loading state, then loading data...')
        this.renderPage()
        setTimeout(() => this.loadLightDetail(), 10)
        
      } else if (this.state.light) {
        logger.log('Have cached data, rendering page...')
        this.renderPage()
        
      } else {
        logger.warn('Unexpected state: no loading flag and no data')
        this.state.isLoading = true
        this.renderPage()
        setTimeout(() => this.loadLightDetail(), 10)
      }
    },
    
    onResume() {
      logger.log('Resuming Light Detail')
      if (this.state.lightId) {
        this.loadLightDetail()
      }
    },
    
    clearAllWidgets() {
      this.widgets.forEach(w => {
        try { deleteWidget(w) } catch (e) {
          logger.error('Del widget err', e)
        }
      })
      this.widgets = []
      this.state.brightnessSliderFillWidget = null
      this.state.brightnessLabel = null
    },
    
    createTrackedWidget(type, props) {
      const w = createWidget(type, props)
      this.widgets.push(w)
      return w
    },
    
    unlockExitGesture() {
      if (this.exitGestureListener) {
        this.exitGestureListener()
      }
      this.exitGestureListener = onGesture({
        callback: (event) => {
          if (event === GESTURE_RIGHT) {
            back()
            return true
          }
          return false
        }
      })
    },
    
    lockExitGesture() {
      if (this.exitGestureListener) {
        this.exitGestureListener()
      }
      this.exitGestureListener = onGesture({
        callback: (event) => true
      })
    },
    
    // 👇 NUOVO: Helper per ottenere favorite colors
    getFavoriteColors() {
      const app = getApp()
      const settings = app.getSettings() || DEFAULT_USER_SETTINGS
      return settings.favorite_colors || DEFAULT_PRESETS
    },
    
    renderPage() {
      this.clearAllWidgets()
      
      // 👇 MODIFICATO: Ottieni favorite colors dal global store
      const favoriteColors = this.getFavoriteColors()
      
      // Ordina i preset
      const sortedPresets = [...favoriteColors].sort(comparePresets)
      
      logger.debug('Rendering page - isLoading:', this.state.isLoading, 'error:', this.state.error, 'hasLight:', !!this.state.light)
      logger.debug('Favorite colors count:', favoriteColors.length)
      
      // Pre-calcola hex se necessario
      if (this.state.light && !this.state.light.hex && !this.state.isLoading) {
        logger.debug('Pre-calculating light hex color...')
        const light = this.state.light
        let rgb = null
        
        switch (light.colormode) {
          case 'hs': {
            const bri = light.bri ?? 100
            const hue = light.hue ?? 0
            const sat = light.sat ?? 0
            
            const nBri = Math.round((bri / 254) * 100)
            const nHue = Math.round((hue / 65535) * 360)
            const nSat = Math.round((sat / 254) * 100)
            
            rgb = hsb2hex(nHue, nSat, nBri)
            break
          }
          
          case 'xy': {
            if (Array.isArray(light.xy)) {
              rgb = xy2hex(light.xy, light.bri)
            }
            break
          }
          
          case 'ct': {
            if (Number.isInteger(light.ct)) {
              rgb = ct2hex(light.ct)
            }
            break
          }
        }
        
        if (Number.isInteger(rgb)) {
          this.state.light = {
            ...light,
            hex: normalizeHex('#' + rgb.toString(16).padStart(6, '0').toUpperCase())
          }
          logger.debug('Calculated light hex color:', this.state.light.hex)
        }
      }
      
      // 👇 MODIFICATO: Passa sortedPresets invece di this.state.favoriteColors
      renderLightDetail(this, { ...this.state, favoriteColors: sortedPresets }, {
        toggleLightFunc: () => this.toggleLight(),
        setBrightnessDrag: (evtType, info) => this.handleBrightnessDrag(evtType, info),
        openColorPickerFunc: () => this.openColorPicker(),
        applyPresetFunc: (fav) => this.applyPreset(fav),
        addFavoriteFunc: () => this.addCurrentColorToFavorites(),
        deleteFavoriteFunc: (fav) => this.deletePreset(fav),
        retryFunc: () => this.loadLightDetail(),
        getLightBgColor: (hex) => this.getLightBgColor(hex),
        capabilities: this.getLightCapabilities(this.state.light)
      })
    },
    
    openColorPicker() {
      const light = this.state.light
      const caps = this.getLightCapabilities(light)
      
      let initialMode = 'color'
      if (((light.colormode === 'ct') && light.ct > 0) || !caps.includes('color')) {
        initialMode = 'ct'
      }
      
      push({
        url: 'page/color-picker',
        params: JSON.stringify({
          lightId: this.state.lightId,
          hue: light.hue,
          sat: light.sat,
          bri: light.bri,
          ct: light.ct,
          caps: caps,
          initialMode: initialMode
        })
      })
    },
    
    handleBrightnessDrag(evtType, info) {
      const { sliderX, sliderW } = LAYOUT_CONFIG
      
      const getBrightnessFromX = (x) => {
        let positionInTrack = x - sliderX
        positionInTrack = Math.max(0, Math.min(positionInTrack, sliderW))
        return Math.max(this.state.light.ison ? 1 : 0, Math.round((positionInTrack / sliderW) * 254))
      }
      
      if (evtType === 'DOWN') {
        this.lockExitGesture()
        setScrollLock({ lock: true })
        
        const newBri = getBrightnessFromX(info.x)
        this.state.isDraggingBrightness = true
        if (newBri === this.state.tempBrightness) return
        
        this.state.tempBrightness = newBri
        this.setBrightness(newBri, false)
        
      } else if (evtType === 'MOVE') {
        if (!this.state.isDraggingBrightness) return
        
        const newBri = getBrightnessFromX(info.x)
        if (newBri === this.state.tempBrightness) return
        
        this.state.tempBrightness = newBri
        this.setBrightness(newBri, false)
        
      } else if (evtType === 'UP') {
        if (!this.state.isDraggingBrightness) return
        
        this.unlockExitGesture()
        setScrollLock({ lock: false })
        
        if (this.state.tempBrightness !== this.state.light.bri) {
          this.setBrightness(this.state.tempBrightness, false)
        }
        
        this.state.isDraggingBrightness = false
      }
    },
    
    setBrightness(brightness, skipApiCall = false) {
      this.state.light.bri = brightness
      const { sliderW } = LAYOUT_CONFIG
      const fillWidth = Math.max(px(5), Math.round(sliderW * brightness / 254))
      const percent = Math.round(brightness / 254 * 100)
      
      if (this.state.brightnessSliderFillWidget) {
        try {
          this.state.brightnessSliderFillWidget.setProperty(prop.W, fillWidth)
        } catch (e) {
          logger.error('SetBri Fill Widget Error', e)
        }
      }
      
      if (this.state.brightnessLabel) {
        try {
          this.state.brightnessLabel.setProperty(prop.TEXT, `${percent}%`)
        } catch (e) {
          logger.error('SetBri Label Widget Error', e)
        }
      }
      
      if (skipApiCall) return
      
      this.request({
        method: 'SET_BRIGHTNESS',
        params: { lightId: this.state.lightId, brightness }
      }).catch(e => logger.error(e))
    },
    
    getLightCapabilities(light) {
      if (!light) return []
      const type = light.type || ''
      let caps = ['brightness']
      
      if (type.toLowerCase().includes('color') || light.state?.hasOwnProperty('hue'))
        caps.push('color')
      if (type.toLowerCase().includes('color') || type.toLowerCase().includes('ambiance') || light.state?.hasOwnProperty('ct'))
        caps.push('ct')
      
      if (light.capabilities) return light.capabilities
      
      return caps
    },
    
    getLightBgColor(hex) {
      const cleanHex = hex.replace('#', '')
      if (cleanHex === '000000') return 0x000000
      const color = parseInt(cleanHex, 16)
      return ((color >> 3) & 0x1f1f1f) + 0x0a0a0a
    },
    
    loadLightDetail() {
      logger.log('Loading light detail...')
      logger.debug('Light ID:', this.state.lightId)
      
      if (this.state.isLoading) {
        logger.debug('Already loading, skipping duplicate request')
        return
      }
      
      this.state.isLoading = true
      this.state.error = null
      
      if (this.widgets.length === 0) {
        this.renderPage()
      }
      
      this.request({
          method: 'GET_LIGHT_DETAIL',
          params: { lightId: this.state.lightId }
        })
        .then(result => {
          if (result.success) {
            this.state.light = result.data.light
            this.state.tempBrightness = this.state.light.bri || 0
            this.state.isLoading = false
            this.state.error = null
            
            logger.log('Light detail loaded successfully')
            
            // 👇 RIMOSSO: Non serve più caricare favorite colors
            // Renderizza direttamente
            this.renderPage()
          } else {
            this.state.isLoading = false
            this.state.error = result.message || getText('FAILED_TO_LOAD_DETAIL')
            this.renderPage()
          }
        })
        .catch(err => {
          logger.error('Load light detail error:', err)
          this.state.isLoading = false
          this.state.error = err.message || getText('NETWORK_ERROR')
          this.renderPage()
        })
    },
    
    // 👇 RIMOSSO: Metodo loadFavoriteColors() non più necessario
    /*
    loadFavoriteColors() {
      // Non serve più, usiamo globalData.settings.favorite_colors
    }
    */
    
    toggleLight() {
      const newState = !this.state.light.ison
      
      this.request({
          method: 'TOGGLE_LIGHT',
          params: { lightId: this.state.lightId, state: newState }
        })
        .then(result => {
          if (result.success) {
            this.state.light.ison = newState
            this.renderPage()
          }
        })
        .catch(err => {
          logger.error('Toggle light error:', err)
        })
    },
    
    applyPreset(favorite) {
      this.state.light.hex = favorite.hex
      this.state.light.bri = favorite.bri
      this.state.light.hue = favorite.hue
      this.state.light.sat = favorite.sat
      this.state.light.xy = favorite.xy
      this.state.light.ct = favorite.ct
      
      this.request({
          method: 'SET_COLOR',
          params: {
            lightId: this.state.lightId,
            hex: favorite.hex,
            hue: favorite.hue,
            sat: favorite.sat,
            bri: favorite.bri,
            xy: favorite.xy,
            ct: favorite.ct
          }
        })
        .then(res => {
          if (res.success) this.loadLightDetail()
        })
    },
    
    addCurrentColorToFavorites() {
      const light = this.state.light
      let newFavorite = {
        bri: light.bri || 254
      }
      
      const colormode = light.colormode
      
      if (colormode === 'hs' && (light.sat > 0 || light.hue > 0)) {
        newFavorite.type = PRESET_TYPES.COLOR
        newFavorite.hue = light.hue || 0
        newFavorite.sat = light.sat || 0
        newFavorite.hex = normalizeHex(light.hex) || '#FF0000'
        
      } else if (colormode === 'xy' && light.xy) {
        newFavorite.type = PRESET_TYPES.COLOR
        newFavorite.xy = light.xy
        newFavorite.hex = normalizeHex(light.hex) || '#FF0000'
        
      } else if (colormode === 'ct' && light.ct > 0) {
        newFavorite.type = PRESET_TYPES.CT
        newFavorite.ct = light.ct
        newFavorite.hex = ct2hexString(light.ct) || '#FFFFFF'
        
      } else if (colormode === 'ct' || light.ct === 0 || colormode === 'none' || !colormode) {
        newFavorite.type = PRESET_TYPES.WHITE
        newFavorite.hex = '#FFFFFF'
        
      } else {
        newFavorite.type = PRESET_TYPES.WHITE
        newFavorite.bri = 254
        newFavorite.hex = '#FFFFFF'
      }
      
      this.request({
          method: 'ADD_FAVORITE_COLOR',
          params: { colorData: newFavorite }
        })
        .then(result => {
          logger.debug('Add favorite color result:', result)
          if (result.success && result.added) {
            // 👇 MODIFICATO: Aggiorna globalData invece di ricaricare
            const app = getApp()
            const currentSettings = app.getSettings()
            
            // Il backend ha già aggiunto l'ID, quindi ricarica le settings
            this.request({ method: 'GET_USER_SETTINGS' })
              .then(settingsResult => {
                if (settingsResult.success && settingsResult.settings) {
                  app.updateSettings(settingsResult.settings)
                  this.renderPage() // Re-render con i nuovi preset
                }
              })
            
          } else if (result.success && !result.added) {
            showToast({ text: getText('DUPLICATE_FAVORITE_COLOR') })
          }
        })
        .catch(err => {
          showToast({ text: getText('FAILED_TO_ADD_FAVORITE') })
          logger.error('Failed to add favorite color:', err)
        })
    },
    
    deletePreset(favorite) {
      if (this.currentModal) {
        this.currentModal.show(false)
        this.currentModal = null
      }
      
      let presetDescription = ''
      if (favorite.type === PRESET_TYPES.COLOR) {
        presetDescription = 'Color preset'
      } else if (favorite.type === PRESET_TYPES.CT) {
        presetDescription = 'White preset'
      } else if (favorite.type === PRESET_TYPES.WHITE) {
        const briPercent = Math.round((favorite.bri || 254) / 254 * 100)
        presetDescription = `Brightness preset (${briPercent}%)`
      }
      
      const dialog = createModal({
        content: `Delete this preset?\n\n${presetDescription}`,
        autoHide: false,
        onClick: (keyObj) => {
          if (keyObj.type === MODAL_CONFIRM) {
            this.request({
                method: 'REMOVE_FAVORITE_COLOR',
                params: { index: favorite.id }
              })
              .then(result => {
                if (result.success) {
                  // 👇 MODIFICATO: Aggiorna globalData invece di ricaricare
                  const app = getApp()
                  
                  // Ricarica settings dal backend
                  this.request({ method: 'GET_USER_SETTINGS' })
                    .then(settingsResult => {
                      if (settingsResult.success && settingsResult.settings) {
                        app.updateSettings(settingsResult.settings)
                        this.renderPage() // Re-render senza il preset eliminato
                      }
                    })
                }
              })
          }
          dialog.show(false)
          this.currentModal = null
        }
      })
      this.currentModal = dialog
      dialog.show(true)
    },
    
    goBack() {
      if (this.currentModal) {
        this.currentModal.show(false)
        this.currentModal = null
      }
      if (this.exitGestureListener) this.exitGestureListener()
      back()
    },
    
    onDestroy() {
      const app = getApp()
      app.clearCurrentLightData()
      
      if (this.exitGestureListener) this.exitGestureListener()
      if (this.currentModal) {
        try {
          this.currentModal.show(false)
        } catch (e) {
          logger.error('Error destroying modal', e)
        }
        this.currentModal = null
      }
      this.clearAllWidgets()
    }
  })
)