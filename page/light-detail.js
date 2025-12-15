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
import { DEFAULT_PRESETS, PRESET_TYPES, hsb2hex, ct2hex, ct2hexString, xy2hex, xy2hexString, normalizeHex } from '../utils/constants.js'

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
      favoriteColors: null,
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
      this.state.light = params?.light
    },
    
    build() {
      logger.log('Building Light Detail page')
      setPageBrightTime({ brightTime: 60000 })
      setScrollLock({ lock: false })
      this.unlockExitGesture()
      this.loadLightDetail()
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
    
    // --- GESTURE LOCK LOGIC ---
    
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
        callback: (event) => true // Consuma l'evento
      })
    },
    
    // --- RENDERING ---
    
    renderPage() {
      this.clearAllWidgets()
      
      // Ordina i preset se esistono
      if (this.state.favoriteColors) {
        this.state.favoriteColors.sort(comparePresets)
      }
      
      // Pre-calcola hex se necessario (SOLO se abbiamo light)
      /*if (this.state.light && !this.state.light.hex) {
        const bri = this.state.light.bri || 100
        const nBri = Math.round(bri / 254 * 100)
        const nHue = Math.round((this.state.light.hue || 0) / 65535 * 360)
        const nSat = Math.round((this.state.light.sat || 0) / 254 * 100)
        const val = hsb2hex(nHue, nSat, nBri)
        this.state.light.hex = '#' + val.toString(16).padStart(6, '0').toUpperCase()
      }*/
      
      logger.debug('Pre-calculating light hex color if needed...')
      logger.debug('light state:', this.state.light)
      
      if (this.state.light && !this.state.light.hex) {
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
              rgb = xy2hex(light.xy)
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
        }
        logger.debug('Calculated light hex color:', this.state.light.hex)
      }
      
      
      
      // Chiama il layout - gestirà tutti gli stati
      renderLightDetail(this, this.state, {
        toggleLightFunc: () => this.toggleLight(),
        setBrightnessDrag: (evtType, info) => this.handleBrightnessDrag(evtType, info),
        openColorPickerFunc: () => this.openColorPicker(),
        applyPresetFunc: (fav) => this.applyPreset(fav),
        addFavoriteFunc: () => this.addCurrentColorToFavorites(),
        deleteFavoriteFunc: (fav) => this.deletePreset(fav),
        retryFunc: () => this.loadLightDetail(), // ← AGGIUNTO
        getLightBgColor: (hex) => this.getLightBgColor(hex),
        capabilities: this.getLightCapabilities(this.state.light)
      })
    },
    
    // --- NAVIGATION ---
    
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
    
    // --- DRAG LOGIC ---
    
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
    
    // --- HELPERS ---
    
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
    
    // --- API CALLS ---
    
    loadLightDetail() {
      // Mostra loading solo se non abbiamo dati
      if (!this.state.light) {
        this.state.isLoading = true
        this.state.error = null
        this.renderPage()
      }
      
      logger.log('Loading light detail...')
      logger.debug('Light ID:', this.state.lightId)
      logger.debug('Current favorite colors loaded:', this.state.favoriteColors ? this.state.favoriteColors.length : 'none')
      logger.debug('Current light data:', this.state.light)
      
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
            
            // Carica preset se non già caricati
            if (!this.state.favoriteColors) {
              this.loadFavoriteColors()
            } else {
              this.renderPage()
            }
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
    
    loadFavoriteColors() {
      logger.log('Loading favorite colors...')
      
      this.request({ method: 'GET_FAVORITE_COLORS' })
        .then(result => {
          if (result.success) {
            this.state.favoriteColors = result.colors || DEFAULT_PRESETS
            logger.log('Favorite colors loaded:', this.state.favoriteColors.length)
          } else {
            this.state.favoriteColors = DEFAULT_PRESETS
          }
          this.renderPage()
        })
        .catch(err => {
          logger.error('Failed to load favorite colors:', err)
          this.state.favoriteColors = DEFAULT_PRESETS
          this.renderPage()
        })
    },
    
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
        // 1. Inizializza la luminosità per tutti i preferiti
        bri: light.bri || 254
      }
      
      const colormode = light.colormode
      
      if (colormode === 'hs' && (light.sat > 0 || light.hue > 0)) {
        // Modalità Colore HS (Hue/Saturation)
        newFavorite.type = PRESET_TYPES.COLOR
        newFavorite.hue = light.hue || 0
        newFavorite.sat = light.sat || 0
        // Assicurati sempre che hex sia valido per il rendering dell'anteprima
        newFavorite.hex = normalizeHex(light.hex) || '#FF0000'
        
      } else if (colormode === 'xy' && light.xy) {
        // Modalità Colore XY (Coordinate CIE)
        newFavorite.type = PRESET_TYPES.COLOR
        newFavorite.xy = light.xy
        newFavorite.hex = normalizeHex(light.hex) || '#FF0000'
        
      } else if (colormode === 'ct' && light.ct > 0) {
        // Modalità Temperatura Colore (CT)
        newFavorite.type = PRESET_TYPES.CT
        newFavorite.ct = light.ct
        // Usa la funzione per convertire in Hex per l'anteprima (bianchi caldi/freddi)
        newFavorite.hex = ct2hexString(light.ct) || '#FFFFFF'
        
      } else if (colormode === 'ct' || light.ct === 0 || colormode === 'none' || !colormode) {
        // Modalità Bianco Puro / Luminosità (Caso di fallback)
        // Questo copre le luci bianche che non hanno un colormode definito
        // o hanno ct ma luce bianca a massima temperatura (tipicamente ct alto).
        newFavorite.type = PRESET_TYPES.WHITE
        newFavorite.hex = '#FFFFFF'
        
      } else {
        // Caso di fallback generale o stato non gestito (es. luce spenta senza modalità)
        // Possiamo decidere se salvare un preferito 'neutro' o abortire.
        // Scelta: se i dati sono insufficienti, salviamo un bianco base a max bri (254).
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
            this.loadFavoriteColors()
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
                //showToast(result)
                if (result.success) {
                  this.loadFavoriteColors()
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