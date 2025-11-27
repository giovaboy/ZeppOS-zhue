import { BasePage } from '@zeppos/zml/base-page'
import { px } from '@zos/utils'
import { onGesture, GESTURE_RIGHT } from '@zos/interaction'
import { setPageBrightTime } from '@zos/display'
import { setScrollLock } from '@zos/page'
import { getText } from '@zos/i18n'
import { getLogger } from '../utils/logger.js'
import { createWidget, deleteWidget, widget, align, prop, text_style, event } from '@zos/ui'

const logger = getLogger('hue-light-detail-page')

const COLORS = {
  background: 0x000000,
  text: 0xffffff,
  highlight: 0x0055ff,
  success: 0x00aa00,
  error: 0xff0000,
  inactive: 0x666666,
  sliderBg: 0x2a2a2a,
  sliderFill: 0x0088ff
}

// Colori preferiti per ogni luce (salvabili in storage)
const DEFAULT_FAVORITE_COLORS = [
  { name: 'Warm', hex: '#FFA500', hue: 8000, sat: 200, bri: 200 },
  { name: 'Cool', hex: '#87CEEB', hue: 32000, sat: 150, bri: 220 },
  { name: 'Relax', hex: '#FF6B6B', hue: 0, sat: 254, bri: 180 },
  { name: 'Focus', hex: '#FFFFFF', hue: 0, sat: 0, bri: 254 },
  { name: 'Night', hex: '#4A148C', hue: 48000, sat: 254, bri: 100 }
]

