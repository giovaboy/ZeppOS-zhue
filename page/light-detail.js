import { BasePage } from '@zeppos/zml/base-page'
import { px } from '@zos/utils'
import { setPageBrightTime } from '@zos/display'
import { setScrollLock } from '@zos/page'
import { getText } from '@zos/i18n'
import { getLogger } from '../utils/logger.js'
import { createWidget, deleteWidget, widget, align, prop, text_style, event } from '@zos/ui'
import { back } from '@zos/router'

const logger = getLogger('hue-light-detail-page')

const COLORS = {
  background: 0x000000,
  text: 0xffffff,
  highlight: 0x0055ff,
  success: 0x00aa00,
  error: 0xff0000,
  inactive: 0x666666,
  sliderBg: 0x2a2a2a,
  sliderFill: 0x0088ff,
  cardBg: 0x222222, // Added for the color picker background
}

// Colori preferiti per ogni luce (salvabili in storage)
const DEFAULT_PRESETS = [
    // Preset 1: Arancione (Caldo) - Richiede colore
  { hex: '#FFA500', bri: 200, hue: 8000, sat: 200, isColor: true },
  // Preset 2: Blu Cielo (Freddo) - Richiede colore
  { hex: '#87CEEB', bri: 220, hue: 32000, sat: 150, isColor: true },
  // Preset 3: Rosso Intenso - Richiede colore
  { hex: '#FF6B6B', bri: 180, hue: 0, sat: 254, isColor: true },
  // NUOVO: Bianco Luminoso/Neutro (ct medio-basso = luce neutra)
  { hex: '#FFFFFF', bri: 254, ct: 250, isColor: false }, // ct=250 (circa 4000K)
  // NUOVO: Bianco Caldo (ct alto = luce calda)
  { hex: '#F0EAD6', bri: 200, ct: 450, isColor: false }, // ct=450 (circa 2222K)
  // Preset 5: Viola Scuro - Richiede colore
  { hex: '#4A148C', bri: 100, hue: 48000, sat: 254, isColor: true }
]

// UTILITY: HSB (Hue 0-360, Sat 0-100, Brightness 0-100) a Hex (0xRRGGBB)
function hsb2hex(h, s, v) {
    if (s === 0) {
        const val = Math.round(v * 2.55)
        return val << 16 | val << 8 | val; // Ritorna grigio
    }
    h /= 60;
    s /= 100;
    v /= 100;

    const i = Math.floor(h);
    const f = h - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r = 0, g = 0, b = 0;

    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }

    const toInt = (c) => Math.round(c * 255);
    return (toInt(r) << 16) + (toInt(g) << 8) + toInt(b);
}

