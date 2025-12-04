import { BasePage } from '@zeppos/zml/base-page'
import { px } from '@zos/utils'
import { setPageBrightTime } from '@zos/display'
import { setScrollLock } from '@zos/page'
import { getText } from '@zos/i18n'
import { getLogger } from '../utils/logger.js'
import { createWidget, deleteWidget, widget, prop } from '@zos/ui'
import { back, push } from '@zos/router'
import { renderLightDetail, LAYOUT_CONFIG } from 'zosLoader:./light-detail.[pf].layout.js'

const logger = getLogger('hue-light-detail-page')

// Helper per calcolare hex per il bottone anteprima se manca
function hsb2hex(h, s, v) {
  if (s === 0) { const val = Math.round(v * 2.55); return val << 16 | val << 8 | val; }
  h /= 60; s /= 100; v /= 100;
  const i = Math.floor(h); const f = h - i; const p = v * (1 - s); const q = v * (1 - f * s); const t = v * (1 - (1 - f) * s);
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

const DEFAULT_PRESETS = [
  { hex: '#FFA500', bri: 200, hue: 8000, sat: 200, isColor: true },
  { hex: '#87CEEB', bri: 220, hue: 32000, sat: 150, isColor: true },
  { hex: '#FF6B6B', bri: 180, hue: 0, sat: 254, isColor: true },
  { hex: '#FFFFFF', bri: 254, ct: 250, isColor: false },
  { hex: '#F0EAD6', bri: 200, ct: 450, isColor: false },
  { hex: '#4A148C', bri: 100, hue: 48000, sat: 254, isColor: true }
]

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

    onInit(p) {
      let params = {}
      try { params = typeof p === 'string' ? JSON.parse(p) : p } catch (e) {
        logger.error('Error parsing params', e)
      }
      this.state.lightId = params?.lightId
      this.state.lightName = params?.lightName || 'Light'
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

    renderPage() {
      this.clearAllWidgets()

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
        openColorPickerFunc: () => this.openColorPicker(), // NUOVO
        applyPresetFunc: (fav) => this.applyPreset(fav),
        addFavoriteFunc: () => this.addCurrentColorToFavorites(),
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
        setScrollLock({ lock: true })
        const newBri = getBrightnessFromX(info.x)
        this.state.isDraggingBrightness = true
        this.state.tempBrightness = newBri
        this.setBrightness(newBri, true)
      } else if (evtType === 'MOVE') {
        if (!this.state.isDraggingBrightness) return
        const newBri = getBrightnessFromX(info.x)
        this.state.tempBrightness = newBri
        const newBriPosition = Math.max(0, Math.round(sliderW * newBri / 254))
        const newPercent = Math.round(newBri / 254 * 100)

        if (this.state.brightnessSliderFillWidget)
          this.state.brightnessSliderFillWidget.setProperty(prop.W, newBriPosition)
        if (this.state.brightnessLabel)
          this.state.brightnessLabel.setProperty(prop.TEXT, getText('BRIGHTNESS', newPercent))
      } else if (evtType === 'UP') {
        if (!this.state.isDraggingBrightness) return
        setScrollLock({ lock: false })
        if (this.state.tempBrightness !== this.state.light.bri) {
          this.setBrightness(this.state.tempBrightness, false)
        }
        this.state.isDraggingBrightness = false
      }
    },

    loadFavoriteColors() { logger.log('Loading favs') }, // Placeholder

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
          this.state.isLoading = false; logger.error(err)
        })
    },

    toggleLight() {
      const newState = !this.state.light.ison;
      this.request({ method: 'TOGGLE_LIGHT', params: { lightId: this.state.lightId, state: newState } })
        .then(result => {
          if (result.success) { this.state.light.ison = newState; this.renderPage(); }
        })
    },

    setBrightness(brightness, skipApiCall = false) {
      this.state.light.bri = brightness
      const { sliderW } = LAYOUT_CONFIG
      const fillWidth = Math.max(0, Math.round(sliderW * brightness / 254))
      const percent = Math.round(brightness / 254 * 100)

      if (this.state.brightnessSliderFillWidget) this.state.brightnessSliderFillWidget.setProperty(prop.W, fillWidth)
      if (this.state.brightnessLabel) this.state.brightnessLabel.setProperty(prop.TEXT, getText('BRIGHTNESS', percent))

      if (skipApiCall) return
      this.request({ method: 'SET_BRIGHTNESS', params: { lightId: this.state.lightId, brightness } })
    },

    applyPreset(favorite) {
      this.state.light.hex = favorite.hex
      this.state.light.bri = favorite.bri
      this.state.light.hue = favorite.hue
      this.state.light.sat = favorite.sat
      this.state.light.ct = favorite.ct

      this.request({
        method: 'SET_COLOR', params: {
          lightId: this.state.lightId, hex: favorite.hex, hue: favorite.hue, sat: favorite.sat, bri: favorite.bri, ct: favorite.ct
        }
      })
        .then(res => { if (res.success) this.loadLightDetail() }) // Reload per sicurezza
    },

    addCurrentColorToFavorites() {
      const light = this.state.light
      // Logica semplificata, hex dovrebbe già esserci grazie a renderPage
      this.state.favoriteColors.push({ hex: light.hex || '#FFFFFF', hue: light.hue, sat: light.sat, bri: light.bri, isColor: !light.ct })
      this.renderPage()
    },

    goBack() { back() },
    onDestroy() { this.clearAllWidgets() }
  })
)