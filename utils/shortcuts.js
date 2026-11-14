// The shortcut card's lights (localStorage WIDGET_SHORTCUTS_KEY): up to
// MAX_WIDGET_SHORTCUTS slots { lightId, lightName, modelid, ison, color }.
//
// The card can't ask the phone anything (it takes taps only, and has no
// messaging), so the app keeps there the last state it saw of each card light
// (on / off and its color): the card shows a light as zhue last left it, not
// necessarily as it is (a change made in the Hue app shows once zhue sees
// the light again).
//
// localStorage rewrites all its content at every save (field-notes.md,
// "Storage"): a state is written only when it changed, once for a batch.
import { localStorage } from '@zos/storage'
import { WIDGET_SHORTCUTS_KEY, MAX_WIDGET_SHORTCUTS, DEFAULT_WIDGET_SHORTCUTS, lightDisplayColor } from './constants.js'
import { devLog, LOG_TRACE } from './remote-log.js'

export function readShortcuts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WIDGET_SHORTCUTS_KEY) || 'null')
    if (Array.isArray(parsed)) {
      const list = parsed.slice(0, MAX_WIDGET_SHORTCUTS)
      while (list.length < MAX_WIDGET_SHORTCUTS) list.push({ lightId: null, lightName: null })
      return list
    }
  } catch (e) { /* the defaults */ }
  return DEFAULT_WIDGET_SHORTCUTS.map((s) => ({ ...s }))
}

export function writeShortcuts(list) {
  try {
    localStorage.setItem(WIDGET_SHORTCUTS_KEY, JSON.stringify(list))
    return true
  } catch (e) {
    return false
  }
}

// What the card shows of a light: on / off, and its color, kept while off too
// (the card turns it grey): switched on from the card, whose answer says
// only on or off, it shows in its color again
export function cardState(light) {
  return { ison: !!light.ison && light.reachable !== false, color: lightDisplayColor(light) }
}

// Switched from the card: only on / off is known
export function rememberOnOff(lightId, ison) {
  const list = readShortcuts()
  const slot = list.find((s) => s && s.lightId !== null && String(s.lightId) === String(lightId))
  if (!slot || slot.ison === !!ison) return
  slot.ison = !!ison
  writeShortcuts(list)
}

// The state of lights the app just saw ([[lightId, light], ...]), kept for
// those on the card; written only if one changed
export function rememberLights(pairs) {
  const list = readShortcuts()
  let changed = 0
  for (const [lightId, light] of pairs) {
    if (lightId === undefined || lightId === null || !light) continue
    const slot = list.find((s) => s && s.lightId !== null && String(s.lightId) === String(lightId))
    if (!slot) continue
    const { ison, color } = cardState(light)
    if (slot.ison === ison && slot.color === color && (!light.modelid || slot.modelid === light.modelid)) continue
    slot.ison = ison
    slot.color = color
    if (light.modelid) slot.modelid = light.modelid
    changed++
  }
  if (changed && writeShortcuts(list) && LOG_TRACE) devLog(`[card] state of ${changed} card lights saved`)
}

export function rememberLight(lightId, light) {
  rememberLights([[lightId, light]])
}
