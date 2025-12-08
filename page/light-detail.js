import { BasePage } from '@zeppos/zml/base-page'
import { setPageBrightTime } from '@zos/display'
import { setScrollLock } from '@zos/page'
import { getText } from '@zos/i18n'
import { createWidget, deleteWidget, widget, prop } from '@zos/ui'
import { back, push } from '@zos/router'
import { onGesture, GESTURE_RIGHT } from '@zos/interaction'
import { createModal, MODAL_CONFIRM } from '@zos/interaction'
import { renderLightDetail, LAYOUT_CONFIG } from 'zosLoader:./light-detail.[pf].layout.js'
import { getLogger } from '../utils/logger.js'
import { DEFAULT_PRESETS, PRESET_TYPES, hsb2hex } from '../utils/constants.js'

const logger = getLogger('zhue-light-detail-page')

/**
 * Ritorna la priorità di ordinamento per il tipo di preset.
 * 1: WHITE (prima), 2: CT (seconda), 3: COLOR (terza)
 */
function getPresetTypePriority(type) {
  switch (type) {
    case PRESET_TYPES.WHITE:
      return 1;
    case PRESET_TYPES.CT:
      return 2;
    case PRESET_TYPES.COLOR:
      return 3;
    default:
      return 99;
  }
}

/**
 * Funzione di comparazione per ordinare i preset.
 * Applica la logica: WHITE (per bri) -> CT -> COLOR
 */
