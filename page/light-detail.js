import { BasePage } from '@zeppos/zml/base-page'
import { px } from '@zos/utils'
import { setPageBrightTime } from '@zos/display'
import { getText } from '@zos/i18n'
import { getLogger } from '../utils/logger.js'
import { createWidget, deleteWidget, widget, align, prop, text_style } from '@zos/ui'

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
      tempBrightness: 0
    },

    widgets: [],
    brightnessSliderWidget: null,
    brightnessSliderFillWidget: null,
    brightnessLabel: null,

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
      this.loadLightDetail()
    },

    clearAllWidgets() {
      this.widgets.forEach(w => {
        try { deleteWidget(w) } catch (e) {}
      })
      this.widgets = []
      this.brightnessSliderWidget = null
      this.brightnessSliderFillWidget = null
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
        radius: px(10),
        click_func: () => this.goBack()
      })
    },


    renderPage() {
      this.clearAllWidgets()

       // Header
      this.createTrackedWidget(widget.TEXT, {
        x: px(20), y: px(20), w: px(380), h: px(50),
        text: this.state.lightName,
        text_size: px(32),
        color: COLORS.text,
        align_h: align.LEFT,
        align_v: align.CENTER_V
      })

      // Back button
      this.createTrackedWidget(widget.BUTTON, {
        x: px(410), y: px(20), w: px(50), h: px(50),
        text: '←',
        text_size: px(32),
        normal_color: COLORS.highlight,
        press_color: COLORS.success,
        radius: px(8),
        click_func: () => this.goBack()
      })

      const light = this.state.light
      if (!light) return

      const lightOn = !!light.ison; // *** FIX: Usa light.ison ***
      const capabilities = this.getLightCapabilities(light); // Usa il nuovo helper

      logger.debug(capabilities);

      // Background with light color if on
      // *** FIX: Usa lightOn ***
      const bgColor = lightOn && light.hex ? this.getLightBgColor(light.hex) : COLORS.background

      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: px(480), h: px(480),
        color: bgColor
      })

      // Header (omesso per brevità, il tuo codice è qui)
      // ...

      let currentY = px(90)

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

      this.createTrackedWidget(widget.FILL_RECT, {
        x: px(40), y: yPos, w: px(400), h: px(80),
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
      })

      this.createTrackedWidget(widget.BUTTON, {
        x: px(40), y: yPos, w: px(400), h: px(80),
        text: getText('LIGHT_TOGGLE'),
        normal_color: 0x00000000,
        press_color: 0x33ffffff,
        radius: px(12),
        click_func: () => this.toggleLight()
      })

      return yPos + px(95)
    },

    renderBrightnessSlider(yPos) {
      const light = this.state.light
      const brightness = this.state.isDraggingBrightness ? this.state.tempBrightness : light.bri
      const brightnessPercent = Math.round(brightness / 254 * 100)

      // Label
      this.brightnessLabel = this.createTrackedWidget(widget.TEXT, {
        x: px(40), y: yPos, w: px(400), h: px(35),
        text: getText('BRIGHTNESS', brightnessPercent),
        text_size: px(26),
        color: COLORS.text,
        align_h: align.LEFT,
        align_v: align.CENTER_V
      })

      const sliderY = yPos + px(40)
      const sliderWidth = px(400)
      const fillWidth = Math.max(px(10), Math.round(sliderWidth * brightness / 254))

      // Slider background
      this.brightnessSliderWidget = this.createTrackedWidget(widget.FILL_RECT, {
        x: px(40), y: sliderY, w: sliderWidth, h: px(40),
        color: COLORS.sliderBg,
        radius: px(8)
      })

      // Slider fill
      this.brightnessSliderFillWidget = this.createTrackedWidget(widget.FILL_RECT, {
        x: px(40), y: sliderY, w: fillWidth, h: px(40),
        color: COLORS.sliderFill,
        radius: px(8)
      })

      // Touch area for slider (simplified - real implementation would need gesture events)
      this.createTrackedWidget(widget.BUTTON, {
        x: px(40), y: sliderY, w: sliderWidth, h: px(40),
        text: '',
        normal_color: 0x00000000,
        press_color: 0x00000000,
        radius: px(8),
        click_func: () => {
          // Note: This is simplified. Real slider would use touch events
          // to calculate position and update brightness dynamically
          logger.log('Brightness slider tapped (full gesture support needed)')
        }
      })

      // Brightness adjustment buttons
      const btnY = sliderY + px(55)

      this.createTrackedWidget(widget.BUTTON, {
        x: px(40), y: btnY, w: px(80), h: px(50),
        text: '−',
        text_size: px(40),
        normal_color: COLORS.inactive,
        press_color: COLORS.highlight,
        radius: px(8),
        click_func: () => {
          this.adjustBrightness(-25)}
      })

      this.createTrackedWidget(widget.BUTTON, {
        x: px(360), y: btnY, w: px(80), h: px(50),
        text: '+',
        text_size: px(40),
        normal_color: COLORS.inactive,
        press_color: COLORS.highlight,
        radius: px(8),
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

        this.createTrackedWidget(widget.FILL_RECT, {
          x, y: colorsY, w: colorSize, h: colorSize,
          color: parseInt(color.hex.replace('#', ''), 16),
          radius: px(8)
        })

        this.createTrackedWidget(widget.BUTTON, {
          x, y: colorsY, w: colorSize, h: colorSize,
          text: '',
          normal_color: 0x00000000,
          press_color: 0x44ffffff,
          radius: px(8),
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

        this.createTrackedWidget(widget.TEXT, {
          x: px(100), y: itemY, w: px(300), h: itemHeight,
          text: fav.name,
          text_size: px(22),
          color: COLORS.text,
          align_h: align.LEFT,
          align_v: align.CENTER_V
        })

        this.createTrackedWidget(widget.BUTTON, {
          x: px(40), y: itemY, w: px(400), h: itemHeight,
          text: '',
          normal_color: 0x00000000,
          press_color: 0x33ffffff,
          radius: px(8),
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

    setBrightness(brightness) {
      this.state.light.bri = brightness

      // Update UI immediately
      if (this.brightnessSliderFillWidget) {
        const fillWidth = Math.max(px(10), Math.round(px(400) * brightness / 254))
        try {
          this.brightnessSliderFillWidget.setProperty(prop.W, fillWidth)
        } catch {}
      }

      if (this.brightnessLabel) {
        const brightnessPercent = Math.round(brightness / 254 * 100)
        try {
          this.brightnessLabel.setProperty(text, getText('BRIGHTNESS', brightnessPercent))
        } catch {}
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