import { BasePage } from '@zeppos/zml/base-page'
import { setPageBrightTime } from '@zos/display'
import { setScrollLock } from '@zos/page'
import { getText } from '@zos/i18n'
import { createWidget, deleteWidget, widget, prop, align } from '@zos/ui'
import { back, push } from '@zos/router'
import { onGesture, GESTURE_RIGHT, createModal, MODAL_CONFIRM } from '@zos/interaction'
import { px } from '@zos/utils'
import { renderLightDetail, LAYOUT_CONFIG } from 'zosLoader:./light-detail.[pf].layout.js'
import { getLogger } from '../utils/logger.js'
import { DEFAULT_PRESETS, PRESET_TYPES, hsb2hex, ct2hexString, normalizeHex } from '../utils/constants.js'

const logger = getLogger('zhue-light-detail-page')

// ... (Funzioni helper getPresetTypePriority e comparePresets rimangono uguali) ...
function getPresetTypePriority(type) {
  switch (type) {
    case PRESET_TYPES.WHITE: return 1;
    case PRESET_TYPES.CT: return 2;
    case PRESET_TYPES.COLOR: return 3;
    default: return 99;
  }
}

function comparePresets(a, b) {
  const priorityA = getPresetTypePriority(a.type);
  const priorityB = getPresetTypePriority(b.type);
  if (priorityA !== priorityB) return priorityA - priorityB;
  if (a.type === PRESET_TYPES.WHITE) return a.bri - b.bri;
  if (a.type === PRESET_TYPES.CT) return a.ct - b.ct;
  if (a.type === PRESET_TYPES.COLOR) return a.hue - b.hue;
  return 0;
}

