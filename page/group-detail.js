import { BasePage } from '@zeppos/zml/base-page'
import { px } from '@zos/utils'
import { setPageBrightTime } from '@zos/display'
import { getLogger } from '../utils/logger.js'
import { getText } from '@zos/i18n'
import { createWidget, deleteWidget, widget, align, prop, text_style } from '@zos/ui'
import { push, back } from '@zos/router'
import { LIGHT_MODELS } from '../utils/constants.js'

const logger = getLogger('hue-group-detail-page')

const COLORS = {
  background: 0x000000,
  text: 0xffffff,
  highlight: 0x0055ff,
  success: 0x00aa00,
  error: 0xff0000,
  inactive: 0x666666,
  lightBg: 0x1a1a1a,
  sceneBg: 0x0a2540,
  toggleOn: 0x00aa00,
  toggleOff: 0x444444,
  sectionHeader: 0x0088ff // Aggiunto per coerenza
}

// Parametrizzazioni utente (da salvare in settings)
const USER_SETTINGS = {
  show_global_toggle: true,
  show_scenes: false,
  display_order: 'LIGHTS_FIRST' // or 'LIGHTS_FIRST'
}

Page(
  BasePage({
    state: {
      groupId: null,
      groupType: null,
      groupName: '',
      lights: [],
      scenes: [],
      isLoading: false
    },

    widgets: [],
    listWidget: null,

    onInit(p) {
      logger.debug('Group detail page onInit')

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

      if (params) {
        this.state.groupId = params.groupId
        this.state.groupType = params.groupType
        this.state.groupName = params.groupName
      }

      logger.log(`Initialized with Group ID: ${this.state.groupId}`)
    },

    build() {
      setPageBrightTime({ brightTime: 60000 })
      // NUOVO CHECK DI SICUREZZA QUI
      if (this.state.groupId) {
          this.loadGroupDetail()
      } else {
          // Se non c'è ID, mostra un errore a schermo.
          this.renderErrorState("ID Gruppo Mancante. Torna Indietro.")
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
          try { deleteWidget(w) } catch (e) {}
        })
      }
      this.widgets = []
      this.listWidget = null
    },

    // --- DATA LOADING & ACTIONS ---

    loadGroupDetail() {
      this.state.isLoading = true
      this.renderPage()

      this.request({
        method: 'GET_GROUP_DETAIL',
        params: { groupId: this.state.groupId }
      })
        .then(result => {
          if (result.success && result.data) {
            this.state.lights = result.data.lights || []
            this.state.scenes = result.data.scenes || []
            this.state.isLoading = false
            this.renderPage()
          } else {
            this.state.isLoading = false
            this.renderErrorState('Failed to load detail')
          }
        })
        .catch(err => {
          logger.error('Load group detail error:', err)
          this.state.isLoading = false
          this.renderErrorState(err.message || 'Network Error')
        })
    },

    toggleGroup() {
      const anyOn = this.state.lights.some(light => !!light.ison)
      const newState = !anyOn

      logger.log(`Toggle group ${this.state.groupName} to ${newState}`)

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
            logger.log('Group toggled successfully. Updating state.')
            // Aggiorna lo stato locale
            this.state.lights.forEach(light => {
                 light.ison = newState // Aggiorna lo stato annidato
            })
            this.renderPage()
          }
        })
        .catch(err => logger.error('Toggle group error:', err))
    },

    toggleLight(light) {
      logger.log('Toggle light:', light.name)

      const currentOnState = light.ison;
      const newState = !currentOnState;

      this.request({
        method: 'TOGGLE_LIGHT',
        params: {
          lightId: light.id,
          state: newState
        }
      })
        .then(result => {
          if (result.success) {
                light.ison = newState // Aggiorna lo stato annidato
            this.renderPage()
          }
        })
        .catch(err => logger.error('Toggle light error:', err))
    },

    applyScene(scene) {
      logger.log('Apply scene:', scene.name)

      this.request({
        method: 'APPLY_SCENE',
        params: {
          sceneId: scene.id,
          groupId: this.state.groupId
        }
      })
        .then(result => {
          if (result.success) {
            logger.log('Scene applied successfully')
            // Aggiorna lo stato delle luci dopo un breve ritardo per sincronizzare
            setTimeout(() => this.loadGroupDetail(), 500)
          }
        })
        .catch(err => logger.error('Apply scene error:', err))
    },

    navigateToLightDetail(light) {
      logger.log('Navigate to light detail:', light.name)

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
        return COLORS.inactive; // Spenta: colore grigio
      }

      const isColorModeActive = light.colormode === 'hs' || light.colormode === 'xy';

      if (isColorModeActive && light.hex) {
        try {
          if (typeof light.hex === 'string') {
              const hexStr = light.hex.startsWith('#') ? light.hex.substring(1) : light.hex;
              return parseInt(hexStr, 16);
          }
          return light.hex;
        } catch (e) {
          return 0xFFCC66;
        }
      }

      // Accesa in modalità bianco
      return 0xFFCC66; // Giallo caldo
    },
    // ----------------------------------------------

    // --- RENDERING ---

    renderErrorState(msg) {
      this.clearAllWidgets()
      this.createTrackedWidget(widget.TEXT, {
        x: px(20), y: px(200), w: px(440), h: px(100),
        text: `ERRORE: ${msg}`, text_size: px(24), color: 0xFF0000,
        align_h: align.CENTER_H, align_v: align.CENTER_V
      })
      this.createTrackedWidget(widget.BUTTON, {
        x: px(140), y: px(350), w: px(200), h: px(60),
        text: 'RETRY', normal_color: COLORS.highlight, press_color: 0x333333,
        click_func: () => this.build()
      })
    },

    renderPage() {
      this.clearAllWidgets()

      // Background
      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: px(480), h: px(480), color: COLORS.background
      })

      // Header: Nome del Gruppo
      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(10), w: px(480), h: px(40),
        text: this.state.groupName || 'Dettaglio Gruppo',
        text_size: px(34),
        color: COLORS.text,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })

      // Bottone Indietro (Back)
      /*this.createTrackedWidget(widget.TEXT, {
        x: px(10), y: px(10), w: px(60), h: px(40),
        text: '<', text_size: px(40), color: COLORS.highlight,
        click_func: () => back()
      })*/

      // Loading State
      if (this.state.isLoading) {
        this.createTrackedWidget(widget.TEXT, {
          x: 0, y: px(200), w: px(480), h: px(50),
          text: 'Loading...', text_size: px(28), color: COLORS.inactive,
          align_h: align.CENTER_H
        })
        return
      }

      // 2. Pulsante Toggle Globale (sotto l'header)
      this.renderGlobalToggle()

      // 3. Contenuto Scrollabile (Scene e Luci)
      this.renderGroupContentScroll()
    },

    renderGlobalToggle() {
      const anyOn = this.state.lights.some(light => !!light.ison)
      const buttonColor = anyOn ? COLORS.toggleOn : COLORS.toggleOff

      this.createTrackedWidget(widget.BUTTON, {
        x: px(80), y: px(60), w: px(320), h: px(60),
        text: anyOn ? getText('GROUP_OFF') : getText('GROUP_ON'),
        text_size: px(28),
        normal_color: buttonColor,
        press_color: 0x333333,
        radius: px(30),
        click_func: () => this.toggleGroup()
      })
    },

