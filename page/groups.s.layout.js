// Square screens: the groups list layout is shared with round ones
// (page/layouts/groups.js); the status bar is hidden, as before
import { setStatusBarVisible } from '@zos/ui'
export { renderGroupsPage, LAYOUT_CONFIG, DEVICE_WIDTH, DEVICE_HEIGHT } from './layouts/groups.js'

setStatusBarVisible(false)