Page(
  BasePage({
    state: {
      lightId: null,
      lightName: '',
      light: null,
      isLoading: false,
      favoriteColors: [...DEFAULT_FAVORITE_COLORS],
      isDraggingBrightness: false,
      tempBrightness: 0,
      dragStartPoint: null, // Posizione X/Y del dito al CLICK_DOWN (ORA in state)
      dragStartBri: 0, // Luminosità iniziale al CLICK_DOWN (ORA in state)
      brightnessSliderWidget: null,
      brightnessSliderFillWidget: null,
      brightnessLabel: null,
    },

    widgets: [],
    sliderX: px(40), // Posizione X di partenza della traccia
    sliderW: px(400), // Larghezza totale della traccia
    sliderH: px(40), // Altezza del contenitore (per il posizionamento)
    handleSize: px(30), // Dimensione della maniglia

    onInit(p) {
      let params = {}
      if (typeof p === 'string' && p.startsWith('{')) {
        // Se riceviamo una stringa JSON (il nostro fix)
        try {
          params = JSON.parse(p)
        } catch (e) {
          logger.error('Failed to parse params string:', e)
        }
      } else if (typeof p === 'object' && p !== null) {
        // Se riceviamo un oggetto diretto (il comportamento di default)
        params = p
      }
      logger.debug('Light detail page onInit')
      this.state.lightId = params?.lightId
      this.state.lightName = params?.lightName || 'Light'

      // Load favorite colors from storage if available
      this.loadFavoriteColors()
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
    },

    createTrackedWidget(type, props) {
      const w = createWidget(type, props)
      this.widgets.push(w)
      return w
    },

    loadFavoriteColors() {
      // TODO: Load from persistent storage
      // For now, use defaults
      logger.log('Loading favorite colors (using defaults)')
    },

    getLightCapabilities(light) {
      logger.log(light.capabilities);
      const type = light.type || '';

      // Assumiamo che tutte le luci dimmerabili e a colore supportino la luminosità
      let caps = ['brightness'];

      // Una logica semplificata per il colore, basata sul nome del tipo di luce Hue.
      if (light.capabilities.includes('color') || type.includes('Color')) {
        caps.push('color');
      }

      // Qui potresti aggiungere anche logiche basate su light.modelid

      return caps;
    },

    loadLightDetail() {
      this.state.isLoading = true
      this.renderLoadingState()

      this.request({
        method: 'GET_LIGHT_DETAIL',
        params: { lightId: this.state.lightId }
      })
        .then(result => {
          logger.log('Light detail received:', result)

          if (result.success) {
            this.state.light = result.data.light
            this.state.tempBrightness = this.state.light.bri || 0
            this.state.isLoading = false
            this.renderPage()
          } else {
            this.renderErrorState('Failed to load light details')
          }
        })
        .catch(err => {
          logger.error('Load light detail error:', err)
          this.renderErrorState(err.message)
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
        text: 'Loading...',
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
        text: errorMsg,
        text_size: px(26),
        color: COLORS.error,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP
      })

      this.createTrackedWidget(widget.BUTTON, {
        x: px(140), y: px(320), w: px(200), h: px(60),
        text: 'BACK',
        text_size: px(26),
        normal_color: COLORS.highlight,
        press_color: COLORS.success,
        radius: 10,
        click_func: () => this.goBack()
      })
    },


    renderPage() {
      this.clearAllWidgets()

      // Back button
      /*this.createTrackedWidget(widget.BUTTON, {
        x: px(410), y: px(20), w: px(50), h: px(50),
        text: '←',
        text_size: px(32),
        normal_color: COLORS.highlight,
        press_color: COLORS.success,
        radius: 8,
        click_func: () => this.goBack()
      })*/

      const light = this.state.light
      if (!light) return

      const lightOn = !!light.ison;
      const capabilities = this.getLightCapabilities(light); // Usa il nuovo helper

      logger.debug(capabilities);

      // Background with light color if on
      // *** FIX: Usa lightOn ***
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
      // *** FIX: Usa lightOn e le nuove capabilities ***
      if (lightOn && capabilities.includes('brightness')) {
        currentY = this.renderBrightnessSlider(currentY)
      }

      // Color picker (if light supports color)
      // *** FIX: Usa lightOn e le nuove capabilities ***
      if (lightOn && capabilities.includes('color')) {
        currentY = this.renderColorPicker(currentY)
      }

      // Favorite colors
      // *** FIX: Usa lightOn e le nuove capabilities ***
      if (lightOn && capabilities.includes('color')) {
        currentY = this.renderFavoriteColors(currentY)
      }
    },

    renderMainToggle(yPos) {
      const light = this.state.light
      const lightOn = !!light.ison; // *** FIX: Usa light.ison ***
      const toggleColor = lightOn ? COLORS.success : COLORS.error // *** FIX: Usa lightOn ***

      /*  this.createTrackedWidget(widget.FILL_RECT, {
          x: px(60), y: yPos, w: px(360), h: px(60),
          color: toggleColor,
          radius: px(12)
        })

        this.createTrackedWidget(widget.TEXT, {
          x: px(40), y: yPos, w: px(400), h: px(80),
          text: lightOn ? 'LIGHT ON' : 'LIGHT OFF', // *** FIX: Usa lightOn ***
          text_size: px(36),
          color: 0xffffff,
          align_h: align.CENTER_H,
          align_v: align.CENTER_V
        })*/

      this.createTrackedWidget(widget.BUTTON, {
        x: px(60), y: yPos, w: px(360), h: px(60),
        text: getText('LIGHT_TOGGLE'),
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
      const trackHeight = px(8) // Altezza della linea di riempimento
      
      // Costanti geometriche locali (assicurati che siano inizializzate in onInit!)
      const localSliderX = this.sliderX
      const localSliderW = this.sliderW
      const localSliderH = this.sliderH 
      const localHandleSize = this.handleSize
      
      // Calcola la posizione iniziale del riempimento e della maniglia
      const initialBriPosition = Math.round(localSliderW * brightness / 254)
      const initialHandleX = localSliderX + initialBriPosition - (localHandleSize / 2)

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

      // 2. Slider background (Traccia statica)
      const trackedWidget = this.createTrackedWidget(widget.FILL_RECT, {
        x: localSliderX, y: sliderY + (localSliderH / 2) - (trackHeight / 2), 
        w: localSliderW, h: trackHeight,
        color: COLORS.sliderBg,
        radius: trackHeight / 2
      })

      this.brightnessTrackedWidget = trackedWidget;

      // 3. Slider fill (Riempimento che si muove)
      const sliderFillWidget = this.createTrackedWidget(widget.FILL_RECT, {
        x: localSliderX, y: sliderY + (localSliderH / 2) - (trackHeight / 2), 
        w: initialBriPosition, h: trackHeight,
        color: COLORS.sliderFill,
        radius: trackHeight / 2
      })

      this.state.brightnessSliderFillWidget = sliderFillWidget;
      
      // 4. Slider Handle (Maniglia Interattiva)
      // USA VARIABILE LOCALE per garantire che non sia null durante addEventListener
      const handleWidget = this.createTrackedWidget(widget.FILL_RECT, {
        x: initialHandleX, 
        y: sliderY + (localSliderH / 2) - (localHandleSize / 2), 
        w: localHandleSize, 
        h: localHandleSize, 
        color: COLORS.text, 
        radius: localHandleSize / 2, 
      })

      // Assegna alla proprietà della pagina DOPO la creazione del widget locale
      this.state.brightnessSliderWidget = handleWidget;
      
      // Se handleWidget è nullo (fallimento della creazione), usciamo subito.
      if (!handleWidget) {
          logger.error('CRITICAL: Widget Handle is NULL. Aborting event attachment.');
          return sliderY + localSliderH + px(70);
      }
      
      logger.log('Slider Handle created and ready. Attaching listeners to local variable.')

      // --- GESTIONE EVENTI DRAG (USIAMO handleWidget) ---

      // CLICK_DOWN: Inizializza il trascinamento
      handleWidget.addEventListener(event.CLICK_DOWN, (info) => { // <-- USA handleWidget
          logger.log('*** CLICK_DOWN CATTURATO. Inizio drag. ***') 
          setScrollLock({lock: true})
          onGesture({
            callback: (event) => {
              if (event === GESTURE_RIGHT) {
                console.log('right gesture detected');
              }
              return true
            },
          })
          
          const currentBri = light.bri > 0 ? light.bri : 1 
          
         this.state.isDraggingBrightness = true
          this.state.dragStartPoint = { x: info.x, y: info.y }
          logger.log('Info Point set:', info.x, info.y) // <--- NUOVO LOG
          logger.log('Drag Start Point set:', this.state.dragStartPoint.x, this.state.dragStartPoint.y) // <--- NUOVO LOG
          this.state.dragStartBri = currentBri
          this.state.tempBrightness = currentBri
      })

      // MOVE: Aggiorna l'UI in tempo reale
      handleWidget.addEventListener(event.MOVE, (info) => { // <-- USA handleWidget
          logger.log('MOVE event. isDragging:', this.state.isDraggingBrightness)

          // !!! CONTROLLO CRITICO: usciamo se la bandiera è falsa O se il punto di partenza è stato azzerato
          if (!this.state.isDraggingBrightness || !this.state.dragStartPoint) return 

          // Questa riga non crasherà più se this.state.dragStartPoint non è null
          const deltaX = info.x - this.state.dragStartPoint.x;
          
          const initialBriPos = (this.state.dragStartBri / 254) * localSliderW
          let newBriPosition = initialBriPos + deltaX;

          newBriPosition = Math.max(0, Math.min(newBriPosition, localSliderW));
          
          let newBrightness = Math.round((newBriPosition / localSliderW) * 254);
          newBrightness = Math.max(light.ison ? 1 : 0, newBrightness); 

          this.state.tempBrightness = newBrightness
          
          const newHandleX = localSliderX + newBriPosition - (localHandleSize / 2)
          const newPercent = Math.round(newBrightness / 254 * 100)
          
          // Aggiorna l'UI (Handle, Fill, Label)
          this.state.brightnessSliderWidget.setProperty(prop.X, newHandleX) // <-- Qui usiamo this.state.brightnessSliderWidget
          this.state.brightnessSliderFillWidget.setProperty(prop.W, newBriPosition)
          this.state.brightnessLabel.setProperty(prop.TEXT, getText('BRIGHTNESS', newPercent))
      })

      // CLICK_UP: Fine del trascinamento, invia il comando API
      handleWidget.addEventListener(event.CLICK_UP, () => { // <-- USA handleWidget
          if (!this.state.isDraggingBrightness) return
          
          logger.log('Slider UP. End drag. Setting final brightness:', this.state.tempBrightness)
          setScrollLock({lock: false}) // Sblocca lo scroll

          onGesture({
            callback: (event) => {
              if (event === GESTURE_RIGHT) {
                console.log('right gesture detected');
              }
              return false
            },
          })

          // Resetta lo stato di dragging
          this.state.isDraggingBrightness = false
          this.state.dragStartPoint = null
          this.state.dragStartBri = 0
          
          // Invia il comando API solo se il valore è cambiato
          if (this.state.tempBrightness !== light.bri) {
              this.setBrightness(this.state.tempBrightness, true) 
          }
      })
      // Brightness adjustment buttons (+/-) - Mantenuti
      const btnY = sliderY + localSliderH + px(15) // Adjust position

      this.createTrackedWidget(widget.BUTTON, {
        x: px(40), y: btnY, w: px(80), h: px(50),
        text: '−',
        text_size: px(40),
        normal_color: COLORS.inactive,
        press_color: COLORS.highlight,
        radius: 8,
        click_func: () => {
          this.adjustBrightness(-25)}
      })

      this.createTrackedWidget(widget.BUTTON, {
        x: px(360), y: btnY, w: px(80), h: px(50),
        text: '+',
        text_size: px(40),
        normal_color: COLORS.inactive,
        press_color: COLORS.highlight,
        radius: 8,
        click_func: () => this.adjustBrightness(25)
      })

      return btnY + px(70)
    },

    renderColorPicker(yPos) {
      // Section header
      this.createTrackedWidget(widget.TEXT, {
        x: px(40), y: yPos, w: px(400), h: px(35),
        text: 'Quick Colors',
        text_size: px(24),
        color: COLORS.text,
        align_h: align.LEFT,
        align_v: align.CENTER_V
      })

      const colorsY = yPos + px(40)
      const basicColors = [
        { name: 'Red', hex: '#FF0000' },
        { name: 'Green', hex: '#00FF00' },
        { name: 'Blue', hex: '#0000FF' },
        { name: 'Yellow', hex: '#FFFF00' },
        { name: 'Purple', hex: '#FF00FF' }
      ]

      const colorSize = px(70)
      const spacing = px(10)
      const startX = px(40)

      basicColors.forEach((color, i) => {
        const x = startX + i * (colorSize + spacing)

        /*this.createTrackedWidget(widget.FILL_RECT, {
          x, y: colorsY, w: colorSize, h: colorSize,
          color: parseInt(color.hex.replace('#', ''), 16),
          radius: px(8)
        })*/

        this.createTrackedWidget(widget.BUTTON, {
          x, y: colorsY, w: colorSize, h: colorSize,
          text: '',
          normal_color: parseInt(color.hex.replace('#', ''), 16),
          press_color: 0x44ffffff,
          radius: 8,
          click_func: () => this.setLightColor(color.hex)
        })
      })

      return colorsY + colorSize + px(20)
    },

    renderFavoriteColors(yPos) {
      // Section header
      this.createTrackedWidget(widget.TEXT, {
        x: px(40), y: yPos, w: px(350), h: px(35),
        text: 'Favorite Colors',
        text_size: px(24),
        color: COLORS.text,
        align_h: align.LEFT,
        align_v: align.CENTER_V
      })

      // Add favorite button (placeholder)
      this.createTrackedWidget(widget.BUTTON, {
        x: px(400), y: yPos, w: px(40), h: px(35),
        text: '+',
        text_size: px(24),
        normal_color: COLORS.highlight,
        press_color: COLORS.success,
        radius: px(6),
        click_func: () => this.addCurrentColorToFavorites()
      })

      const favoritesY = yPos + px(40)
      const itemHeight = px(50)

      // Show first 3 favorite colors
      const visibleFavorites = this.state.favoriteColors.slice(0, 3)

      visibleFavorites.forEach((fav, i) => {
        const itemY = favoritesY + i * (itemHeight + px(8))

        this.createTrackedWidget(widget.FILL_RECT, {
          x: px(40), y: itemY, w: px(400), h: itemHeight,
          color: COLORS.sliderBg,
          radius: px(8)
        })

        // Color preview circle
        this.createTrackedWidget(widget.CIRCLE, {
          center_x: px(70),
          center_y: itemY + px(25),
          radius: px(18),
          color: parseInt(fav.hex.replace('#', ''), 16)
        })

        /*this.createTrackedWidget(widget.TEXT, {
          x: px(100), y: itemY, w: px(300), h: itemHeight,
          text: fav.name,
          text_size: px(22),
          color: COLORS.text,
          align_h: align.LEFT,
          align_v: align.CENTER_V
        })*/

        this.createTrackedWidget(widget.BUTTON, {
          x: px(40), y: itemY, w: px(400), h: itemHeight,
          text: fav.name,
          normal_color: parseInt(fav.hex.replace('#', ''), 16),
          press_color: 0x33ffffff,
          radius: 8,
          click_func: () => this.applyFavoriteColor(fav)
        })
      })

      return favoritesY + visibleFavorites.length * (itemHeight + px(8))
    },

    getLightBgColor(hex) {
      const cleanHex = hex.replace('#', '')
      if (cleanHex === '000000') return COLORS.background

      const color = parseInt(cleanHex, 16)
      // Darken significantly for background
      return ((color >> 3) & 0x1f1f1f) + 0x0a0a0a
    },

    // Nel file light-detail.js (Sostituire toggleLight)

    toggleLight() {
      const light = this.state.light
      logger.log('Toggle light:', light.name)

      const newState = !light.ison; // *** FIX: Legge light.ison ***

      this.request({
        method: 'TOGGLE_LIGHT',
        params: {
          lightId: this.state.lightId,
          state: newState // *** FIX: Invia newState ***
        }
      })
        .then(result => {
          if (result.success) {
            light.ison = newState // *** FIX: Aggiorna light.ison ***
            this.renderPage()
          }
        })
        .catch(err => logger.error('Toggle light error:', err))
    },

    adjustBrightness(delta) {
      const light = this.state.light
      const newBrightness = Math.max(1, Math.min(254, light.bri + delta))

      logger.log(`Adjust brightness: ${light.bri} -> ${newBrightness}`)

      this.setBrightness(newBrightness)
    },

    // SOSTITUISCI QUESTA FUNZIONE in light-detail.js

    setBrightness(brightness, skipUiUpdate = false) {
      this.state.light.bri = brightness

      // Calcola i valori necessari
      const fillWidth = Math.max(px(10), Math.round(this.sliderW * brightness / 254))
      const brightnessPercent = Math.round(brightness / 254 * 100)
      const handleX = this.sliderX + fillWidth - (this.handleSize / 2) // NEW: Posizione maniglia centrata

      // Aggiorna l'UI solo se non è un aggiornamento proveniente dalla fine del drag
      if (!skipUiUpdate) {
        if (this.state.brightnessSliderFillWidget) {
          try {
            this.state.brightnessSliderFillWidget.setProperty(prop.W, fillWidth)
            // NEW: Aggiorna la posizione della maniglia
            if (this.state.brightnessSliderWidget) {
              this.state.brightnessSliderWidget.setProperty(prop.X, handleX)
            }
          } catch { }
        }

        if (this.state.brightnessLabel) {
          try {
            this.state.brightnessLabel.setProperty(prop.TEXT, getText('BRIGHTNESS', brightnessPercent))
          } catch { }
        }
      }

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
    setLightColor(hex) {
      logger.log('Set light color:', hex)

      // Convert hex to Hue color space (simplified)
      const color = parseInt(hex.replace('#', ''), 16)
      const r = (color >> 16) & 0xff
      const g = (color >> 8) & 0xff
      const b = color & 0xff

      this.request({
        method: 'SET_COLOR',
        params: {
          lightId: this.state.lightId,
          hex,
          rgb: { r, g, b }
        }
      })
        .then(result => {
          if (result.success) {
            this.state.light.hex = hex
            this.renderPage()
          }
        })
        .catch(err => logger.error('Set color error:', err))
    },

    applyFavoriteColor(favorite) {
      logger.log('Apply favorite color:', favorite.name)

      this.request({
        method: 'SET_COLOR',
        params: {
          lightId: this.state.lightId,
          hex: favorite.hex,
          hue: favorite.hue,
          sat: favorite.sat,
          bri: favorite.bri
        }
      })
        .then(result => {
          if (result.success) {
            this.state.light.hex = favorite.hex
            this.state.light.bri = favorite.bri
            this.renderPage()
          }
        })
        .catch(err => logger.error('Apply favorite error:', err))
    },

    addCurrentColorToFavorites() {
      const light = this.state.light

      if (!light.hex) {
        logger.warn('No color to add to favorites')
        return
      }

      const newFavorite = {
        name: `Custom ${this.state.favoriteColors.length + 1}`,
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
      // back()
    },

    onDestroy() {
      logger.debug('Light detail page onDestroy')
      this.clearAllWidgets()
    }
  })
)