// Costanti per i range della API Hue
const HUE_RANGE = 65535; // Hue range per Philips Hue
const SAT_RANGE = 254;   // Saturation range per Philips Hue

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
      dragStartPoint: null,
      dragStartBri: 0,
      brightnessSliderWidget: null,
      brightnessSliderFillWidget: null,
      brightnessLabel: null,
      // Stato Color Picker
      tempHue: 0,
      tempSat: 0,
      ct: 0,
      isDraggingColor: false,
      colorCursorWidget: null,
    },

    widgets: [],
    sliderX: px(40),    // Posizione X di partenza della traccia
    sliderW: px(400),   // Larghezza totale della traccia
    sliderH: px(60),    // Altezza del contenitore (per il posizionamento)
    handleSize: px(40), // Dimensione maniglia (non usata ma utile per l'altezza del container)
    colorPickerX: px(40),
    colorPickerSize: px(400),

    onInit(p) {
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
      logger.debug('Light detail page onInit')
      this.state.lightId = params?.lightId
      this.state.lightName = params?.lightName || 'Light'

      // Load favorite colors from storage if available
      this.loadFavoriteColors()

      /*onGesture({
          callback: (event) => {
              if (event === GESTURE_RIGHT) {
                  this.goBack()
              }
          }
      })*/
    },

    build() {
      logger.log('Building Light Detail page')
      setPageBrightTime({ brightTime: 60000 })
      setScrollLock({ lock: false })
      this.loadLightDetail()
    },

    clearAllWidgets() {
      this.widgets.forEach(w => {
        try { deleteWidget(w) } catch (e) { }
      })
      this.widgets = []
      this.state.brightnessSliderWidget = null
      this.state.brightnessSliderFillWidget = null
      this.state.brightnessLabel = null
      this.state.colorCursorWidget = null
    },

    createTrackedWidget(type, props) {
      const w = createWidget(type, props)
      this.widgets.push(w)
      return w
    },

    loadFavoriteColors() {
      // TODO: Load from persistent storage
      logger.log('Loading favorite colors (using defaults)')
    },

    // Migliorata la logica per le capacità basata sulle proprietà Hue
    getLightCapabilities(light) {
      logger.log(light.capabilities);
      const type = light.type || '';

      // Assumiamo che tutte le luci dimmerabili e a colore supportino la luminosità
      let caps = ['brightness'];

      // Una logica semplificata per il colore, basata sul nome del tipo di luce Hue.
      if (light.capabilities.includes('color') || type.includes('Color')) {
        caps.push('color');
      }


      logger.log('Light caps:', caps.join(', '));
      return caps;
    },

    loadLightDetail() {
      this.state.isLoading = true
      this.renderLoadingState()

      // ✅ LOG: Verifica lightId
      logger.log('Loading light detail for ID:', this.state.lightId)
      
      if (!this.state.lightId) {
        logger.error('Missing lightId!')
        this.renderErrorState('Light ID is missing')
        return
      }

      this.request({
        method: 'GET_LIGHT_DETAIL',
        params: { lightId: this.state.lightId }
      })
        .then(result => {
          logger.debug('Light detail response:', JSON.stringify(result))

          if (result.success) {
            this.state.light = result.data.light
            this.state.tempBrightness = this.state.light.bri || 0
            // Inizializza tempHue/Sat
            this.state.tempHue = this.state.light.hue || 0
            this.state.tempSat = this.state.light.sat || 0
            this.state.ct = this.state.light.ct || 0
            this.state.isLoading = false
            this.renderPage()
          } else {
            logger.error('Light detail failed:', result.error || 'No error message')
            this.renderErrorState(result.error || 'Failed to load light details')
          }
        })
        .catch(err => {
          logger.error('Load light detail error:', err)
          const errorMsg = err?.message || err?.error || 'Unknown error loading light'
          this.renderErrorState(errorMsg)
        })
    },

    renderLoadingState() {
      this.clearAllWidgets()

      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: px(480), h: px(480),
        color: COLORS.background
      })

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(200), w: px(480), h: px(50),
        text: getText('LOADING'),
        text_size: px(30),
        color: COLORS.text,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })
    },

    renderErrorState(errorMsg) {
      this.clearAllWidgets()

      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: px(480), h: px(480),
        color: COLORS.background
      })

      this.createTrackedWidget(widget.TEXT, {
        x: px(40), y: px(180), w: px(400), h: px(100),
        text: getText('ERROR_MSG', errorMsg),
        text_size: px(26),
        color: COLORS.error,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP
      })

      this.createTrackedWidget(widget.BUTTON, {
        x: px(140), y: px(320), w: px(200), h: px(60),
        text: getText('BACK'),
        text_size: px(26),
        normal_color: COLORS.highlight,
        press_color: COLORS.success,
        radius: 10,
        click_func: () => this.goBack()
      })
    },


    renderPage() {
      this.clearAllWidgets()

      const light = this.state.light
      if (!light) return

      const lightOn = !!light.ison;
      const capabilities = this.getLightCapabilities(light);

      logger.debug('Light capabilities:', capabilities.join(','));

      // Background with light color if on
      const bgColor = lightOn && light.hex ? this.getLightBgColor(light.hex) : COLORS.background

      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: px(480), h: px(480),
        color: bgColor
      })

      // Header
      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(20), w: px(480), h: px(50),
        text: this.state.lightName,
        text_size: px(32),
        color: COLORS.text,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      let currentY = px(80)

      // Main toggle
      currentY = this.renderMainToggle(currentY)

      // Brightness slider (if light is on and supports brightness)
      if (lightOn && capabilities.includes('brightness')) {
        currentY = this.renderBrightnessSlider(currentY)
      }

      // Color picker (if light supports color)
      if (lightOn && capabilities.includes('color')) {
        currentY = this.renderColorPicker(currentY)
      }

      // Favorite colors
      if (lightOn) {// && capabilities.includes('color')) {
        currentY = this.renderPresets(currentY)
      }
    },

    renderMainToggle(yPos) {
      const light = this.state.light
      const lightOn = !!light.ison;
      const toggleColor = lightOn ? COLORS.success : COLORS.error

      this.createTrackedWidget(widget.BUTTON, {
        x: px(60), y: yPos, w: px(360), h: px(60),
        text: lightOn ? getText('LIGHT_ON') : getText('LIGHT_OFF'),
        normal_color: toggleColor,
        press_color: 0x33ffffff,
        radius: 12,
        click_func: () => this.toggleLight()
      })

      return yPos + px(80)
    },

    renderBrightnessSlider(yPos) {
      const light = this.state.light
      // Usa la luminosità temporanea se stiamo trascinando, altrimenti l'attuale
      const brightness = this.state.isDraggingBrightness ? this.state.tempBrightness : light.bri
      const brightnessPercent = Math.round(brightness / 254 * 100)

      const sliderY = yPos + px(40)
      const trackHeight = px(20)

      // Variabili locali dal this.
      const localSliderX = this.sliderX
      const localSliderW = this.sliderW
      const localSliderH = this.sliderH
      const localHandleSize = this.handleSize

      // Calcola la posizione iniziale del riempimento e della maniglia
      const initialBriPosition = Math.round(localSliderW * brightness / 254)

      // 1. Label
      const brightnessLabel = this.createTrackedWidget(widget.TEXT, {
        x: localSliderX, y: yPos, w: localSliderW, h: px(35),
        text: getText('BRIGHTNESS', brightnessPercent),
        text_size: px(26),
        color: COLORS.text,
        align_h: align.LEFT,
        align_v: align.CENTER_V
      })

      this.state.brightnessLabel = brightnessLabel;
      const trackCenterY = sliderY + (localSliderH / 2)

      // 2. Slider background (Traccia statica)
      this.createTrackedWidget(widget.FILL_RECT, {
        x: localSliderX, y: trackCenterY - (trackHeight / 2),
        w: localSliderW, h: trackHeight,
        color: COLORS.sliderBg,
        radius: trackHeight / 2
      })

      // 3. Slider fill (Riempimento che si muove)
      const sliderFillWidget = this.createTrackedWidget(widget.FILL_RECT, {
        x: localSliderX, y: trackCenterY - (trackHeight / 2),
        w: initialBriPosition, h: trackHeight,
        color: COLORS.sliderFill,
        radius: trackHeight / 2
      })
      this.state.brightnessSliderFillWidget = sliderFillWidget;

      // 4. Hitbox per il Tap-to-Set/Drag
      const trackHitbox = this.createTrackedWidget(widget.FILL_RECT, {
        x: localSliderX,
        y: sliderY,
        w: localSliderW,
        h: localSliderH, // Area di tocco allargata
        color: 0x000000,
        alpha: 0 // Completamente trasparente
      })

      // FUNZIONE per calcolare la luminosità in base alla posizione X
      const getBrightnessFromX = (x) => {
          let positionInTrack = x - localSliderX;
          positionInTrack = Math.max(0, Math.min(positionInTrack, localSliderW));

          let newBrightness = Math.round((positionInTrack / localSliderW) * 254);
          // Assicurati che sia almeno 1 se la luce è accesa
          return Math.max(light.ison ? 1 : 0, newBrightness);
      }

      // CLICK_DOWN: Inizializza il trascinamento e gestisce il "tap to set"
      trackHitbox.addEventListener(event.CLICK_DOWN, (info) => {
        logger.log('*** BRIGHTNESS CLICK_DOWN: Tap/Inizio drag. ***')
        setScrollLock({lock: true})

        const newBrightness = getBrightnessFromX(info.x)

        this.state.isDraggingBrightness = true
        // Usiamo tempBrightness come punto di riferimento per il tap-to-set
        this.state.tempBrightness = newBrightness

        // Aggiorna immediatamente l'UI al tap
        this.setBrightness(newBrightness, true)
      })

      // MOVE: Aggiorna l'UI in tempo reale (Dragging) usando la posizione assoluta X
      trackHitbox.addEventListener(event.MOVE, (info) => {
          if (!this.state.isDraggingBrightness) return

          const newBrightness = getBrightnessFromX(info.x)
          this.state.tempBrightness = newBrightness

          const newBriPosition = Math.max(0, Math.round(localSliderW * newBrightness / 254))
          const newPercent = Math.round(newBrightness / 254 * 100)

          if (this.state.brightnessSliderFillWidget && this.state.brightnessLabel) {
              this.state.brightnessSliderFillWidget.setProperty(prop.W, newBriPosition)
              this.state.brightnessLabel.setProperty(prop.TEXT, getText('BRIGHTNESS', newPercent))
          }
      })

      // CLICK_UP: Fine del trascinamento, invia il comando API
      trackHitbox.addEventListener(event.CLICK_UP, () => {
          if (!this.state.isDraggingBrightness) return

          logger.log('Slider UP. End drag. Setting final brightness:', this.state.tempBrightness)
          setScrollLock({lock: false})

          // Invia il comando API se il valore finale è diverso dal valore API iniziale (light.bri)
          if (this.state.tempBrightness !== light.bri) {
              this.setBrightness(this.state.tempBrightness, false)
          }

          // Resetta lo stato di dragging
          this.state.isDraggingBrightness = false
          this.state.dragStartPoint = null
          this.state.dragStartBri = 0
      })

      return sliderY + localSliderH + px(20)
    },

    renderColorPicker(yPos) {
      const light = this.state.light
      const currentHue = this.state.isDraggingColor ? this.state.tempHue : light.hue || 0
      const currentSat = this.state.isDraggingColor ? this.state.tempSat : light.sat || 0
      const currentBri = this.state.light.bri || 1 // Usa luminosità attuale per il cursore

      const size = this.colorPickerSize
      const x = this.colorPickerX
      const y = yPos + px(40) // Spazio dopo la label
      const cursorSize = px(30) // Dimensione del cursore

      // 1. Label
      this.createTrackedWidget(widget.TEXT, {
        x: x, y: yPos, w: size, h: px(35),
        text: getText('COLOR_PICKER_LABEL'),
        text_size: px(26),
        color: COLORS.text,
        align_h: align.LEFT,
        align_v: align.CENTER_V
      })

      // --- 2. Area Colore Visiva (Simulated Hue Gradient) ---
      const stripCount = 30;
      const stripWidth = size / stripCount;
      const normalizedSat = 100; // Saturazione massima per il gradiente di sfondo
      const normalizedBri = 50;  // Luminosità media per il gradiente di sfondo

      for (let i = 0; i < stripCount; i++) {
        const hueVal = Math.round((i / stripCount) * HUE_RANGE);
        // Conversione Hue (0-65535) -> Hue (0-360)
        const normalizedHue = Math.round(hueVal / HUE_RANGE * 360)

        const colorHex = hsb2hex(normalizedHue, normalizedSat, normalizedBri);

        this.createTrackedWidget(widget.FILL_RECT, {
            x: x + i * stripWidth,
            y: y,
            w: stripWidth + 1, // +1 per overlap per nascondere i gap
            h: size,
            color: colorHex,
            // Applica radius solo se è la prima o l'ultima strip per un effetto arrotondato
            radius: (i === 0 || i === stripCount - 1) ? px(10) : 0
        })
      }

      // Overlay per la saturazione (simula il calo di S sull'asse Y)
      // Questo è molto difficile senza supporto gradiente. Useremo un semplice overlay nero in basso per simulare V/S.
      // Rettangolo per simulare la Sat/Bri: Nero in basso (Bri bassa)

      // 3. Cursore Corrente (Disegnato sopra il gradiente)
      const initialCursorX = x + Math.round((currentHue / HUE_RANGE) * size)
      const initialCursorY = y + Math.round((SAT_RANGE - currentSat) / SAT_RANGE * size) // Y invertito (0 sat in alto)

      const colorCursorWidget = this.createTrackedWidget(widget.FILL_RECT, {
        x: initialCursorX - cursorSize / 2,
        y: initialCursorY - cursorSize / 2,
        w: cursorSize, h: cursorSize,
        color: 0xFFFFFF, // Colore iniziale verrà aggiornato da setHS
        radius: cursorSize / 2,
        line_width: px(3),
        line_color: 0x000000
      })
      this.state.colorCursorWidget = colorCursorWidget

      // Esegui l'aggiornamento iniziale del colore del cursore
      this.setHS(currentHue, currentSat, true)

      // 4. Hitbox (Area interattiva per tocco/drag)
      const hitbox = this.createTrackedWidget(widget.FILL_RECT, {
        x: x, y: y, w: size, h: size,
        color: 0x000000,
        alpha: 0 // Trasparente
      })

      // --- LOGICA DI MAPPATURA ---
      const mapCoordinatesToHS = (coordX, coordY) => {
        let normX = (coordX - x) / size;
        let normY = (coordY - y) / size;

        normX = Math.max(0, Math.min(normX, 1));
        normY = Math.max(0, Math.min(normY, 1));

        // Mappatura X a Hue (0 - 65535)
        const newHue = Math.round(normX * HUE_RANGE);
        // Mappatura Y a Saturation (1 è Sat Min, 0 è Sat Max, Y è invertito)
        const newSat = Math.round((1 - normY) * SAT_RANGE);

        return { hue: newHue, sat: newSat };
      }

      // CLICK_DOWN: Inizializza il drag e gestisce il tap
      hitbox.addEventListener(event.CLICK_DOWN, (info) => {
        setScrollLock({lock: true})
        this.state.isDraggingColor = true

        const { hue, sat } = mapCoordinatesToHS(info.x, info.y);
        this.state.tempHue = hue;
        this.state.tempSat = sat;

        // Aggiorna l'UI del cursore immediatamente e invia il comando API (skipUiUpdate=false)
        this.setHS(hue, sat, false);
      })

      // MOVE: Aggiorna l'UI in tempo reale (Dragging)
      hitbox.addEventListener(event.MOVE, (info) => {
        if (!this.state.isDraggingColor) return

        const { hue, sat } = mapCoordinatesToHS(info.x, info.y);
        this.state.tempHue = hue;
        this.state.tempSat = sat;

        // Aggiorna la posizione del cursore
        const cursorX = x + Math.round((hue / HUE_RANGE) * size) - cursorSize / 2
        const cursorY = y + Math.round((SAT_RANGE - sat) / SAT_RANGE * size) - cursorSize / 2

        if (this.state.colorCursorWidget) {
            this.state.colorCursorWidget.setProperty(prop.X, cursorX)
            this.state.colorCursorWidget.setProperty(prop.Y, cursorY)
            this.setHS(hue, sat, true) // Aggiorna solo il colore del cursore (updateCursorOnly = true)
        }
      })

      // CLICK_UP: Fine del trascinamento
      hitbox.addEventListener(event.CLICK_UP, () => {
        if (!this.state.isDraggingColor) return

        setScrollLock({lock: false})
        this.state.isDraggingColor = false
        logger.log('Color Picker UP.')
      })

      // Ritorna la posizione Y finale
      return y + size + px(20)
    },

   /**
   * Renderizza i colori preferiti in un layout a griglia di bottoni quadrati 50x50.
   * La funzione è progettata per adattarsi alla larghezza del dispositivo.
   * @param {number} yPos La posizione Y di partenza per l'intestazione della sezione.
   * @returns {number} La posizione Y immediatamente successiva all'ultimo elemento renderizzato.
   */
  renderPresets(yPos) {
    // Si assume che DEVICE_WIDTH, px, widget, COLORS, align siano disponibili nello scope della pagina.
    // Usiamo una larghezza tipica per il calcolo.
    const DEVICE_WIDTH = px(480);
    const light = this.state.light

    // ✅ FIX: Calcola isColorLight correttamente
    const capabilities = this.getLightCapabilities(light)
    const isColorLight = capabilities.includes('color')
    // FILTRO CHIAVE: Mostra tutti i preset se la luce è a colori, 
    // altrimenti mostra solo i preset bianchi (isColor: false)
    const visiblePresets = isColorLight
        ? this.state.favoriteColors
        : this.state.favoriteColors.filter(p => p.isColor === false)

    if (visiblePresets.length === 0) {
          logger.debug('No relevant presets to display for this light type.')
          return yPos;
    }

    // --- Configurazione Bottoni ---
    const ITEM_SIZE = px(50); // 50x50
    const ITEM_MARGIN = px(10); // Spazio tra i bottoni
    const START_X = px(20); // Margine sinistro/destro

    // 1. Calcolo del layout a griglia
    const MaxW = DEVICE_WIDTH - (2 * START_X);
    const ITEM_TOTAL_W = ITEM_SIZE + ITEM_MARGIN;
    const COLS = Math.floor(MaxW / ITEM_TOTAL_W);
    
    // Calcolo lo spazio rimanente per centrare meglio il blocco di bottoni
    const totalItemsWidth = COLS * ITEM_TOTAL_W - ITEM_MARGIN;
    const effectiveStartX = START_X + (MaxW - totalItemsWidth) / 2;

    // --- Intestazione e Bottone Aggiungi ---
    this.createTrackedWidget(widget.TEXT, {
        x: START_X, y: yPos, w: DEVICE_WIDTH - 2 * START_X, h: px(35),
        text: getText('PRESETS_TITLE'),
        text_size: px(24),
        color: COLORS.text,
        align_h: align.LEFT,
        align_v: align.CENTER_V
    })
    
    this.createTrackedWidget(widget.BUTTON, {
        x: DEVICE_WIDTH - START_X - px(40), y: yPos, w: px(40), h: px(35),
        text: '+',
        text_size: px(24),
        normal_color: COLORS.highlight,
        press_color: COLORS.success,
        radius: px(6),
        click_func: () => this.addCurrentColorToFavorites()
    })

    let favoritesY = yPos + px(40);
    
    // --- Renderizzazione Griglia Colori ---
    visiblePresets.forEach((fav, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);

        const itemX = effectiveStartX + col * ITEM_TOTAL_W;
        const itemY = favoritesY + row * ITEM_TOTAL_W;

        // Bottone Quadrato (Hitbox)
        this.createTrackedWidget(widget.BUTTON, {
            x: itemX, y: itemY, 
            w: ITEM_SIZE, h: ITEM_SIZE,
            text: '',
            normal_color: parseInt(fav.hex.replace('#', ''), 16),
            press_color: 0x33ffffff,
            radius: px(8),
            click_func: () => this.applyPreset(fav)
        })

    })

    // Calcola e ritorna la posizione Y dopo l'ultima riga
    if (this.state.favoriteColors.length === 0) {
        return favoritesY;
    }
    
    const totalRows = Math.ceil(this.state.favoriteColors.length / COLS);
    return favoritesY + totalRows * ITEM_TOTAL_W;
},

    getLightBgColor(hex) {
      const cleanHex = hex.replace('#', '')
      if (cleanHex === '000000') return COLORS.background

      const color = parseInt(cleanHex, 16)
      // Darken significantly for background (divido per 8 e aggiungo un offset scuro)
      return ((color >> 3) & 0x1f1f1f) + 0x0a0a0a
    },

    toggleLight() {
      const light = this.state.light
      logger.log('Toggle light:', light.name)

      const newState = !light.ison;

      this.request({
        method: 'TOGGLE_LIGHT',
        params: {
          lightId: this.state.lightId,
          state: newState
        }
      })
        .then(result => {
          if (result.success) {
            this.state.light.ison = newState
            this.renderPage()
          }
        })
        .catch(err => logger.error('Toggle light error:', err))
    },

    setBrightness(brightness, skipApiCall = false) {
        this.state.light.bri = brightness

        // Calcola i valori necessari
        const fillWidth = Math.max(0, Math.round(this.sliderW * brightness / 254))
        const brightnessPercent = Math.round(brightness / 254 * 100)

        // Aggiorna l'UI (Fill, Label)
        // Aggiorna la linea blu
        if (this.state.brightnessSliderFillWidget) {
            try {
                this.state.brightnessSliderFillWidget.setProperty(prop.W, fillWidth)
            } catch {
                logger.warn('Failed to update fill widget property.')
            }
        }

        // Aggiorna la label
        if (this.state.brightnessLabel) {
            try {
                this.state.brightnessLabel.setProperty(prop.TEXT, getText('BRIGHTNESS', brightnessPercent))
            } catch {
                logger.warn('Failed to update brightness label property.')
            }
        }


        if (skipApiCall) return

        // Send to bridge
        this.request({
            method: 'SET_BRIGHTNESS',
            params: {
                lightId: this.state.lightId,
                brightness
            }
        })
        .then(() => logger.log('Brightness updated'))
        .catch(err => logger.error('Set brightness error:', err))
    },

    setHS(hue, sat, updateCursorOnly = false) {
      // 1. Aggiorna lo stato interno
      this.state.light.hue = hue
      this.state.light.sat = sat

      // La luminosità (bri) è presa dallo slider, non la modifichiamo qui
      const bri = this.state.light.bri || 1

      // 2. Aggiorna l'UI del cursore (il colore)
      if (this.state.colorCursorWidget) {
          // Normalizza i valori per la funzione hsb2hex (Hue/Sat a 100, Bri a 100)
          const normalizedBri = Math.round(bri / SAT_RANGE * 100)
          const normalizedHue = Math.round(hue / HUE_RANGE * 360)
          const normalizedSat = Math.round(sat / SAT_RANGE * 100)

          const newColor = hsb2hex(normalizedHue, normalizedSat, normalizedBri)
          this.state.colorCursorWidget.setProperty(prop.COLOR, newColor)
      }

      if (updateCursorOnly) return

      // 3. Invia al bridge
      this.request({
          method: 'SET_HS',
          params: {
              lightId: this.state.lightId,
              hue: hue,
              sat: sat,
              bri: bri // Mantiene la luminosità attuale
          }
      })
      .then(() => logger.log('Hue/Saturation updated'))
      .catch(err => logger.error('Set H/S error:', err))
    },

    applyPreset(favorite) {
      logger.log('Apply favorite color:', favorite.name)

      // Aggiorna lo stato per riflettere i nuovi valori Hue/Sat/Bri
      this.state.light.hex = favorite.hex
      this.state.light.bri = favorite.bri
      this.state.light.hue = favorite.hue
      this.state.light.sat = favorite.sat
      this.state.light.ct  = favorite.ct

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
        .then(result => {
          if (result.success) {
            // Ricarica la pagina per aggiornare tutti i widget (slider, cursore, background)
            this.renderPage()
          }
        })
        .catch(err => logger.error('Apply favorite error:', err))
    },

    addCurrentColorToFavorites() {
      const light = this.state.light

      if (!light.hex) {
        // Se hex non è disponibile, prova a calcolarlo dai valori HSB attuali
        const bri = light.bri || 254
        const hue = light.hue || 0
        const sat = light.sat || 0

        const normalizedBri = Math.round(bri / SAT_RANGE * 100)
        const normalizedHue = Math.round(hue / HUE_RANGE * 360)
        const normalizedSat = Math.round(sat / SAT_RANGE * 100)

        const calculatedHex = hsb2hex(normalizedHue, normalizedSat, normalizedBri)
        light.hex = '#' + calculatedHex.toString(16).padStart(6, '0').toUpperCase()
      }

      const newFavorite = {
        hex: light.hex,
        hue: light.hue || 0,
        sat: light.sat || 0,
        bri: light.bri || 254
      }

      this.state.favoriteColors.push(newFavorite)

      // Save to storage
      this.saveFavoriteColors()

      logger.log('Added to favorites:', newFavorite)
      this.renderPage()
    },

    saveFavoriteColors() {
      // TODO: Save to persistent storage
      logger.log('Saving favorite colors (storage not implemented)')
    },

    goBack() {
      logger.log('Go back from light detail')
      back()
    },

    onDestroy() {
      logger.debug('Light detail page onDestroy')
      this.clearAllWidgets()
    }
  })
)