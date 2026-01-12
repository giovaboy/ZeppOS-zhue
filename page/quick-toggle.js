// page/quick-toggle.js
// Pagina "invisibile" per gestire il toggle dal widget
// Si apre, fa il toggle, e torna indietro automaticamente

import { BasePage } from '@zeppos/zml/base-page'
import { back } from '@zos/router'
import { createWidget, widget, deleteWidget, align } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { getText } from '@zos/i18n'
import { COLORS } from '../utils/constants'
import { getLogger } from '../utils/logger'
import { setStatusBarVisible } from '@zos/ui'
import { connectStatus } from '@zos/ble'

setStatusBarVisible(false)

const logger = getLogger('zhue-quick-toggle')
const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

Page(
  BasePage({
    state: {
      lightId: null,
      lightName: '',
      status: 'loading' // 'loading' | 'success' | 'error'
    },
    widgets: [],
    
    onInit(p) {
      logger.debug('Quick toggle page onInit')
      
      // Parse params
      let params = {}
      try {
        params = typeof p === 'string' ? JSON.parse(p) : (p || {})
      } catch (e) {
        logger.error('Failed to parse params:', e)
      }
      
      this.state.lightId = params.lightId
      this.state.lightName = params.lightName || 'Light'
      
      if (!this.state.lightId) {
        logger.error('No lightId provided!')
        this.state.status = 'error'
      }
      
      if (!connectStatus()) {
        logger.warn('connectStatus false')
        this.state.status = 'error'
      }
    },
    
    build() {
      // Mostra UI minimale
      this.renderUI()
      
      // Se abbiamo un lightId, fai il toggle
      if (this.state.lightId) {
        this.doToggle()
      } else {
        // Errore - torna indietro dopo un breve delay
        this.goBackAfterDelay(1000)
      }
    },
    
    clearAllWidgets() {
      this.widgets.forEach(w => {
        try { deleteWidget(w) } catch (e) {
          logger.error('Del widget err', e)
        }
      })
      this.widgets = []
    },
    
    createTrackedWidget(type, props) {
      const w = createWidget(type, props)
      this.widgets.push(w)
      return w
    },
    
    renderUI() {
      // Sfondo
      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0,
        y: 0,
        w: DEVICE_WIDTH,
        h: DEVICE_HEIGHT,
        color: COLORS.background
      })
      
      // Testo di stato
      const statusText = this.state.status === 'error' ?
        (getText('ERROR')) :
        (getText('TOGGLING'))
      
      this.createTrackedWidget(widget.TEXT, {
        x: 0,
        y: DEVICE_HEIGHT / 2 - px(30),
        w: DEVICE_WIDTH,
        h: px(60),
        text: this.state.lightName,
        text_size: px(28),
        color: COLORS.text || 0xFFFFFF,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })
      
      this.createTrackedWidget(widget.TEXT, {
        x: 0,
        y: DEVICE_HEIGHT / 2 + px(20),
        w: DEVICE_WIDTH,
        h: px(40),
        text: statusText,
        text_size: px(20),
        color: COLORS.textSubtitle || 0xAAAAAA,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
      })
    },
    
    doToggle() {
      logger.log('Toggling light:', this.state.lightId)
      if (!connectStatus()) {
        this.goBackAfterDelay(1000)
        return // Early exit if not connected
      }
      // Usa ZML request per comunicare con app-side
      this.request({
          method: 'WIDGET_TOGGLE_LIGHT',
          params: {
            lightId: this.state.lightId
          }
        })
        .then(result => {
          logger.log('Toggle result:', result)
          this.state.status = result.success ? 'success' : 'error'
          // Torna indietro
          this.goBackAfterDelay(200)
        })
        .catch(err => {
          logger.error('Toggle error:', err)
          this.state.status = 'error'
          this.goBackAfterDelay(1000)
        })
    },
    
    goBackAfterDelay(ms) {
      try {
        setTimeout(() => {
          back()
        }, ms)
      } catch (e) {
        back()
      }
    },
    
    onDestroy() {
      logger.debug('Quick toggle page destroyed')
      this.clearAllWidgets()
    }
  })
)