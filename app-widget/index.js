// index.js
import { createWidget, widget, align, text_style, px, getAppWidgetSize } from '@zos/ui'
import { push } from '@zos/router'
import { COLORS, PRESET_TYPES, btnPressColor, ct2hex } from '../utils/constants'

const { w, h, margin, radius } = getAppWidgetSize()

AppWidget({
  build() {
    createWidget(widget.BUTTON, {
      x: w / 2 - px(80),
      y: h / 2 - px(25),
      w: px(160),
      h: px(50),
      text: 'TEST WIDGET',
      normal_color: COLORS.activeTab,
      press_color: btnPressColor(COLORS.activeTab, 0.8),
      radius: px(25),
      click_func: () => push({
        url: 'page/index',
        params: 'type=1',
      })
    })
  }
})