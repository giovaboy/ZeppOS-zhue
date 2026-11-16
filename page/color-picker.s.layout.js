// Square screens: the color picker's layout is shared with round ones
// (page/layouts/color-picker.js); the status bar is hidden, as before
import { setStatusBarVisible } from '@zos/ui'
export { renderColorPickerPage, LAYOUT_CONFIG, DEVICE_WIDTH, DEVICE_HEIGHT } from './layouts/color-picker.js'

setStatusBarVisible(false)