// Nel file group-detail.js (sostituisci l'intera funzione renderGroupContentScroll)

    renderGroupContentScroll() {
      const data = []
      const dataConfig = []
      let currentStart = 0

      // 1. Aggiungi le SCENE
      if (USER_SETTINGS.show_scenes && this.state.scenes.length > 0) {
          data.push({ type: 'header', name: 'Scene' })
          dataConfig.push({ start: currentStart, end: currentStart, type_id: 1 }) // Header type_id 1
          currentStart++

          this.state.scenes.forEach(scene => {
              data.push({ ...scene, type: 'scene' })
          })
          dataConfig.push({ start: currentStart, end: currentStart + this.state.scenes.length - 1, type_id: 2 }) // Scene type_id 2
          currentStart += this.state.scenes.length
      }

      // 2. Aggiungi le LUCI
      if (this.state.lights.length > 0) {
          data.push({ type: 'header', name: 'Luci', name_color: COLORS.text })
          dataConfig.push({ start: currentStart, end: currentStart, type_id: 1 })
          currentStart++

          this.state.lights.forEach(light => {
              const isOn = !!light.ison;

              logger.log(`Light ${light.id} (${light.name}): ON state is [${isOn}], RAW ON state is [${light.ison}], type: ${typeof light.ison}`);
              // ----------------------------------------------------


              const modelInfo = LIGHT_MODELS[light.modelid] || LIGHT_MODELS.default
              const baseIconName = modelInfo.icon

              const swatchColor = this.getLightSwatchColor(light)

              let stateSuffix = '_off'

              if (isOn) {
                  const isColorModeActive = light.colormode === 'hs' || light.colormode === 'xy'

                  if (isColorModeActive) {
                      stateSuffix = '_color'

                  } else {
                      stateSuffix = '_on'
                  }
              }
              // Testo dello stato per la seconda riga
              const statusText = isOn
                  ? `Bri: ${Math.round(light.bri / 254 * 100)}%`
                  : 'Spenta';

              const finalIconPath = `icons/${baseIconName}${stateSuffix}.png`

              data.push({
                  ...light,
                  type: 'light',
                  icon: finalIconPath,
                  status_text: statusText,
                  color: isOn ? 0xFFFFFF : COLORS.inactive, // Colore per il campo 'name'

                  // CHIAVI PER IL CAMPIONE DI COLORE
                  swatch_bg_color: swatchColor, // Colore dinamico per il background
                  swatch_text: ' ' // Testo fittizio (spazio) per attivare il text_view
              })
          })
          dataConfig.push({ start: currentStart, end: currentStart + this.state.lights.length - 1, type_id: 3 })
      }

      if (data.length === 0) {
         this.createTrackedWidget(widget.TEXT, {
          x: 0, y: px(200), w: px(480), h: px(50),
          text: 'Nessuna luce o scena trovata.', text_size: px(24), color: COLORS.inactive,
          align_h: align.CENTER_H
        })
        return
      }

      logger.log(`ScrollList items: ${data.length}, data_type_config count: ${dataConfig.length}`)

      // Definizione delle 3 configurazioni di riga - TUTTE USANO widget_set
      // Nel file group-detail.js / dentro renderGroupContentScroll() (sostituisci itemConfig)

      // Definizione delle 3 configurazioni di riga - TUTTE USANO widget_set
      const itemConfig = [
        // Type 1: Header (Titolo Sezione)
        {
          type_id: 1,
          item_bg_color: COLORS.background,
          item_bg_radius: px(0),
          item_height: px(50),
          text_view: [
            { x: px(20), y: px(10), w: px(440), h: px(40), key: 'name', color: COLORS.sectionHeader, text_size: px(26) },
          ],
          text_view_count: 1,
          image_view: [],
          image_view_count: 0
        },
        // Type 2: Scene (Pulsante di Scena)
        {
          type_id: 2,
          item_bg_color: COLORS.sceneBg,
          item_bg_radius: px(10),
          item_height: px(80),
          text_view: [
            { x: px(20), y: px(25), w: px(440), h: px(50), key: 'name', color: 0xFFFFFF, text_size: px(30) },
          ],
          text_view_count: 1,
          image_view: [],
          image_view_count: 0
        },
        // Type 3: Light item layout (CON CAMPIONE DI COLORE E TESTO CORRETTO)
        {
          type_id: 3,
          item_bg_color: COLORS.lightBg,
          item_bg_radius: px(10),
          item_height: px(90),
          text_view: [
            // RIGA 1: Campione di Colore (Swatch)
            {
                x: px(20), y: px(20), w: px(16), h: px(16),
                key: 'swatch_text', // Prende il valore ' ' (spazio) dal dato
                item_bg_color: 'swatch_bg_color', // CRITICO: Usa la chiave dinamica del dato
                color: 0x00000000, // Testo trasparente
                text_size: 1, // Dimensione minima
                item_bg_radius: px(4) // Bordo arrotondato
            },

            // RIGA 2: Nome della luce (Spostato a destra)
            { x: px(45), y: px(15), w: px(330), h: px(30), key: 'name', color: 0xFFFFFF, text_size: px(28) },

            // RIGA 3: Status (es. Bri: 80% / Spenta) (Spostato a destra)
            { x: px(45), y: px(45), w: px(330), h: px(25), key: 'status_text', color: COLORS.inactive, text_size: px(20) },
          ],
          text_view_count: 3, // Deve essere 3

          // Icona/Bottone Toggle
          image_view: [
            { x: px(380), y: px(10), w: px(70), h: px(70), key: 'icon', action: true }
          ],
          image_view_count: 1
        },
      ]
// ... (il resto della funzione renderGroupContentScroll continua qui)

      this.listWidget = this.createTrackedWidget(widget.SCROLL_LIST, {
        x: 0,
        y: px(140), // Inizia sotto il Toggle Globale
        w: px(480),
        h: px(340), // Prende il resto della pagina
        item_space: px(10),

        item_config: itemConfig,
        item_config_count: itemConfig.length,

        // Dati e Configurazione
        data_type_config: dataConfig,
        data_type_config_count: dataConfig.length,
        data_array: data,
        data_count: data.length,

        item_click_func: (list, index, data_key) => {
            const item = data[index]

            if (item.type === 'scene') {
                this.applyScene(item)
            } else if (item.type === 'light') {
                if (data_key === 'icon') {
                    // Click sul Toggle della luce
                    this.toggleLight(item)
                } else {
                     // Click sul Nome/generico (Naviga al dettaglio)
                    this.navigateToLightDetail(item)
                }
            }
        }
      })

      if (!this.listWidget) {
         logger.error("FATAL: SCROLL_LIST creation failed in detail page. The configuration failed.");
      }
    },

    onDestroy() {
      this.clearAllWidgets()
    }
  })
)