Page(
  BasePage({
    state: {
      lightId: null,
      lightName: '',
      light: null,
      isLoading: false,
      favoriteColors: [...DEFAULT_PRESETS],
      isDraggingBrightness: false,
      tempBrightness: 0,
      brightnessSliderFillWidget: null,
      brightnessLabel: null,
    },

    widgets: [],
    currentModal: null,
    exitGestureListener: null,

    onInit(p) {
      let params = {}
      try { params = typeof p === 'string' ? JSON.parse(p) : p } catch (e) {
        logger.error('Error parsing params', e)
      }
      this.state.lightId = params?.lightId
      this.state.lightName = params?.lightName || getText('LIGHT')
      this.loadFavoriteColors()
    },

    build() {
      logger.log('Building Light Detail page')
      setPageBrightTime({ brightTime: 60000 })
      // Disabilita scroll verticale di base (se la pagina sta in una schermata)
      // Se hai una lista lunga di preset, gestiscilo dinamicamente.
      setScrollLock({ lock: false })

      // Inizializza la gestione gesture (SBLOCCATA di default)
      this.unlockExitGesture();

      this.loadLightDetail()
    },

    onResume() {
      logger.log('Resuming Light Detail');
      if (this.state.lightId) {
        this.loadFavoriteColors()
        this.loadLightDetail();
      }
    },

    clearAllWidgets() {
      this.widgets.forEach(w => {
        try { deleteWidget(w) } catch (e) { logger.error('Del widget err', e) }
      })
      this.widgets = []
      // Reset riferimenti
      this.state.brightnessSliderFillWidget = null
      this.state.brightnessLabel = null
    },

    createTrackedWidget(type, props) {
      const w = createWidget(type, props)
      this.widgets.push(w)
      return w
    },

    // --- GESTURE LOCK LOGIC (CORRETTA) ---

    /** * Sblocca l'uscita: Registra un listener che permette il comportamento custom (o di default).
     * Se return true -> evento consumato (non fa altro).
     * Se return false -> evento propagato (sistema fa back).
     */
    unlockExitGesture() {
      if (this.exitGestureListener) {
        this.exitGestureListener(); // Rimuovi vecchio listener
      }
      this.exitGestureListener = onGesture({
        callback: (event) => {
          if (event === GESTURE_RIGHT) {
            back(); // Gestiamo noi il back
            return true;
          }
          return false;
        }
      });
      // logger.debug('Exit gesture UNLOCKED (Custom Back)');
    },

    /** * Blocca l'uscita: Registra un listener che "mangia" l'evento e restituisce TRUE.
     * Questo impedisce al sistema di fare qualsiasi cosa.
     */
    lockExitGesture() {
      if (this.exitGestureListener) {
        this.exitGestureListener();
      }
      this.exitGestureListener = onGesture({
        callback: (event) => {
          // logger.debug('Gesture BLOCKED during drag');
          return true; // CONSUMA L'EVENTO -> NESSUNA AZIONE
        }
      });
      // logger.debug('Exit gesture LOCKED');
    },

    // --- RENDERING ---

    renderPage() {
      this.clearAllWidgets()
      this.state.favoriteColors.sort(comparePresets);

      if (this.state.isLoading && !this.state.light) {
        this.createTrackedWidget(widget.TEXT, { x: 0, y: 200, w: 480, h: 50, text: getText('LOADING'), align_h: widget.ALIGN_CENTER_H, align_v: widget.ALIGN_CENTER_V })
        return
      }
      if (!this.state.light) return

      const light = this.state.light
      const capabilities = this.getLightCapabilities(light);

      logger.debug('Rendering page for light:', light.id, 'Name:', light.name, 'Capabilities:', capabilities);

      if (!light.hex) {
        const bri = light.bri || 100;
        const nBri = Math.round(bri / 254 * 100);
        const nHue = Math.round((light.hue || 0) / 65535 * 360);
        const nSat = Math.round((light.sat || 0) / 254 * 100);
        const val = hsb2hex(nHue, nSat, nBri);
        light.hex = '#' + val.toString(16).padStart(6, '0').toUpperCase();
      }

      renderLightDetail(this, this.state, {
        toggleLightFunc: () => this.toggleLight(),
        setBrightnessDrag: (evtType, info) => this.handleBrightnessDrag(evtType, info),
        openColorPickerFunc: () => this.openColorPicker(),
        applyPresetFunc: (fav) => this.applyPreset(fav),
        addFavoriteFunc: () => this.addCurrentColorToFavorites(),
        deleteFavoriteFunc: (fav) => this.deletePreset(fav),
        goBackFunc: () => this.goBack(),
        getLightBgColor: (hex) => this.getLightBgColor(hex),
        capabilities: capabilities
      })
    },

    // --- NAVIGATION ---

    openColorPicker() {
      const light = this.state.light;
      const caps = this.getLightCapabilities(light);

      // Determina modalità iniziale
      // Se la luce è in modalità 'ct' (temperatura), apriamo il tab 'White'
      let initialMode = 'color';
      if (light.colormode === 'ct' || !caps.includes('color')) {
        initialMode = 'ct';
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

    // --- DRAG LOGIC (ROBUST) ---

    handleBrightnessDrag(evtType, info) {
      const { sliderX, sliderW } = LAYOUT_CONFIG

      const getBrightnessFromX = (x) => {
        let positionInTrack = x - sliderX;
        positionInTrack = Math.max(0, Math.min(positionInTrack, sliderW));
        return Math.max(this.state.light.ison ? 1 : 0, Math.round((positionInTrack / sliderW) * 254));
      }

      if (evtType === 'DOWN') {
        this.lockExitGesture(); // BLOCCA gesture sistema
        setScrollLock({ lock: true }); // BLOCCA scroll verticale

        const newBri = getBrightnessFromX(info.x)
        this.state.isDraggingBrightness = true
        // Ottimizzazione: aggiorna solo se cambiato
        if (newBri === this.state.tempBrightness) return

        this.state.tempBrightness = newBri
        this.setBrightness(newBri, false)

      } else if (evtType === 'MOVE') {
        if (!this.state.isDraggingBrightness) return

        const newBri = getBrightnessFromX(info.x)
        // Ottimizzazione: aggiorna solo se cambiato
        if (newBri === this.state.tempBrightness) return

        this.state.tempBrightness = newBri
        this.setBrightness(newBri, false)

      } else if (evtType === 'UP') {
        if (!this.state.isDraggingBrightness) return

        // RILASCIA I BLOCCHI
        this.unlockExitGesture();
        setScrollLock({ lock: false });

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

      // DEBUG: Verifica se i widget esistono
      if (this.state.brightnessSliderFillWidget) {
          try {
            this.state.brightnessSliderFillWidget.setProperty(prop.W, fillWidth)
          } catch(e) { logger.error('SetBri Fill Widget Error', e) }
      }

      if (this.state.brightnessLabel) {
          try {
            this.state.brightnessLabel.setProperty(prop.TEXT, `${percent}%`)
          } catch(e) { logger.error('SetBri Label Widget Error', e) }
      }

      if (skipApiCall) return

      this.request({
        method: 'SET_BRIGHTNESS',
        params: { lightId: this.state.lightId, brightness }
      }).catch(e => logger.error(e))
    },

    // ... (rest of methods: getLightCapabilities, getLightBgColor, loadLightDetail, toggleLight, deletePreset, applyPreset, loadFavoriteColors, addCurrentColorToFavorites, goBack, onDestroy)
    // Assicurati che onDestroy chiami this.unlockExitGesture() o pulisca il listener!

    /*getLightCapabilities(light) {
        if (!light) return [];
        const type = light.type || '';
        let caps = ['brightness'];
        if (type.toLowerCase().includes('color') || light.state?.hasOwnProperty('hue')) caps.push('color');
        if (type.toLowerCase().includes('color') || type.toLowerCase().includes('ambiance') || light.state?.hasOwnProperty('ct')) caps.push('ct');
        return caps;
    },*/

    getLightCapabilities(light) {
      if (!light) return [];
      const type = light.type || '';
      let caps = ['brightness'];
      // Rilevamento capabilities un po' più robusto
      if (type.toLowerCase().includes('color') || light.state?.hasOwnProperty('hue')) caps.push('color');
      if (type.toLowerCase().includes('color') || type.toLowerCase().includes('ambiance') || light.state?.hasOwnProperty('ct')) caps.push('ct');
      // Hack per vecchie API che espongono le capabilities esplicitamente
      logger.debug(light)
      if (light.capabilities) return light.capabilities;
      logger.debug(caps)
      return caps;
    },

    getLightBgColor(hex) {
      const cleanHex = hex.replace('#', '')
      if (cleanHex === '000000') return 0x000000
      const color = parseInt(cleanHex, 16)
      return ((color >> 3) & 0x1f1f1f) + 0x0a0a0a
    },

    loadLightDetail() {
      if (!this.state.light) this.state.isLoading = true;
      this.request({ method: 'GET_LIGHT_DETAIL', params: { lightId: this.state.lightId } })
        .then(result => {
          if (result.success) {
            this.state.light = result.data.light
            this.state.tempBrightness = this.state.light.bri || 0
            this.state.isLoading = false
            this.renderPage()
          }
        })
        .catch(err => {
          this.state.isLoading = false;
          logger.error(err)
        })
    },

    toggleLight() {
      const newState = !this.state.light.ison;
      this.request({ method: 'TOGGLE_LIGHT', params: { lightId: this.state.lightId, state: newState } })
        .then(result => {
          if (result.success) {
            this.state.light.ison = newState;
            setTimeout(() => this.loadLightDetail(), 100);
          }
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
                  this.loadFavoriteColors()
                  this.renderPage()
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

    applyPreset(favorite) {
      this.state.light.hex = favorite.hex
      this.state.light.bri = favorite.bri
      this.state.light.hue = favorite.hue
      this.state.light.sat = favorite.sat
      this.state.light.ct = favorite.ct

      this.request({
          method: 'SET_COLOR',
          params: {
            lightId: this.state.lightId,
            hex: favorite.hex,
            hue: favorite.hue,
            sat: favorite.sat,
            bri: favorite.bri,
            ct: favorite.ct
          }
        })
        .then(res => { if (res.success) this.loadLightDetail() })
    },

    loadFavoriteColors() {
      logger.log('Loading favorite colors...')
      this.request({ method: 'GET_FAVORITE_COLORS' })
        .then(result => {
          if (result.success) {
            this.state.favoriteColors = result.colors || DEFAULT_PRESETS
            this.renderPage()
          }
        })
        .catch(err => {
          logger.error('Failed to load favorite colors:', err)
          this.state.favoriteColors = DEFAULT_PRESETS
          this.renderPage()
        })
    },

    addCurrentColorToFavorites() {
      const light = this.state.light
      let newFavorite = { bri: light.bri }

      if (light.colormode === 'hs' && (light.sat > 0 || light.hue > 0)){
        newFavorite.type = PRESET_TYPES.COLOR
        newFavorite.hue = light.hue || 0
        newFavorite.sat = light.sat || 0
        newFavorite.hex = normalizeHex(light.hex) || '#FF0000'
      } else if (light.colormode === 'ct' && light.ct > 0){
        newFavorite.type = PRESET_TYPES.CT
        newFavorite.ct = light.ct
        newFavorite.hex = ct2hexString(light.ct) || '#FFFFFF'
      } else {
        newFavorite.type = PRESET_TYPES.WHITE
        newFavorite.hex = '#FFFFFF'
      }
      newFavorite.bri = light.bri || 254;

      this.request({
          method: 'ADD_FAVORITE_COLOR',
          params: { colorData: newFavorite }
        })
        .then(result => {
          if (result.success) {
            this.loadFavoriteColors()
          }
        })
        .catch(err => {
          logger.error('Failed to add favorite color:', err)
        })
    },

    goBack() {
      if (this.currentModal) {
        this.currentModal.show(false)
        this.currentModal = null
      }
      // Rimuovi esplicitamente il listener di gesture prima di uscire
      if (this.exitGestureListener) this.exitGestureListener();
      back()
    },

    onDestroy() {
      if (this.exitGestureListener) this.exitGestureListener();
      this.clearAllWidgets()
    }
  })
)