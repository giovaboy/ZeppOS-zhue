import { BasePage } from '@zeppos/zml/base-page'
import { loggedPage, warnLog } from '../utils/remote-log.js'
import { createGate } from '../utils/request-gate.js'
import { createDragGuard } from '../utils/drag-guard.js'
import { bindKeyNav } from '../utils/key-nav.js'
import { busyOn, stopPulses, contrastColor } from '../utils/pulse.js'
import { rememberLight, cardState, isInCard, toggleInCard } from '../utils/shortcuts.js'
import { localStorage } from '@zos/storage'
import { setPageBrightTime } from '@zos/display'
import { setScrollLock, getScrollTop, scrollTo } from '@zos/page'
import { getText } from '@zos/i18n'
import { createWidget, deleteWidget, prop, showToast } from '@zos/ui'
import { back, push } from '@zos/router'
import { createModal, MODAL_CONFIRM } from '@zos/interaction'
import { px } from '@zos/utils'
import { renderLightDetail, LAYOUT_CONFIG } from 'zosLoader:./light-detail.[pf].layout.js'
import { getLogger } from '../utils/logger.js'
import { COLORS, comparePresets, hexStringToInt, HUE_RANGE, SAT_RANGE, BRI_RANGE, DEFAULT_PRESETS, PRESET_TYPES, WIDGET_SHORTCUTS_KEY, hsb2hex, ct2hex, ct2hexString, xy2hex, normalizeHex, DEFAULT_USER_SETTINGS } from '../utils/constants.js'

const logger = getLogger('zhue-light-detail-page')
const app = getApp()

