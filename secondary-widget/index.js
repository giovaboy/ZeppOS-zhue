import { createWidget, widget, deleteWidget, align, text_style } from '@zos/ui'
import { getLogger } from '../utils/logger.js'

const logger = getLogger('zhue-group-detail-page')

SecondaryWidget({
  build() {
    const text = this.createTrackedWidget(widget.TEXT, {
      x: 96,
      y: 120,
      w: 288,
      h: 46,
      color: 0xffffff,
      text_size: 36,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: 'HELLO, Zepp OS'
    })
  },

  createTrackedWidget(type, props) {
    const w = createWidget(type, props)
    this.widgets.push(w)
    return w
  },

  clearAllWidgets() {
    this.widgets.forEach(w => {
      try { deleteWidget(w) } catch (e) {
        logger.error('Del widget err', e)
      }
    })
    this.widgets = []
  },

  onResume() {
    this.clearAllWidgets()
    this.build()
  },

  onDestroy() {
    this.clearAllWidgets()
  }
})