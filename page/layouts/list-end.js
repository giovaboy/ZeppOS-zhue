// Room below the groups list's last row. On round screens the edge cuts the bottom
// rows ("Sala giochi" half gone, the list unable to go further): the room
// lets the last row scroll up to the screen's middle, where the circle is
// widest. Square screens don't cut it: a margin. (The pages ending with
// the shortcut row don't need it: the row reads even near the edge.)
import { getDeviceInfo, SCREEN_SHAPE_SQUARE } from '@zos/device'
import { px } from '@zos/utils'

const { height: DEVICE_HEIGHT, screenShape } = getDeviceInfo()

export function listEndRoom(lastRowH) {
  if (screenShape === SCREEN_SHAPE_SQUARE) return px(20)
  return Math.max(px(20), Math.round(DEVICE_HEIGHT / 2 - lastRowH / 2))
}