Page(
  loggedPage('light-detail', BasePage({
    state: {
      lightId: null,
      lightName: '',
      light: null,
      isLoading: false,
      isDraggingBrightness: false,
      tempBrightness: 0,
      brightnessSliderFillWidget: null,
      brightnessLabel: null,
      error: null,
      scrollPos_y: 0,
      isInWidgetShortcuts: false,
    },

    widgets: [],
    currentModal: null,


    onInit(p) {
      // ZML's BasePage hands every instance of this page the same `state`
      // object (field-notes.md, "Pages and the app"): what the previous light
      // left in it is reset here
      Object.assign(this.state, {
        lightId: null,
        lightName: '',
        light: null,
        isLoading: false,
        isDraggingBrightness: false,
        tempBrightness: 0,
        brightnessSliderFillWidget: null,
        brightnessLabel: null,
        error: null,
        scrollPos_y: 0,
        isInWidgetShortcuts: false,
      })
      this.widgets = []
      this.currentModal = null
      this._gate = createGate('light-detail')

      let params = {}
      try {
        params = typeof p === 'string' ? JSON.parse(p) : p
      } catch (e) {
        logger.error('Error parsing params', e)
      }

      // 1. Cerchiamo l'ID nei parametri
      let targetId = params?.lightId

      // 2. Se non c'è, chiediamo al Global Store (Salvagente per il Back)
      if (!targetId) {
        logger.warn('Missing lightId in params, checking global store...')
        targetId = app.getCurrentLightId()
      }

      if (!targetId) {
        // Se non lo troviamo nemmeno qui, siamo fritti. Torniamo indietro o mostriamo errore.
        logger.error('CRITICAL: No lightId found!')
        this.state.error = getText('LIGHT_NOT_FOUND')
        return
      }

      // 3. Salviamo lo stato e aggiorniamo il global store per il futuro
      this.state.lightId = targetId
      app.setCurrentLightId(targetId) // Rinforziamo il dato
      this.state.lightName = params?.lightName || getText('LIGHT')

      // Prova a usare i dati dal global store
      const cachedLightData = app.getLightData(this.state.lightId)

      if (cachedLightData) {
        logger.log('Using cached light data from global store')
        this.state.light = cachedLightData
        this.state.isLoading = false
      } else {
        logger.log('No cached light data available, will load from API')
        this.state.isLoading = true
      }

      this._keys = null
      this._nav = null
    },

    // Held BACK: empty the shortcut card (after a confirmation)
    askClearWidgetShortcuts() {
      const dialog = createModal({
        content: getText('CLEAR_QUICK_TOGGLE_WIDGET_SHORTCUTS'),
        autoHide: false,
        onClick: (keyObj) => {
          if (keyObj.type === MODAL_CONFIRM) {
            // Only the shortcuts: the rest of localStorage is not theirs
            localStorage.removeItem(WIDGET_SHORTCUTS_KEY)
          }
          dialog.show(false)
          this.currentModal = null
          this.checkWidgetShortcutStatus()
          this.renderPage()
        }
      })
      this.currentModal = dialog
      dialog.show(true)
    },

    build() {
      logger.log('Building Light Detail page')
      logger.debug('Initial state - light:', !!this.state.light, 'isLoading:', this.state.isLoading)

      setPageBrightTime({ brightTime: 60000 })
      // The page is one long list that scrolls as a whole; the slider locks
      // the scrolling while dragged (handleBrightnessDrag)
      setScrollLock({ lock: false })
      // The page's one onGesture: right swipe goes back, not while the
      // brightness slider is dragged (utils/drag-guard.js)
      this._drag = createDragGuard('light-detail')
      // The page's one onKey: UP / DOWN between power, color, favorites, the
      // add tile and the shortcut row; SELECT acts, held SELECT deletes a
      // favorite (with no item focused: adds / removes the light from the
      // shortcut card, as before); held BACK empties the card; BACK goes back
      this._keys = bindKeyNav({
        getItems: () => (this._nav && this._nav.items) || [],
        onBackLong: () => this.askClearWidgetShortcuts(),
        onSelectLongUnfocused: () => this.toggleWidgetShortcut(),
        isBlocked: () => !!this.currentModal,
        label: 'light-detail'
      })

      this.checkWidgetShortcutStatus()

      if (this.state.error && !this.state.lightId) {
        this.renderPage()
        return
      }

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

    getFavoriteColors() {
      const settings = app.getSettings() || DEFAULT_USER_SETTINGS
      return settings.favorite_colors || DEFAULT_PRESETS
    },

    renderPage() {
      // Animations of the previous drawing (their widgets go with it)
      stopPulses(this)
      if (this._keys) this._keys.reset()
      // The page scrolls as a whole: where it was, to come back to it once
      // redrawn (a toggle, a preset applied)
      let scrollTop = 0
      try { scrollTop = getScrollTop() || 0 } catch (e) {}
      this.clearAllWidgets()
      // Filled by the layout: the items the keys move between
      const nav = { items: [], view: null }

      const favoriteColors = this.getFavoriteColors()
      const sortedPresets = [...favoriteColors].sort(comparePresets)

      logger.debug('Rendering page - isLoading:', this.state.isLoading, 'error:', this.state.error, 'hasLight:', !!this.state.light)
      logger.debug('Favorite colors count:', favoriteColors.length)

      // Pre-calcola hex se necessario
      if (this.state.light && !this.state.isLoading && !this.state.light.hex) {
        logger.debug('Pre-calculating light hex color...')
        const light = this.state.light
        let rgb = null

        switch (light.colormode) {
          case 'hs': {
            const bri = light.bri ?? 100
            const hue = light.hue ?? 0
            const sat = light.sat ?? 0

            const nBri = Math.round((bri / BRI_RANGE) * 100)
            const nHue = Math.round((hue / HUE_RANGE) * 360)
            const nSat = Math.round((sat / SAT_RANGE) * 100)

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
          this.updateLight({ hex: normalizeHex('#' + rgb.toString(16).padStart(6, '0').toUpperCase()) })
          logger.debug('Calculated light hex color:', this.state.light.hex)
        }
      }

      renderLightDetail(this, { ...this.state, favoriteColors: sortedPresets }, {
        nav,
        toggleLightFunc: () => this.toggleLight(),
        setBrightnessDrag: (evtType, info) => this.handleBrightnessDrag(evtType, info),
        openColorPickerFunc: () => this.openColorPicker(),
        applyPresetFunc: (fav) => this.applyPreset(fav),
        addFavoriteFunc: () => this.addCurrentColorToFavorites(),
        deleteFavoriteFunc: (fav) => this.deletePreset(fav),
        retryFunc: () => this.loadLightDetail(),
        getLightBgColor: (hex) => this.getLightBgColor(hex),
        capabilities: (light) => this.getLightCapabilities(light),
        toggleWidgetShortcutFunc: () => this.toggleWidgetShortcut(),
        isInWidgetShortcuts: this.state.isInWidgetShortcuts
      })
      this._nav = nav
      if (scrollTop) { try { scrollTo({ y: scrollTop }) } catch (e) {} }
      if (this._keys) this._keys.refocus()
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
        return Math.max(this.state.light.ison ? 1 : 0, Math.round((positionInTrack / sliderW) * BRI_RANGE))
      }

      // The page scrolls, and a swipe up or down that started on the slider
      // used to move the brightness (it jumped to the touched point at once)
      // and lock the scrolling. Now a touch is decided by its first SLIDE_PX
      // of movement: across, it drags the brightness (and locks the page);
      // up or down, it is left to the page. A touch that doesn't move sets
      // the brightness where it lands, on release.
      const SLIDE_PX = px(12)

      if (evtType === 'DOWN') {
        this._slide = { mode: 'pending', x0: info.x, y0: info.y }

      } else if (evtType === 'MOVE') {
        const slide = this._slide
        if (!slide || slide.mode === 'scroll') return
        if (slide.mode === 'pending') {
          const dx = Math.abs(info.x - slide.x0)
          const dy = Math.abs(info.y - slide.y0)
          if (dy >= SLIDE_PX && dy >= dx) { slide.mode = 'scroll'; return }
          if (dx < SLIDE_PX) return
          // Across: a brightness drag from here on
          slide.mode = 'drag'
          if (this._drag) this._drag.start()
          setScrollLock({ lock: true })
          this.state.isDraggingBrightness = true
        }
        if (this._drag) this._drag.move()
        this.armDragTimeout()

        const newBri = getBrightnessFromX(info.x)
        if (newBri === this.state.tempBrightness) return
        this.state.tempBrightness = newBri
        // Live: the light follows the finger. setBrightness goes through the
        // request queue, where only the latest value waits behind the one in
        // flight; the release sends the last one
        this.setBrightness(newBri, false)

      } else if (evtType === 'UP') {
        const slide = this._slide
        this._slide = null
        if (!slide) return
        if (slide.mode === 'pending' && info) {
          // A tap: the brightness where it landed
          const newBri = getBrightnessFromX(info.x)
          this.state.tempBrightness = newBri
          this.setBrightness(newBri, true)
          if (newBri !== this.state.light.bri) this.setBrightness(newBri, false)
          return
        }
        if (slide.mode !== 'drag') return
        if (this._drag) this._drag.end()
        if (this._dragTimer) { clearTimeout(this._dragTimer); this._dragTimer = null }
        setScrollLock({ lock: false })

        if (this.state.tempBrightness !== this.state.light.bri) {
          this.setBrightness(this.state.tempBrightness, false)
        }

        this.state.isDraggingBrightness = false
      }
    },

    // A slider drag whose release never came (the finger left the slider)
    // ends by itself 1.5 s after its last move: the value is sent and the page
    // scrolls again
    armDragTimeout() {
      if (this._dragTimer) clearTimeout(this._dragTimer)
      this._dragTimer = setTimeout(() => {
        this._dragTimer = null
        if (this.state.isDraggingBrightness) {
          warnLog('[light-detail] slider: no release 1.5 s after the last move, drag ended')
          // As a drag, whatever the touch state says: the page must scroll again
          this._slide = { mode: 'drag' }
          this.handleBrightnessDrag('UP', null)
        }
      }, 1500)
    },

    setBrightness(brightness, skipApiCall = false) {
      const { sliderW } = LAYOUT_CONFIG
      const fillWidth = Math.max(px(5), Math.round(sliderW * brightness / BRI_RANGE))
      const percent = Math.round(brightness / BRI_RANGE * 100)

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

      // A value: while one is in flight only the latest waits
      this._gate.run('brightness', () => this.request({
        method: 'SET_BRIGHTNESS',
        params: { lightId: this.state.lightId, bri: brightness }
      }).then(res => {
        if (res.success) {
          this.updateLight({ bri: brightness })
        }
      }).catch(e => logger.error(e)), true)
    },

    getLightCapabilities(light) {
      if (!light) {
        logger.warn('getLightCapabilities called with no light')
        return ['brightness']
      }

      logger.debug('getLightCapabilities input:', {
        id: light.id,
        type: light.type,
        modelid: light.modelid,
        colormode: light.colormode,
        hasCapabilities: !!light.capabilities,
        capabilities: light.capabilities,
        hue: light.hue,
        sat: light.sat,
        ct: light.ct,
        xy: light.xy
      })

      // 1. Se abbiamo già capabilities valide, usale
      if (light.capabilities && Array.isArray(light.capabilities) && light.capabilities.length > 0) {
        logger.debug('Using existing capabilities:', light.capabilities)
        return light.capabilities
      }

      // 2. Inferisci dalle properties della luce
      let caps = ['brightness']

      // Controlla colormode (più affidabile)
      const colormode = light.colormode || ''

      // Se ha colormode 'hs' o 'xy', supporta colori
      if (colormode === 'hs' || colormode === 'xy') {
        caps.push('color')
        logger.debug('Detected color support from colormode:', colormode)
      }

      // Se ha colormode 'ct', supporta temperatura colore
      if (colormode === 'ct') {
        caps.push('ct')
        logger.debug('Detected CT support from colormode')
      }

      // Controlla se ha valori hue/sat/xy (fallback)
      const hasColorValues = (light.hue !== undefined && light.hue !== null) ||
        (light.sat !== undefined && light.sat !== null) ||
        (light.xy !== undefined && light.xy !== null)

      if (hasColorValues && !caps.includes('color')) {
        caps.push('color')
        logger.debug('Detected color support from color values')
      }

      // Controlla se ha valore ct (fallback)
      const hasCtValue = light.ct !== undefined && light.ct !== null && light.ct > 0

      if (hasCtValue && !caps.includes('ct')) {
        caps.push('ct')
        logger.debug('Detected CT support from ct value')
      }

      // 3. Inferisci dal tipo/modello se disponibile
      const type = (light.type || '').toLowerCase()

      // Alcuni modelli noti
      if (type.includes('color') || type.includes('extended color')) {
        if (!caps.includes('color')) caps.push('color')
        if (!caps.includes('ct')) caps.push('ct')
        logger.debug('Detected color+CT support from type:', type)
      } else if (type.includes('ambiance') || type.includes('temperature')) {
        if (!caps.includes('ct')) caps.push('ct')
        logger.debug('Detected CT support from type:', type)
      }

      // 4. Fallback per luci senza info: se non ha CT né colori, è solo brightness
      if (caps.length === 1 && !colormode && !hasColorValues && !hasCtValue) {
        logger.debug('No color/CT detected, brightness-only light')
      }

      logger.debug('Final capabilities:', caps)
      return caps
    },

    getLightBgColor(hex) {
      const cleanHex = hex.replace('#', '')
      if (cleanHex === '000000') return 0x000000
      const color = parseInt(cleanHex, 16)
      const bg = ((color >> 3) & 0x1f1f1f) + 0x0a0a0a
      // A white light gives a dark grey (up to #292929): greys with RGB 1–46
      // are to be avoided (design-guidelines.md, "Color"), so color_sys_item.
      // Tinted ones stay: the rule is about greys
      const r = bg >> 16, g = (bg >> 8) & 0xff, b = bg & 0xff
      return (r === g && g === b) ? COLORS.lightBg : bg
    },

    loadLightDetail() {
      logger.log('Loading light detail...')
      logger.debug('Light ID:', this.state.lightId)


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
            this.updateLight(result.data.light)
            this.state.tempBrightness = this.state.light.bri || 0
            this.state.isLoading = false
            this.state.error = null

            logger.log('Light detail loaded successfully')

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

    // One toggle at a time: a tap during one waits for it, and reads the state
    // it left
    toggleLight() {
      this._gate.run('toggle', () => busyOn(this, 'power', () => this._toggleLight()))
    },

    _toggleLight() {
      const currentState = this.state.light.ison
      const newState = !this.state.light.ison

      return this.request({
        method: 'TOGGLE_LIGHT',
        params: { lightId: this.state.lightId, state: newState }
      })
        .then(result => {
          if (result.success) {
            if (result.updatedState) {
              logger.debug('Applying updated state from backend:', result.updatedState)
              // Aggiorna oggetto luce
              this.updateLight({ ...result.updatedState })
            } else {
              this.updateLight({ ison: newState })
            }
            this.renderPage()
          }
        })
        .catch(err => {
          logger.error('Toggle light error:', err)
          // ✅ Ripristina stato
          this.updateLight({ ison: currentState }, false)
          this.renderPage()
        })
    },

    // A value: only the latest preset tapped waits
    applyPreset(favorite) {
      this._gate.run('preset', () => busyOn(this, `preset:${favorite.id}`, () => this._applyPreset(favorite), contrastColor(hexStringToInt(favorite.hex))), true)
    },

    _applyPreset(favorite) {
      let method = 'SET_BRIGHTNESS'

      if (favorite.type === PRESET_TYPES.COLOR || favorite.type === PRESET_TYPES.CT) {
        method = 'SET_COLOR'
      }

      return this.request({
        method: method,
        params: {
          lightId: this.state.lightId,
          hex: favorite.hex,
          hue: favorite.hue,
          sat: favorite.sat,
          bri: favorite.bri,
          xy: favorite.xy,
          ct: favorite.ct,
          // The reply carries the light as it is now (one round trip, where a
          // GET_LIGHT_DETAIL followed)
          withState: true
        }
      })
        .then(res => {
          if (res.success) {

            let colormode = this.state.light.colormode // Keep current as fallback

            if (favorite.type === PRESET_TYPES.CT) {
              colormode = 'ct'
            } else if (favorite.type === PRESET_TYPES.COLOR) {
              // Use 'xy' if preset has xy values, otherwise 'hs'
              colormode = favorite.xy ? 'xy' : 'hs'
            }

            // A favorite turns the light on (the side service sends on: true)
            this.updateLight({
              ison: true,
              hex: favorite.hex,
              bri: favorite.bri,
              hue: favorite.hue,
              sat: favorite.sat,
              xy: favorite.xy,
              ct: favorite.ct,
              colormode: colormode
            })
            if (res.light) {
              // The light as the bridge has it now: shown at once
              this.updateLight(res.light)
              this.state.tempBrightness = this.state.light.bri || 0
              this.renderPage()
            } else {
              this.loadLightDetail()
            }
          }
        })
        .catch(err => {
          logger.error('Apply preset error:', err)
        })
    },

    addCurrentColorToFavorites() {
      const light = this.state.light
      let newFavorite = {
        bri: light.bri || BRI_RANGE
      }

      logger.debug('Adding current light color to favorites:', light)

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
      } else if (colormode === 'bri') {
        newFavorite.type = PRESET_TYPES.WHITE
        newFavorite.bri = light.bri
        newFavorite.hex = '#FFFFFF'
      } else {
        newFavorite.type = PRESET_TYPES.WHITE
        newFavorite.bri = BRI_RANGE
        newFavorite.hex = '#FFFFFF'
      }

      // The add tile breathes until the phone answered
      busyOn(this, 'add', () => this.request({
        method: 'ADD_FAVORITE_COLOR',
        params: { colorData: newFavorite }
      })
        .then(result => {
          logger.debug('Add favorite color result:', result)
          if (result.success && result.added) {
            this.reloadFavoriteColors()
          } else if (result.success && !result.added) {
            showToast({ text: getText('DUPLICATE_FAVORITE_COLOR') })
          }
        })
        .catch(err => {
          showToast({ text: getText('FAILED_TO_ADD_FAVORITE') })
          logger.error('Failed to add favorite color:', err)
        }))
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
        const briPercent = Math.round((favorite.bri || BRI_RANGE) / BRI_RANGE * 100)
        presetDescription = `Brightness preset (${briPercent}%)`
      }

      const dialog = createModal({
        content: `${getText('PRESET_DELETE_CONFIRM')}\n\n${presetDescription }`,
        autoHide: false,
        onClick: (keyObj) => {
          if (keyObj.type === MODAL_CONFIRM) {
            this.request({
              method: 'REMOVE_FAVORITE_COLOR',
              params: { favoriteId: favorite.id }
            })
              .then(result => {
                if (result.success) {
                  this.reloadFavoriteColors()
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

    reloadFavoriteColors() {
      this.request({ method: 'GET_USER_SETTINGS' })
        .then(settingsResult => {
          if (settingsResult.success && settingsResult.settings) {
            app.updateSettings(settingsResult.settings)
            this.renderPage()
          }
        })
        .catch(err => {
          logger.error('Failed to reload settings:', err)
        })
    },

    updateLight(updates, syncWithGlobal = true) {
      this.state.light = {
        ...this.state.light,
        ...updates
      }

      if (syncWithGlobal) {
        // Sincronizza con globalData
        app.setLightData(this.state.lightId, this.state.light)
        app.updateLightStatusInGroupsCache(this.state.lightId, this.state.light)
        // The shortcut card shows it as last seen (written only if it changed)
        rememberLight(this.state.lightId, this.state.light)
      }
    },

    onScrollChange(y) {
      this.state.scrollPos_y = y
    },

    // ==========================================
    // THE SHORTCUT CARD (utils/shortcuts.js: lights and groups)
    // ==========================================

    checkWidgetShortcutStatus() {
      if (!this.state.lightId) return
      this.state.isInWidgetShortcuts = isInCard('light', this.state.lightId)
    },

    // The light in the card, or out of it; added with its state, so the card
    // shows it in its color at once
    toggleWidgetShortcut() {
      const result = toggleInCard({
        lightId: this.state.lightId,
        lightName: this.state.lightName || this.state.light?.name || 'Light',
        modelid: this.state.light?.modelid || 'default',
        ...(this.state.light ? cardState(this.state.light) : {})
      })
      if (result === 'full') {
        showToast({ text: getText('WIDGET_SLOTS_FULL') })
        return
      }
      this.state.isInWidgetShortcuts = result === 'added'
      showToast({ text: getText(result === 'added' ? 'ADDED_TO_WIDGET' : 'REMOVED_FROM_WIDGET') })
      this.renderPage()
    },

    onDestroy() {
      this.state.isLoading = false
      if (this._keys) this._keys.stop()
      stopPulses(this)
      if (this._dragTimer) { clearTimeout(this._dragTimer); this._dragTimer = null }
      if (this._gate) this._gate.close()
      this.clearAllWidgets()
      if (this.currentModal) {
        try {
          this.currentModal.show(false)
        } catch (e) {
          logger.error('Error destroying modal', e)
        }
        this.currentModal = null
      }
    }
  }))
)