function comparePresets(a, b) {
  const priorityA = getPresetTypePriority(a.type);
  const priorityB = getPresetTypePriority(b.type);
  
  // 1. Ordinamento per priorità di Tipo (WHITE < CT < COLOR)
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }
  
  // 2. Ordinamento secondario (se il tipo è lo stesso)
  if (a.type === PRESET_TYPES.WHITE) {
    // Ordina i preset WHITE per luminosità (bri crescente)
    return a.bri - b.bri;
  }
  
  if (a.type === PRESET_TYPES.CT) {
    // Ordina i preset CT per temperatura colore (ct crescente, che di solito va da freddo a caldo)
    return a.ct - b.ct;
  }
  
  if (a.type === PRESET_TYPES.COLOR) {
    // Ordina i preset COLOR per tonalità (hue crescente)
    return a.hue - b.hue;
  }
  
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
      // Brightness logic
      isDraggingBrightness: false,
      tempBrightness: 0,
      brightnessSliderFillWidget: null,
      brightnessLabel: null,
    },
    
    widgets: [],
    currentModal: null,
    
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
      setScrollLock({ lock: false })
      this.loadLightDetail()
    },
    
    // FONDAMENTALE: Quando torni dalla pagina Color Picker, ricarica i dati!
    onResume() {
      logger.log('Resuming Light Detail - Refreshing Data');
      if (this.state.lightId) {
        this.loadFavoriteColors() // Ricarica i preferiti
        this.loadLightDetail(); // Aggiorna stato (colore bottone, slider, etc.)
      }
    },
    
    clearAllWidgets() {
      this.widgets.forEach(w => {
        try { deleteWidget(w) } catch (e) {
          logger.error('Error deleting widget', e);
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
    
    // La funzione di uscita che viene allegata al listener di ZeppOS
    exitOnSwipe(event) {
      if (event === GESTURE_RIGHT) {
        back();
        return true;
      }
      return false;
    },
    
    /** Blocca lo swipe laterale per l'uscita rimuovendo il listener. */
    lockExitGesture() {
      if (this.exitGestureListener) {
        this.exitGestureListener(); // Rimuove il listener
        this.exitGestureListener = null;
        logger.debug('Exit gesture LOCKED');
      }
    },
    
    /** Ripristina lo swipe laterale per l'uscita. */
    unlockExitGesture() {
      if (this.exitGestureListener) {
        this.exitGestureListener(); // Rimuove il precedente se esiste
      }
      // Crea un nuovo listener e salva il suo distruttore (unlistener)
      this.exitGestureListener = onGesture({
        callback: (event) => this.exitOnSwipe(event)
      });
      logger.debug('Exit gesture UNLOCKED');
    },
    
    renderPage() {
      this.clearAllWidgets()
      // *** APPLICA L'ORDINAMENTO RICHIESTO QUI ***
      this.state.favoriteColors.sort(comparePresets);
      
      if (this.state.isLoading && !this.state.light) { // Mostra loading solo se non abbiamo dati
        this.createTrackedWidget(widget.TEXT, { x: 0, y: 200, w: 480, h: 50, text: getText('LOADING'), align_h: widget.ALIGN_CENTER_H || 2 })
        return
      }
      if (!this.state.light) return
      
      const light = this.state.light
      const capabilities = this.getLightCapabilities(light);
      
      // Pre-calcolo Hex se manca (per il bottone UI)
      if (!light.hex) {
        const bri = light.bri || 100;
        // Logica approssimativa: se siamo in modalità colore o se manca CT, usa Hue/Sat
        // Se light.colormode === 'ct', dovremmo convertire mired a hex (omesso per brevità, si usa bianco o hex precedente)
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
    
    // --- LOGIC ---
    
    handleBrightnessDrag(evtType, info) {
      const { sliderX, sliderW } = LAYOUT_CONFIG
      const getBrightnessFromX = (x) => {
        let positionInTrack = x - sliderX;
        positionInTrack = Math.max(0, Math.min(positionInTrack, sliderW));
        return Math.max(this.state.light.ison ? 1 : 0, Math.round((positionInTrack / sliderW) * 254));
      }
      
      if (evtType === 'DOWN') {
        this.lockExitGesture(); // BLOCCA GESTURE
        setScrollLock({ lock: true })
        const newBri = getBrightnessFromX(info.x)
        this.state.isDraggingBrightness = true
        this.state.tempBrightness = newBri
        this.setBrightness(newBri, true)
        // Non facciamo renderPage qui, usiamo solo setProperty nel MOVE
      } else if (evtType === 'MOVE') {
        if (!this.state.isDraggingBrightness) return
        const newBri = getBrightnessFromX(info.x)
        
        // Evita di aggiornare se la luminosità non è cambiata
        if (newBri === this.state.tempBrightness) return
        
        this.state.tempBrightness = newBri
        this.setBrightness(newBri, true) // Aggiorna solo UI (skipApiCall = true)
        
      } else if (evtType === 'UP') {
        if (!this.state.isDraggingBrightness) return
        this.unlockExitGesture(); // SBLOCCA GESTURE
        setScrollLock({ lock: false })
        
        // Invia comando finale solo se è stato diverso
        if (this.state.tempBrightness !== this.state.light.bri) {
          this.setBrightness(this.state.tempBrightness, false) // Invia API Call (skipApiCall = false)
        } else {
          // Se non c'è stato MOVE, ripristina lo stato originale della luce
          this.setBrightness(this.state.light.bri, true)
        }
        
        this.state.isDraggingBrightness = false
      }
    },
    
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
      // Funzione di oscuramento per lo sfondo
      const cleanHex = hex.replace('#', '')
      if (cleanHex === '000000') return 0x000000
      const color = parseInt(cleanHex, 16)
      // Diminuzione della luminosità del colore per lo sfondo
      return ((color >> 3) & 0x1f1f1f) + 0x0a0a0a
    },
    
    loadLightDetail() {
      // Non settiamo isLoading = true qui su refresh per evitare flickering totale
      // Solo se light è null (prima volta)
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
            // Aggiungo un piccolo ritardo per evitare race condition con il reload
            setTimeout(() => this.loadLightDetail(), 100); 
          }
        })
    },
    
    setBrightness(brightness, skipApiCall = false) {
      this.state.light.bri = brightness
      const { sliderW } = LAYOUT_CONFIG
      const fillWidth = Math.max(px(5), Math.round(sliderW * brightness / 254)) // Minimo 5px per visibilità
      const percent = Math.round(brightness / 254 * 100)
      
      // Aggiorna i widget in tempo reale
      if (this.state.brightnessSliderFillWidget)
        this.state.brightnessSliderFillWidget.setProperty(prop.W, fillWidth)
      if (this.state.brightnessLabel)
        this.state.brightnessLabel.setProperty(prop.TEXT, `${percent}%`) // Solo percentuale
      
      if (skipApiCall) return
      
      this.request({
        method: 'SET_BRIGHTNESS',
        params: { lightId: this.state.lightId, brightness }
      })
    },
    
    deletePreset(favorite, index) {
      // Chiude eventuali modal aperti
      if (this.currentModal) {
        this.currentModal.show(false)
        this.currentModal = null
      }
      
      // Crea descrizione personalizzata in base al tipo
      let presetDescription = ''
      if (favorite.type === PRESET_TYPES.COLOR) {
        presetDescription = 'Color preset'
      } else if (favorite.type === PRESET_TYPES.CT) {
        presetDescription = 'White preset'
      } else if (favorite.type === PRESET_TYPES.WHITE) {
        const briPercent = Math.round((favorite.bri || 254) / 254 * 100)
        presetDescription = `Brightness preset (${briPercent}%)`
      }
      
      // Mostra modal di conferma
      const dialog = createModal({
        content: `Delete this preset?\n\n${presetDescription}`,
        autoHide: false,
        onClick: (keyObj) => {
          if (keyObj.type === MODAL_CONFIRM) {
            // Conferma: elimina tramite API
            this.request({
                method: 'REMOVE_FAVORITE_COLOR',
                params: { index: index }
              })
              .then(result => {
                if (result.success) {
                  this.loadFavoriteColors()
                  this.renderPage()
                }
              })
          }
          // Chiudi modal
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
        .then(res => { if (res.success) this.loadLightDetail() }) // Reload per sicurezza
    },
    
    // --- FAVORITE COLORS MANAGEMENT ---
    
    loadFavoriteColors() {
      logger.log('Loading favorite colors...')
      this.request({ method: 'GET_FAVORITE_COLORS' })
        .then(result => {
          if (result.success) {
            this.state.favoriteColors = result.colors || DEFAULT_PRESETS
            logger.log('Favorite colors loaded:', this.state.favoriteColors.length)
            this.renderPage() // Aggiunto renderPage qui per aggiornare i preset subito
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
      const caps = this.getLightCapabilities(light);
      let newFavorite = { bri: light.bri }
      
      // 1. Logica per determinare il PRESET_TYPE
      if (caps.includes('color') && (light.sat > 0 || light.hue > 0)) {
        // A. PRESET_TYPES.COLOR: se la luce supporta il colore ed è attualmente impostata su un colore.
        newFavorite.type = PRESET_TYPES.COLOR
        newFavorite.hue = light.hue || 0
        newFavorite.sat = light.sat || 0
        newFavorite.hex = light.hex || '#FF0000' // Usa l'HEX attuale per il colore
        
      } else if (caps.includes('ct') && light.ct > 0) {
        // B. PRESET_TYPES.CT: se la luce supporta CT ed è attualmente impostata su una temperatura colore.
        newFavorite.type = PRESET_TYPES.CT
        newFavorite.ct = light.ct
        newFavorite.hex = light.hex || '#FFFFFF' // Usa l'HEX attuale (che sarà un bianco)
        
      } else {
        // C. PRESET_TYPES.WHITE: è solo luminosità (bri), la scelta più sicura per il minimo comune denominatore.
        newFavorite.type = PRESET_TYPES.WHITE
        
        // Seguiamo la tua indicazione: forziamo HEX a #FFFFFF per i preset BRI-only in storage
        // (anche se la UI potrebbe mostrarlo diversamente a seconda del bri, come grigio scuro)
        newFavorite.hex = '#FFFFFF'
      }
      
      // La proprietà BRI è sempre inclusa
      newFavorite.bri = light.bri || 254;
      
      logger.log('Adding color to favorites:', newFavorite)
      
      this.request({
          method: 'ADD_FAVORITE_COLOR',
          params: { colorData: newFavorite }
        })
        .then(result => {
          if (result.success) {
            logger.log('Color added to favorites')
            this.loadFavoriteColors() // Ricarica per aggiornare UI
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
      back()
    },
    onDestroy() {
      if (this.currentModal) {
        this.currentModal.show(false)
        this.currentModal = null
      }
      this.clearAllWidgets()
    }
  })
)