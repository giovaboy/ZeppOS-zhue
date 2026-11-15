// Square screens: a group's page layout is shared with round ones
// (page/layouts/group-detail.js); the status bar is hidden, as before
import { setStatusBarVisible } from '@zos/ui'
export { renderGroupDetailPage, LAYOUT_CONFIG, DEVICE_WIDTH, DEVICE_HEIGHT } from './layouts/group-detail.js'

setStatusBarVisible(false)
