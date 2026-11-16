// The shortcut card's entries (localStorage WIDGET_SHORTCUTS_KEY): up to
// MAX_WIDGET_SHORTCUTS slots, each empty ({ lightId: null }) or
//   a light: { lightId, lightName, modelid, archetype, ison, color, at }
//            (entries saved before groups came have no `kind`: lights)
//   a group: { kind: 'group', groupId, name, groupClass, ison, color, at }
//
// The card can't ask the phone anything (it takes taps only, and has no
// messaging), so the app keeps there the last state it saw of each entry:
// on / off, its color, and when it was confirmed (`at`). The phone sends the
// states of every card entry at each app start and with each tap on the card;
// the card shows on / off only while it was confirmed less than
// CARD_STATE_FRESH_MS ago, an unknown state after.
//
// localStorage rewrites all its content at every save (field-notes.md,
// "Storage"): a state is written only when it changed, or to confirm one at
// most every CONFIRM_EVERY_MS, once for a batch.
import { localStorage } from '@zos/storage'
import { WIDGET_SHORTCUTS_KEY, MAX_WIDGET_SHORTCUTS, DEFAULT_WIDGET_SHORTCUTS, COLORS, lightDisplayColor } from './constants.js'
import { devLog, LOG_TRACE } from './remote-log.js'

// A group on the card, while on: a warm white (a group has no one color)
export const GROUP_ON_COLOR = COLORS.defaultSwatchColor

// An unchanged state is confirmed again (its `at` written) at most this often:
// well under CARD_STATE_FRESH_MS (10 min), or a state just seen could count
// as unknown
const CONFIRM_EVERY_MS = 2 * 60 * 1000

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

const has = (v) => v !== null && v !== undefined
export const isGroupEntry = (s) => !!s && s.kind === 'group'
export const isEmptySlot = (s) => !s || (!has(s.lightId) && !has(s.groupId))

// The card entry for a light (kind 'light') or a group (kind 'group')
export function findCardEntry(list, kind, id) {
  return list.find((s) => !isEmptySlot(s) && (kind === 'group'
    ? isGroupEntry(s) && String(s.groupId) === String(id)
    : !isGroupEntry(s) && String(s.lightId) === String(id)))
}

export function isInCard(kind, id) {
  return !!findCardEntry(readShortcuts(), kind, id)
}

// Adds `entry` to the card, or removes it if it is there: 'added',
// 'removed', or 'full' (no free slot)
export function toggleInCard(entry) {
  const list = readShortcuts()
  const kind = isGroupEntry(entry) ? 'group' : 'light'
  const found = findCardEntry(list, kind, kind === 'group' ? entry.groupId : entry.lightId)
  if (found) {
    list[list.indexOf(found)] = { lightId: null, lightName: null }
    writeShortcuts(list)
    return 'removed'
  }
  const free = list.findIndex(isEmptySlot)
  if (free < 0) return 'full'
  list[free] = { ...entry, at: entry.at || Date.now() }
  writeShortcuts(list)
  return 'added'
}

// What the card shows of a light: on / off, its color (kept while off too:
// switched on from the card it shows in its color again), when it was seen
export function cardState(light) {
  return { ison: !!light.ison && light.reachable !== false, color: lightDisplayColor(light), at: Date.now() }
}

// ...and of a group: on while any of its lights is on
export function groupCardState(group) {
  return { ison: !!(group.anyOn || group.any_on), color: GROUP_ON_COLOR, at: Date.now() }
}

// Applies the states the app just saw ([[id, state], ...], state from
// cardState / groupCardState) to the card's entries of `kind`; written if one
// changed, or to confirm an unchanged one older than CONFIRM_EVERY_MS
function remember(kind, pairs) {
  const list = readShortcuts()
  const now = Date.now()
  let changed = 0
  let confirmed = 0
  for (const [id, state, modelid, archetype] of pairs) {
    if (!has(id) || !state) continue
    const slot = findCardEntry(list, kind, id)
    if (!slot) continue
    const same = slot.ison === state.ison && slot.color === state.color && (!modelid || slot.modelid === modelid) &&
      (!archetype || slot.archetype === archetype)
    if (same && slot.at && now - slot.at < CONFIRM_EVERY_MS) continue
    if (same) confirmed++
    else changed++
    slot.ison = state.ison
    slot.color = state.color
    slot.at = now
    if (modelid) slot.modelid = modelid
    if (archetype) slot.archetype = archetype // the icon (lightIconName)
  }
  if ((changed || confirmed) && writeShortcuts(list) && LOG_TRACE) {
    devLog(`[card] ${kind}s: ${changed} changed, ${confirmed} confirmed`)
  }
}

// Lights the app just saw: [[lightId, light], ...]
export function rememberLights(pairs) {
  remember('light', pairs.filter(([, l]) => l).map(([id, l]) => [id, cardState(l), l.modelid, l.archetype]))
}

export function rememberLight(lightId, light) {
  rememberLights([[lightId, light]])
}

// Groups the app just saw: [[groupId, { anyOn }], ...]
export function rememberGroups(pairs) {
  remember('group', pairs.filter(([, g]) => g).map(([id, g]) => [id, groupCardState(g)]))
}

// Switched from the card with no states in the answer: only on / off is known
export function rememberOnOff(kind, id, ison) {
  const list = readShortcuts()
  const slot = findCardEntry(list, kind, id)
  if (!slot) return
  slot.ison = !!ison
  slot.at = Date.now()
  writeShortcuts(list)
}

// The ids of the card's lights and groups, for the phone to send their states
export function cardLightIds() {
  return readShortcuts().filter((s) => !isEmptySlot(s) && !isGroupEntry(s)).map((s) => s.lightId)
}

export function cardGroupIds() {
  return readShortcuts().filter(isGroupEntry).map((s) => s.groupId)
}
