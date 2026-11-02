import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'
import { DEFAULT_USER_SETTINGS, MAX_WIDGET_SHORTCUTS, HUE_RANGE, SAT_RANGE, BRI_RANGE, DEFAULT_PRESETS, PRESET_TYPES, DEMO_DATA } from '../utils/constants.js'
import { logs, logsPrivate, logsEnabled, LOG_LEVEL } from '../config.js'
import { LOG_KEY, LOG_MAX, scrubLog, requestForLog } from './log.js'
import { errorText, sizeText } from '../utils/log-text.js'

const BRIDGE_IP_KEY = 'hue_bridge_ip'
const USERNAME_KEY = 'hue_username'
const API_VERSION_KEY = 'hue_api_version'
const DEMO_MODE = 'hue_demo_mode'
const SHOW_SCENES = 'hue_show_scenes'
const DISPLAY_ORDER = 'hue_display_order'
const FAVORITE_COLORS = 'hue_favorite_colors'

// ── Logs box (shared rule: ../_shared/zeppos-ai-doc/logging.md) ──
// Three levels (config.js LOG_LEVEL): vlog (trace: diagnostics), plog (info:
// the main events), wlog (problems; none with 'off'). The watch's [w] lines
// come already filtered by the watch. Every line is scrubbed
// (app-side/log.js): the bridge key, and addresses unless DEV.

// The phone's console: developer builds only. Its lines used to carry the
// bridge key (pairing answer, config dumps)
const clog = logsPrivate() ? (...args) => console.log(...args) : () => {}
const cerr = logsPrivate() ? (...args) => console.error(...args) : () => {}

// Every bridge key seen in this run: a key cleared from the settings may
// still be in memory and in the lines that follow
const knownSecrets = new Set()
function currentSecrets() {
  const key = settingsLib.getItem(USERNAME_KEY)
  if (typeof key === 'string' && key.length >= 8) knownSecrets.add(key)
  return Array.from(knownSecrets).sort((a, b) => b.length - a.length)
}

// The watch marks the lines it saved at close and sends again at its next
// start; the batch it was sending at close has usually arrived already
const FROM_LAST_RUN = ' (from the last run)'

// One write of the store for all of `msgs` (a batch of watch lines would
// rewrite the whole 200-line store once per line otherwise)
function writeLines(msgs) {
  try {
    // Public releases (LOG_LEVEL 'off'): nothing is stored
    if (!msgs.length || !logsEnabled()) return
    const now = new Date()
    const ts = `${now.toTimeString().slice(0, 8)}.${String(now.getMilliseconds()).padStart(3, '0')}`
    const s = currentSecrets()
    const raw = settingsLib.getItem(LOG_KEY)
    const lines = raw ? JSON.parse(raw) : []
    // What is stored, without the phone's time, to skip a line from the last
    // run that already arrived (no duplicates, no line lost)
    let seen = null
    for (const msg of msgs) {
      if (msg.endsWith(FROM_LAST_RUN)) {
        if (!seen) seen = new Set(lines.map((l) => l.slice(l.indexOf(' ') + 1)))
        if (seen.has(scrubLog(msg.slice(0, -FROM_LAST_RUN.length), s))) continue
      }
      const line = `${ts} ${scrubLog(msg, s)}`
      if (logsPrivate()) console.log(line)
      lines.push(line)
    }
    if (lines.length > LOG_MAX) lines.splice(0, lines.length - LOG_MAX)
    settingsLib.setItem(LOG_KEY, JSON.stringify(lines))
  } catch (e) { /* never throw from the logger */ }
}
const writeLog = (msg) => writeLines([msg])
const plog = (msg) => { if (logs('info')) writeLog(msg) }
const wlog = (msg) => { if (logs('warn')) writeLog(msg) }
const vlog = (msg) => { if (logs('trace')) writeLog(msg) }

// The errors in a v1 answer: the bridge answers HTTP 200 with
// [{ error: { type, address, description } }] when it refuses something
function hueErrorsOf(body) {
  let data = body
  if (typeof body === 'string') {
    if (body.indexOf('"error"') === -1) return null
    try { data = JSON.parse(body) } catch (e) { return null }
  }
  if (!Array.isArray(data)) return null
  const errors = data.filter((x) => x && x.error).map((x) => x.error)
  if (!errors.length) return null
  const text = errors.slice(0, 3)
    .map((e) => `type ${e.type} "${e.description}"${e.address ? ` at ${e.address}` : ''}`)
    .join('; ') + (errors.length > 3 ? ` (+${errors.length - 3} more)` : '')
  // 101 "link button not pressed": expected while pairing waits for the user
  return { text, linkButton: errors.every((e) => e.type === 101) }
}

function bodySize(body) {
  if (typeof body === 'string') return `, ${sizeText(body.length)}`
  if (body && typeof body === 'object') {
    try { return `, ${sizeText(JSON.stringify(body).length)}` } catch (e) { return '' }
  }
  return ''
}

// Requests that carry out a user's action: logged at info. The rest (reads,
// cancels) at trace
const ACTION_METHODS = new Set([
  'TOGGLE_LIGHT', 'SET_BRIGHTNESS', 'SET_COLOR', 'SET_HS', 'SET_XY', 'ALL_LIGHTS',
  'TOGGLE_GROUP', 'APPLY_SCENE', 'WIDGET_TOGGLE_LIGHT', 'PAIR', 'DISCOVER_BRIDGES',
  'SET_MANUAL_IP', 'CLEAR_CONFIG', 'ADD_FAVORITE_COLOR', 'REMOVE_FAVORITE_COLOR',
  'RESET_FAVORITE_COLORS'
])

// The parameters worth a line, none private (not the IP of SET_MANUAL_IP)
const LOGGED_PARAMS = ['tapId', 'lightId', 'groupId', 'groupType', 'sceneId', 'favoriteId', 'state', 'on', 'bri', 'hue', 'sat', 'ct', 'xy']
function paramsForLog(params) {
  if (!params || typeof params !== 'object') return ''
  const parts = []
  for (const k of LOGGED_PARAMS) {
    const v = params[k]
    if (v === undefined || v === null) continue
    parts.push(`${k}=${Array.isArray(v) ? v.map((n) => Math.round(n * 1000) / 1000).join(',') : v}`)
  }
  return parts.length ? ` ${parts.join(' ')}` : ''
}

// What an answer says, in counts: ': 4 rooms, 2 zones', ': connected', ...
function resultForLog(data) {
  if (!data || typeof data !== 'object') return ''
  const parts = []
  const d = data.data
  if (d && typeof d === 'object') {
    if (Array.isArray(d.rooms)) parts.push(`${d.rooms.length} rooms`)
    if (Array.isArray(d.zones)) parts.push(`${d.zones.length} zones`)
    if (Array.isArray(d.lights)) parts.push(`${d.lights.length} lights`)
    if (Array.isArray(d.scenes)) parts.push(`${d.scenes.length} scenes`)
    if (d.light) parts.push(`light ${d.light.ison ? 'on' : 'off'}${d.light.reachable === false ? ' (unreachable)' : ''}`)
  }
  if (Array.isArray(data.bridges)) parts.push(`${data.bridges.length} bridges`)
  if (data.connected !== undefined) parts.push(data.connected ? 'connected' : `not connected (${data.reason || '?'})`)
  if (data.newState !== undefined) parts.push(`now ${data.newState ? 'on' : 'off'}`)
  if (data.updatedState) parts.push(`now ${data.updatedState.ison ? 'on' : 'off'}`)
  if (data.added !== undefined) parts.push(data.added ? 'added' : 'already there')
  if (data.message) parts.push(String(data.message))
  return parts.length ? `: ${parts.join(', ')}` : ''
}

// fetch with a line for the Logs box: the path without the bridge key, the
// status, the time, and the bridge's own errors
async function hueFetch(options) {
  const what = requestForLog(options && options.method, options && options.url)
  const t0 = Date.now()
  let res
  try {
    res = await fetch(options)
  } catch (e) {
    wlog(`[http] ${what} failed after ${Date.now() - t0}ms: ${errorText(e)}`)
    throw e
  }
  const ms = Date.now() - t0
  const status = res && res.status
  const hueErrors = hueErrorsOf(res && res.body)
  if (hueErrors) {
    const line = `[http] ${what} HTTP ${status} in ${ms}ms, bridge error: ${hueErrors.text}`
    if (hueErrors.linkButton) vlog(line)
    else wlog(line)
  } else if (status && (status < 200 || status >= 300)) {
    wlog(`[http] ${what} HTTP ${status} in ${ms}ms`)
  } else if (logs('trace')) {
    vlog(`[http] ${what} HTTP ${status} in ${ms}ms${bodySize(res && res.body)}`)
  }
  return res
}

/*PrioritàModeParametriPrecisioneNote
1 xy  | x, y, bri     | ***** | Standard CIE 1931, massima accuratezza
2 ct  | ct, bri       | ****  | Temperatura colore (solo bianchi)
3 hs  | hue, sat, bri | ***   | Hue/Saturation, buona per UI
4 rgb | r, g, b       | ***   | Convertito in XY automaticamente
*/

// --- Nuova funzione: HSB (0-65535, 0-254, 0-254) a RGB (0-255) ---
function hsbToRgb(h, s, v) {
  h = h / HUE_RANGE * 360 // Hue API (0-65535) -> 0-360
  s = s / SAT_RANGE // Sat API (0-254) -> 0-1
  v = v / BRI_RANGE // Bri API (0-254) -> 0-1

  let r, g, b
  if (s === 0) {
    r = g = b = v // Colore acromatico (bianco/grigio)
  } else {
    let i = Math.floor(h / 60)
    let f = h / 60 - i
    let p = v * (1 - s)
    let q = v * (1 - f * s)
    let t = v * (1 - (1 - f) * s)
    switch (i % 6) {
      case 0:
        r = v;
        g = t;
        b = p;
        break
      case 1:
        r = q;
        g = v;
        b = p;
        break
      case 2:
        r = p;
        g = v;
        b = t;
        break
      case 3:
        r = p;
        g = q;
        b = v;
        break
      case 4:
        r = t;
        g = p;
        b = v;
        break
      case 5:
        r = v;
        g = p;
        b = q;
        break
    }
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}

// Funzione esistente per RGB a HSB (per la conversione al contrario)
function rgbToHsb(r, g, b) {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6
    } else if (max === g) {
      h = (b - r) / delta + 2
    } else {
      h = (r - g) / delta + 4
    }
    h *= 60
    if (h < 0) h += 360
  }

  const s = max === 0 ? 0 : delta / max
  const bri = max

  return {
    hue: Math.round(h / 360 * HUE_RANGE), // Hue API usa 0-65535
    sat: Math.round(s * SAT_RANGE), // Hue API usa 0-254
    bri: Math.round(bri * BRI_RANGE) // Hue API usa 0-254
  }
}

// --- Conversione XY (CIE 1931) ↔ RGB ---

/**
 * Converti coordinate XY (gamut CIE 1931) a RGB
 * @param {number} x - Coordinata X (0-1)
 * @param {number} y - Coordinata Y (0-1)
 * @param {number} bri - Brightness (0-254)
 * @returns {{r: number, g: number, b: number}} RGB (0-255)
 */
function xyBriToRgb(x, y, bri) {
  // Normalizza brightness da 0-254 a 0-1
  const brightness = bri / BRI_RANGE

  // Calcola z dalla x e y
  const z = 1.0 - x - y

  // Converti da XYZ a RGB usando la matrice di trasformazione Wide RGB D65
  const Y = brightness
  const X = (Y / y) * x
  const Z = (Y / y) * z

  // Matrice di conversione XYZ → RGB (sRGB D65)
  let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038
  let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152
  let b = X * 0.051713 - Y * 0.121364 + Z * 1.011530

  // Applica gamma correction (sRGB)
  r = r <= 0.0031308 ? 12.92 * r : (1.0 + 0.055) * Math.pow(r, (1.0 / 2.4)) - 0.055
  g = g <= 0.0031308 ? 12.92 * g : (1.0 + 0.055) * Math.pow(g, (1.0 / 2.4)) - 0.055
  b = b <= 0.0031308 ? 12.92 * b : (1.0 + 0.055) * Math.pow(b, (1.0 / 2.4)) - 0.055

  // Clamp e scala a 0-255
  r = Math.max(0, Math.min(1, r)) * 255
  g = Math.max(0, Math.min(1, g)) * 255
  b = Math.max(0, Math.min(1, b)) * 255

  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b)
  }
}

/**
 * Converti RGB a coordinate XY (CIE 1931)
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {{x: number, y: number, bri: number}} XY coordinates e brightness
 */
function rgbToXy(r, g, b) {
  // Normalizza RGB da 0-255 a 0-1
  r = r / 255
  g = g / 255
  b = b / 255

  // Applica gamma correction inversa (sRGB)
  r = r > 0.04045 ? Math.pow((r + 0.055) / (1.0 + 0.055), 2.4) : r / 12.92
  g = g > 0.04045 ? Math.pow((g + 0.055) / (1.0 + 0.055), 2.4) : g / 12.92
  b = b > 0.04045 ? Math.pow((b + 0.055) / (1.0 + 0.055), 2.4) : b / 12.92

  // Converti RGB a XYZ usando matrice Wide RGB D65
  const X = r * 0.664511 + g * 0.154324 + b * 0.162028
  const Y = r * 0.283881 + g * 0.668433 + b * 0.047685
  const Z = r * 0.000088 + g * 0.072310 + b * 0.986039

  // Evita divisione per zero
  const sum = X + Y + Z
  if (sum === 0) {
    return { x: 0, y: 0, bri: 0 }
  }

  // Calcola coordinate xy
  const x = X / sum
  const y = Y / sum

  // Y rappresenta la brightness (luminance)
  const bri = Math.round(Y * BRI_RANGE)

  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    bri: Math.max(1, Math.min(BRI_RANGE, bri))
  }
}

/**
 * Verifica se coordinate XY sono nel gamut della lampada
 * Gamut tipico delle lampade Philips Hue (Gamut C - lampade recenti)
 */
function isInGamut(x, y, gamut = 'C') {
  // Gamut predefinti per diverse generazioni di lampade Hue
  const gamuts = {
    // Gamut A - lampade più vecchie
    A: {
      red: [0.704, 0.296],
      green: [0.2151, 0.7106],
      blue: [0.138, 0.08]
    },
    // Gamut B - lampade intermedie
    B: {
      red: [0.675, 0.322],
      green: [0.409, 0.518],
      blue: [0.167, 0.04]
    },
    // Gamut C - lampade più recenti (default)
    C: {
      red: [0.692, 0.308],
      green: [0.17, 0.7],
      blue: [0.153, 0.048]
    }
  }

  const g = gamuts[gamut] || gamuts.C

  // Funzione helper per calcolare se un punto è nel triangolo
  const sign = (p1, p2, p3) => {
    return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
  }

  const d1 = sign([x, y], g.red, g.green)
  const d2 = sign([x, y], g.green, g.blue)
  const d3 = sign([x, y], g.blue, g.red)

  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0)
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0)

  return !(hasNeg && hasPos)
}

/**
 * Porta coordinate XY nel gamut più vicino
 */
function forceIntoGamut(x, y, gamut = 'C') {
  if (isInGamut(x, y, gamut)) {
    return { x, y }
  }

  const gamuts = {
    A: { red: [0.704, 0.296], green: [0.2151, 0.7106], blue: [0.138, 0.08] },
    B: { red: [0.675, 0.322], green: [0.409, 0.518], blue: [0.167, 0.04] },
    C: { red: [0.692, 0.308], green: [0.17, 0.7], blue: [0.153, 0.048] }
  }

  const g = gamuts[gamut] || gamuts.C

  // Trova il punto più vicino sul bordo del triangolo
  const closestPointOnLine = (p, a, b) => {
    const ap = [p[0] - a[0], p[1] - a[1]]
    const ab = [b[0] - a[0], b[1] - a[1]]
    const ab2 = ab[0] * ab[0] + ab[1] * ab[1]
    const ap_ab = ap[0] * ab[0] + ap[1] * ab[1]
    let t = ap_ab / ab2
    t = Math.max(0, Math.min(1, t))
    return [a[0] + ab[0] * t, a[1] + ab[1] * t]
  }

  const p = [x, y]
  const pRG = closestPointOnLine(p, g.red, g.green)
  const pGB = closestPointOnLine(p, g.green, g.blue)
  const pBR = closestPointOnLine(p, g.blue, g.red)

  const dRG = Math.hypot(p[0] - pRG[0], p[1] - pRG[1])
  const dGB = Math.hypot(p[0] - pGB[0], p[1] - pGB[1])
  const dBR = Math.hypot(p[0] - pBR[0], p[1] - pBR[1])

  let closest = pRG
  if (dGB < dRG) closest = pGB
  if (dBR < Math.min(dRG, dGB)) closest = pBR

  return { x: closest[0], y: closest[1] }
}

async function safeJson(resp) {
  try {
    if (resp.json) return await resp.json()
    if (typeof resp.body === 'string') return JSON.parse(resp.body)
    if (resp.data) return JSON.parse(resp.data)
  } catch (e) {
    cerr('JSON parse error:', e, resp)
  }
  return {}
}

function presetsAreEqual(presetA, presetB) {
  clog('Comparing presets:', presetA, presetB);

  if (presetA.type !== presetB.type) {
    return false;
  }

  // Confronta il BRI, che è sempre fondamentale
  if (presetA.bri !== presetB.bri) {
    return false;
  }

  switch (presetA.type) {
    case PRESET_TYPES.COLOR: {
      // 1. Confronto HUE e SAT
      const hsMatch = (presetA.hue === presetB.hue && presetA.sat === presetB.sat);

      // 2. Confronto XY (Solo se entrambi ce l'hanno ed è un array valido)
      let xyMatch = false;
      if (Array.isArray(presetA.xy) && Array.isArray(presetB.xy)) {
        // Confrontiamo i valori interni dell'array, non l'oggetto array stesso
        xyMatch = (presetA.xy[0] === presetB.xy[0]) && (presetA.xy[1] === presetB.xy[1]);
      }

      // Se uno dei due metodi corrisponde, è lo stesso colore
      return hsMatch || xyMatch;
    }
    case PRESET_TYPES.CT:
      return presetA.ct === presetB.ct;

    case PRESET_TYPES.WHITE:
      return true;

    default:
      return presetA.hex === presetB.hex;
  }
}

class HueBridgeManager {
  constructor() {
    clog('HueBridgeManager initializing')
    this.bridgeIp = settingsLib.getItem(BRIDGE_IP_KEY) || null
    this.username = settingsLib.getItem(USERNAME_KEY) || null
    this.apiVersion = settingsLib.getItem(API_VERSION_KEY) || 'v1'
    this.demo = settingsLib.getItem(DEMO_MODE) === 'true'
    this.user_settings = this._loadUserSettings()

    // --- LOGICA DEMO ---
    if (this.demo) {
      this._initDemoState()
      this.bridgeIp = '192.168.1.100' // Dummy IP
      this.username = 'DEMO_USER_HUE' // Dummy Username
      this.apiVersion = 'v1'
    }
    // --------------------
    // Cancellation tokens for different operations
    this.currentPairingCancellation = null
    this.currentDiscoveryCancellation = null
    this.currentFetchCancellation = null

    clog('HueBridgeManager initialized:', {
      bridgeIp: this.bridgeIp,
      key: this.username ? 'set' : 'not set',
      apiVersion: this.apiVersion
    })
  }

  //carica le impostazioni utente
  _loadUserSettings() {
    //const show_global_toggle_str = settingsLib.getItem(SHOW_GLOBAL_TOGGLE)
    const show_scenes_str = settingsLib.getItem(SHOW_SCENES)
    const display_order_str = settingsLib.getItem(DISPLAY_ORDER)
    const favorite_colors_str = settingsLib.getItem(FAVORITE_COLORS)
    //const widget_shortcuts_str = settingsLib.getItem(WIDGET_SHORTCUTS)

    // Parse favorite colors
    let favorite_colors = DEFAULT_USER_SETTINGS.favorite_colors
    if (favorite_colors_str) {
      try {
        favorite_colors = JSON.parse(favorite_colors_str)
      } catch (e) {
        cerr('Failed to parse favorite colors:', e)
      }
    }

    return {
      /*show_global_toggle: show_global_toggle_str !== null ?
        show_global_toggle_str === 'true' :
        DEFAULT_USER_SETTINGS.show_global_toggle,*/

      show_scenes: show_scenes_str !== null ?
        show_scenes_str === 'true' : DEFAULT_USER_SETTINGS.show_scenes,

      display_order: display_order_str !== null ?
        display_order_str : DEFAULT_USER_SETTINGS.display_order,

      favorite_colors: favorite_colors
    }
  }

  getUserSettings() {
    this.user_settings = this._loadUserSettings()
    return {
      ...this.user_settings,
      demo_mode: this.demo
    }
  }

  // Salva i colori preferiti
  saveFavoriteColors(colors) {
    try {
      const colorsJson = JSON.stringify(colors)
      settingsLib.setItem(FAVORITE_COLORS, colorsJson)
      this.user_settings.favorite_colors = colors
      clog('Favorite colors saved:', colors.length)
      return { success: true }
    } catch (e) {
      cerr('Failed to save favorite colors:', e)
      throw new Error('Failed to save favorite colors')
    }
  }

  // Funzione di aggiunta - DEVE assegnare l'ID
  addFavoriteColor(colorData) {
    const currentColors = this.user_settings.favorite_colors || []

    // Controlla se esiste un preset logicamente equivalente
    const exists = currentColors.some(existingColor => presetsAreEqual(existingColor, colorData));
    if (exists) {
      clog('Color preset already exists in favorites');
      return { success: true, added: false };
    }

    // Aggiunge l'ID univoco prima di salvare
    const newColor = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      ...colorData
    }

    const newColors = [...currentColors, newColor]
    clog(newColors)
    if (this.saveFavoriteColors(newColors)) {
      return { success: true, added: true };
    } else {
      return { success: false, added: false };
    }
  }

  // Funzione di rimozione - FILTRA PER ID
  removeFavoriteColor(favoriteId) {
    const currentColors = this.user_settings.favorite_colors || []

    // Filtra l'array, mantenendo solo gli elementi il cui ID è DIVERSO da quello da eliminare
    const newColors = currentColors.filter(favorite => favorite.id !== favoriteId)

    // Se la lunghezza è cambiata, salviamo
    if (newColors.length < currentColors.length) {
      return this.saveFavoriteColors(newColors)
    } else {
      // ID non trovato, gestisci l'errore o logga
      throw new Error(`Favorite with ID ${favoriteId} not found.`)
    }
  }

  // Reset ai preset di default
  resetFavoriteColors() {
    return this.saveFavoriteColors(DEFAULT_PRESETS)
  }

  // ==========================================
  // WIDGET SHORTCUTS MANAGEMENT
  // ==========================================
  /*
    getWidgetShortcuts() {
      return this.user_settings.widget_shortcuts || DEFAULT_USER_SETTINGS.widget_shortcuts
    }

    saveWidgetShortcuts(shortcuts) {
      try {
        const shortcutsJson = JSON.stringify(shortcuts)
        settingsLib.setItem(WIDGET_SHORTCUTS, shortcutsJson)
        this.user_settings.widget_shortcuts = shortcuts
        clog('Widget shortcuts saved:', shortcuts)
        return { success: true }
      } catch (e) {
        cerr('Failed to save widget shortcuts:', e)
        throw new Error('Failed to save widget shortcuts')
      }
    }

    addWidgetShortcut(lightId, lightName) {
      const shortcuts = this.getWidgetShortcuts()

      // Check if light is already in shortcuts
      const existingIndex = shortcuts.findIndex(s => s.lightId === lightId)
      if (existingIndex !== -1) {
        clog('Light already in widget shortcuts')
        return { success: true, added: false, reason: 'already_exists' }
      }

      // Find first empty slot
      const emptyIndex = shortcuts.findIndex(s => s.lightId === null)
      if (emptyIndex === -1) {
        clog('No empty slots available')
        return { success: false, added: false, reason: 'slots_full' }
      }

      // Add to empty slot
      shortcuts[emptyIndex] = { lightId, lightName }
      this.saveWidgetShortcuts(shortcuts)

      return { success: true, added: true, slotIndex: emptyIndex }
    }

    removeWidgetShortcut(lightId) {
      const shortcuts = this.getWidgetShortcuts()

      const index = shortcuts.findIndex(s => s.lightId === lightId)
      if (index === -1) {
        clog('Light not found in widget shortcuts')
        return { success: false, removed: false }
      }

      // Clear the slot
      shortcuts[index] = { lightId: null, lightName: null }
      this.saveWidgetShortcuts(shortcuts)

      return { success: true, removed: true }
    }

    isLightInWidgetShortcuts(lightId) {
      const shortcuts = this.getWidgetShortcuts()
      return shortcuts.some(s => s.lightId === lightId)
    }*/

  // --- Funzioni per lo stato DEMO ---
  _initDemoState() {
    this.DEMO_STATE = DEMO_DATA
    this._updateGroupState()
  }

  // Aggiorna lo stato dei gruppi in base allo stato delle luci
  _updateGroupState() {
    Object.keys(this.DEMO_STATE.groups).forEach(groupId => {
      const group = this.DEMO_STATE.groups[groupId]
      const lightsInGroup = group.lights.map(lightId => this.DEMO_STATE.lights[lightId]).filter(Boolean)

      let anyOn = lightsInGroup.some(l => l.ison)
      let allOn = lightsInGroup.every(l => l.ison)

      group.state = { any_on: anyOn, all_on: allOn }
      group.anyOn = anyOn // Aggiunto per coerenza con il mapping
    })
  }

  // Esegue un'azione (toggle, set bri, set color) e aggiorna lo stato demo
  _handleDemoAction(lightId, state) {
    if (lightId === 'all') {
      Object.keys(this.DEMO_STATE.lights).forEach(id => {
        this.DEMO_STATE.lights[id].ison = state
      })
    } else {
      const light = this.DEMO_STATE.lights[lightId]
      if (light) {
        Object.assign(light, state)

        // Se stiamo impostando XY, aggiorna anche il colormode
        if (state.xy) {
          light.colormode = 'xy'
        } else if (state.ct) {
          light.colormode = 'ct'
        } else if (state.hue !== undefined || state.sat !== undefined) {
          light.colormode = 'hs'
        }
      }
    }
    this._updateGroupState()
    return { success: true }
  }

  // Esegue un'azione (toggle, set bri, set color) su un gruppo
  _handleDemoGroupAction(groupId, state) {
    const group = this.DEMO_STATE.groups[groupId]
    if (group) {
      group.lights.forEach(lightId => {
        const light = this.DEMO_STATE.lights[lightId]
        if (light) {
          light.ison = state
        }
      })
      this._updateGroupState()
      return { success: true }
    }
    throw new Error(`Demo group ${groupId} not found`)
  }
  // --------------------

  saveConfig() {
    if (this.demo) return // Non salvare configurazioni dummy
    settingsLib.setItem(BRIDGE_IP_KEY, this.bridgeIp)
    settingsLib.setItem(USERNAME_KEY, this.username)
    settingsLib.setItem(API_VERSION_KEY, this.apiVersion)
    clog('Hue config saved:', {
      bridgeIp: this.bridgeIp,
      key: this.username ? 'set' : 'not set',
      apiVersion: this.apiVersion
    })
  }

  // The bridge's address and key back from the settings storage (demo mode
  // turned off: the demo's dummy values were in memory)
  reloadConfig() {
    this.bridgeIp = settingsLib.getItem(BRIDGE_IP_KEY) || null
    this.username = settingsLib.getItem(USERNAME_KEY) || null
    this.apiVersion = settingsLib.getItem(API_VERSION_KEY) || 'v1'
  }

  // One value changed in the settings storage (the settings page edited the
  // IP or cleared the config). Only that value: saveConfig() writes the three
  // one after the other, and re-reading all of them in between would put back
  // the key a pairing just replaced
  applyStoredValue(key, value) {
    if (this.demo) return
    const v = typeof value === 'string' && value !== '' ? value : null
    if (key === BRIDGE_IP_KEY) this.bridgeIp = v
    else if (key === USERNAME_KEY) this.username = v
    else if (key === API_VERSION_KEY) this.apiVersion = v || 'v1'
  }

  clearConfig() {
    if (this.demo) {
      this._initDemoState()
      clog('DEMO MODE: Config cleared (reset to initial demo state)')
      return
    }
    settingsLib.removeItem(BRIDGE_IP_KEY)
    settingsLib.removeItem(USERNAME_KEY)
    settingsLib.removeItem(API_VERSION_KEY)
    this.bridgeIp = null
    this.username = null
    this.apiVersion = 'v1'
  }

  async discoverBridges() {
    if (this.demo) {
      clog('DEMO MODE: Discovering bridges mock')
      const bridges = [{ id: 'demo-1', internalipaddress: this.bridgeIp, name: 'Demo Hue Bridge' }]
      this.saveConfig()
      return bridges
    }

    // Cancel any previous discovery
    this.cancelDiscovery()

    // Create cancellation token
    const cancellationToken = { cancelled: false }
    this.currentDiscoveryCancellation = cancellationToken

    clog('Discovering bridges...')

    try {
      // Check cancellation before fetch
      if (cancellationToken.cancelled) {
        throw new Error('Discovery cancelled')
      }

      const res = await hueFetch({
        url: 'https://discovery.meethue.com',
        method: 'GET',
        timeout: 5000,
        headers: { 'Accept': 'application/json' }
      }).catch((e) => {
        clog('fetch error:', e)
        throw e
      })

      // Check cancellation after fetch
      if (cancellationToken.cancelled) {
        throw new Error('Discovery cancelled')
      }

      const bridges = await safeJson(res)

      if (!Array.isArray(bridges) || bridges.length === 0) {
        throw new Error('No bridges found on network')
      }

      this.bridgeIp = bridges[0].internalipaddress
      this.saveConfig()

      // Clear cancellation token on success
      this.currentDiscoveryCancellation = null

      return bridges

    } catch (e) {
      this.currentDiscoveryCancellation = null
      throw e
    }
  }

  async pair() {
    if (this.demo) {
      clog('DEMO MODE: Pairing success')
      return { success: true }
    }
    if (!this.bridgeIp) throw new Error('No bridge IP configured')
    clog('Pairing bridge (v1 API)...')
    return await this.pairV1()
  }

  /**
 * Cancel any ongoing pairing operation
 */
  cancelPairing() {
    if (this.currentPairingCancellation) {
      clog('Cancelling ongoing pairing operation')
      this.currentPairingCancellation.cancelled = true
      this.currentPairingCancellation = null
    }
  }

  /**
   * Cancel any ongoing bridge discovery
   */
  cancelDiscovery() {
    if (this.currentDiscoveryCancellation) {
      clog('Cancelling ongoing bridge discovery')
      this.currentDiscoveryCancellation.cancelled = true
      this.currentDiscoveryCancellation = null
    }
  }

  /**
   * Cancel any ongoing fetch operations
   */
  cancelFetch() {
    if (this.currentFetchCancellation) {
      clog('Cancelling ongoing fetch operation')
      this.currentFetchCancellation.cancelled = true
      this.currentFetchCancellation = null
    }
  }

  /**
   * Cancel all operations (convenience method)
   */
  cancelAllOperations() {
    clog('Cancelling all ongoing operations')
    this.cancelPairing()
    this.cancelDiscovery()
    this.cancelFetch()
  }

  async pairWithRetry(maxRetries = 5, delayMs = 3000) {
    if (this.demo) {
      return this.pair()
    }

    // Cancel any previous pairing attempt
    this.cancelPairing()

    if (!this.bridgeIp) throw new Error('No bridge IP configured')

    // Create cancellation token
    const cancellationToken = { cancelled: false }
    this.currentPairingCancellation = cancellationToken

    let attempt = 0
    while (attempt < maxRetries) {
      // Check if cancelled before each attempt
      if (cancellationToken.cancelled) {
        clog('Pairing cancelled by user')
        throw new Error('Pairing cancelled')
      }

      attempt++
      try {
        clog(`Pairing attempt ${attempt}/${maxRetries}...`)

        const result = await this.pairV1()
        clog('Pairing successful:', result)

        // Clear cancellation token on success
        this.currentPairingCancellation = null
        return result

      } catch (e) {
        // Check if operation was cancelled
        if (cancellationToken.cancelled) {
          throw new Error('Pairing cancelled')
        }

        if (e.message === 'BUTTON_NOT_PRESSED') {
          cerr('Bridge button not pressed, waiting and retrying...')

          // Wait with cancellation support
          try {
            await this.cancellableDelay(delayMs, cancellationToken)
          } catch (cancelError) {
            // Delay was cancelled
            throw new Error('Pairing cancelled')
          }

        } else {
          // Other errors are thrown immediately
          this.currentPairingCancellation = null
          throw e
        }
      }
    }

    this.currentPairingCancellation = null
    throw new Error('Failed to pair: button not pressed within retry limit')
  }

  /**
 * Delay that checks for cancellation periodically
 * @param {number} ms - Milliseconds to delay
 * @param {object} cancellationToken - Token with 'cancelled' property
 */
  async cancellableDelay(ms, cancellationToken) {
    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        // Check if cancelled
        if (cancellationToken.cancelled) {
          clearInterval(checkInterval)
          reject(new Error('Operation cancelled'))
          return
        }

        // Check if delay is complete
        if (Date.now() - startTime >= ms) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100) // Check every 100ms for quick response
    })
  }

  async pairV1() {
    if (this.demo) {
      return this.pair()
    }
    const url = `http://${this.bridgeIp}/api`
    const res = await hueFetch({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devicetype: 'zeppos_hue#watch' })
    })
    const result = await safeJson(res)
    clog('Pair result:', result)

    if (!Array.isArray(result) || !result[0]) throw new Error('Bad bridge response')
    if (result[0].error) {
      const err = result[0].error
      if (err.type === 101) throw new Error('BUTTON_NOT_PRESSED')
      throw new Error(err.description || 'Pairing failed')
    }

    this.username = result[0].success.username
    this.apiVersion = 'v1'
    this.saveConfig()
    return { success: true }
  }

  async checkConnection() {
    if (this.demo) {
      clog('DEMO MODE: Connection check success')
      return { connected: true }
    }
    if (!this.bridgeIp || !this.username) {
      clog('Not configured')
      return { connected: false, reason: 'Not configured' }
    }
    try {
      clog('configured')
      await this.getLights()
      return { connected: true }
    } catch (e) {
      cerr('Connection failed:', e)
      return { connected: false, reason: e.message }
    }
  }

  async getGroups() {
    if (this.demo) {
      clog('DEMO MODE: Get groups mock')
      return {
        rooms: Object.values(this.DEMO_STATE.groups).filter(g => g.type === 'Room'),
        zones: Object.values(this.DEMO_STATE.groups).filter(g => g.type === 'Zone')
      }
    }
    if (!this.bridgeIp || !this.username)
      throw new Error('Bridge not configured')

    if (this.currentFetchCancellation?.cancelled) {
      throw new Error('Fetch cancelled')
    }
    return await this.getGroupsV1()
    /*try {
      return await this.getGroupsV2()
    } catch {
      return await this.getGroupsV1()
    }*/
  }

  async getGroupsV1() {
    if (this.currentFetchCancellation?.cancelled) {
      throw new Error('Fetch cancelled')
    }

    const url = `http://${this.bridgeIp}/api/${this.username}/groups`
    const res = await hueFetch({ url, method: 'GET' })
    // CHECK 2: After fetch, before parsing
    if (this.currentFetchCancellation?.cancelled) {
      throw new Error('Fetch cancelled')
    }
    const json = await safeJson(res)

    if (Array.isArray(json) && json[0]?.error)
      throw new Error(json[0].error.description)

    // CHECK 3: Before mapping (optional but recommended)
    if (this.currentFetchCancellation?.cancelled) {
      throw new Error('Fetch cancelled')
    }

    return this._mapGroupsV1(json)
  }

  async getGroupsV2() {
    const url = `https://${this.bridgeIp}/clip/v2/resource/room`
    const res = await hueFetch({
      url,
      method: 'GET',
      headers: { 'hue-application-key': this.username }
    })
    const json = await safeJson(res)
    if (json.errors?.length) throw new Error(json.errors[0].description)

    const rooms = this._mapGroupsV2(json.data || [], 'room')

    // Get zones
    const zonesUrl = `https://${this.bridgeIp}/clip/v2/resource/zone`
    const zonesRes = await hueFetch({
      url: zonesUrl,
      method: 'GET',
      headers: { 'hue-application-key': this.username }
    })
    const zonesJson = await safeJson(zonesRes)
    const zones = this._mapGroupsV2(zonesJson.data || [], 'zone')

    return { rooms, zones }
  }

  // In index_app.js

  _mapGroupsV1(data) {
    const rooms = []
    const zones = []

    Object.entries(data).forEach(([id, g]) => {
      // Estraiamo lo stato direttamente dal gruppo
      const isAnyOn = g.state ? (g.state.any_on || g.state.all_on) : false

      const groupObj = {
        id,
        name: g.name,
        class: g.class,
        type: g.type === 'Room' ? 'room' : 'zone',
        lights: g.lights || [],
        anyOn: isAnyOn
      }

      if (g.type === 'Room') {
        rooms.push(groupObj)
      } else if (g.type === 'Zone') {
        zones.push(groupObj)
      }
    })

    return { rooms, zones }
  }

  _mapGroupsV2(data, type) {
    return data.map(g => ({
      id: g.id,
      name: g.metadata?.name || 'Unknown',
      type: type,
      lights: g.children?.map(c => c.rid) || []
    }))
  }

  async toggleGroup(groupId, state) {
    if (this.demo) {
      clog(`DEMO MODE: Toggle group ${groupId} to ${state}`)
      return this._handleDemoGroupAction(groupId, state)
    }
    if (!this.bridgeIp || !this.username)
      throw new Error('Bridge not configured')

    return await this.toggleGroupV1(groupId, state)
    /*try {
      return await this.toggleGroupV2(groupId, state)
    } catch {
      return await this.toggleGroupV1(groupId, state)
    }*/
  }

  async toggleGroupV1(groupId, state) {
    const url = `http://${this.bridgeIp}/api/${this.username}/groups/${groupId}/action`
    const res = await hueFetch({
      url,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on: state })
    })
    const result = await safeJson(res)
    if (result[0]?.error) throw new Error(result[0].error.description)
    return { success: true }
  }

  async toggleGroupV2(groupId, state) {
    // V2 usa grouped_light resource
    const url = `https://${this.bridgeIp}/clip/v2/resource/grouped_light/${groupId}`
    const res = await hueFetch({
      url,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'hue-application-key': this.username
      },
      body: JSON.stringify({ on: { on: state } })
    })
    const result = await safeJson(res)
    if (result.errors?.length) throw new Error(result.errors[0].description)
    return { success: true }
  }

  async getGroupDetail(groupId, groupType) {
    if (this.demo) {
      clog(`DEMO MODE: Get group detail for ${groupId}`)
      const group = this.DEMO_STATE.groups[groupId]
      if (!group) throw new Error('Demo Group not found')

      const lights = group.lights.map(lightId => {
        const light = this.DEMO_STATE.lights[lightId]
        return this._mapLightToSimple(light)
      }).filter(Boolean)

      const scenes = Object.values(this.DEMO_STATE.scenes)
        .filter(s => s.group === groupId)
        .map(s => ({ id: s.id, name: s.name, color: s.color }))

      return { lights, scenes }
    }
    // Get lights in group
    const allLights = await this.getLights()

    // For V1, get group info
    const url = `http://${this.bridgeIp}/api/${this.username}/groups/${groupId}`
    const res = await hueFetch({ url, method: 'GET' })
    const group = await safeJson(res)

    if (Array.isArray(group) && group[0]?.error)
      throw new Error(group[0].error.description)

    // Filter lights
    const groupLightIds = group.lights || []
    const lights = allLights.filter(l => groupLightIds.includes(l.id))

    // Get scenes for this group
    const scenes = await this.getScenesForGroup(groupId)

    return { lights, scenes }
  }

  async getScenesForGroup(groupId) {
    if (this.demo) {
      clog(`DEMO MODE: Get scenes for group ${groupId}`)
      return Object.values(this.DEMO_STATE.scenes)
        .filter(s => s.group === groupId)
        .map(s => ({ id: s.id, name: s.name, color: s.color }))
    }
    const url = `http://${this.bridgeIp}/api/${this.username}/scenes`
    const res = await hueFetch({ url, method: 'GET' })
    const scenes = await safeJson(res)

    if (Array.isArray(scenes) && scenes[0]?.error)
      return []

    return Object.entries(scenes)
      .filter(([id, s]) => s.group === groupId)
      .map(([id, s]) => ({
        id,
        name: s.name,
        color: '#0088ff' // Placeholder
      }))
  }

  async getLights() {
    if (this.demo) {
      clog('DEMO MODE: Get lights mock')
      // Mappa lo stato interno demo al formato atteso dal client (come farebbe _mapLightsV1)
      return Object.values(this.DEMO_STATE.lights)
        .map(l => this._mapLightToSimple(l))
    }
    if (!this.bridgeIp || !this.username)
      throw new Error('Bridge not configured')
    /*try {
      // prefer v2, fallback to v1
      const v2Lights = await this.getLightsV2()
      if (v2Lights && v2Lights.length) {
        this.apiVersion = 'v2'
        this.saveConfig()
        return v2Lights
      }
    } catch (e) {
      cerr('v2 getLights failed, fallback to v1:', e.message)
    }*/
    return await this.getLightsV1()
  }

  async getLightsV1() {
    const url = `http://${this.bridgeIp}/api/${this.username}/lights`
    const res = await hueFetch({ url, method: 'GET' })
    const json = await safeJson(res)
    if (Array.isArray(json) && json[0]?.error)
      throw new Error(json[0].error.description)
    return this._mapLightsV1(json)
  }

  async getLightsV2() {
    const url = `https://${this.bridgeIp}/clip/v2/resource/light`
    const res = await hueFetch({
      url,
      method: 'GET',
      headers: { 'hue-application-key': this.username }
    })
    const json = await safeJson(res)
    if (json.errors?.length) throw new Error(json.errors[0].description)
    return this._mapLightsV2(json.data || [])
  }

  // Mappa il formato dati esteso (DEMO o full V1) al formato semplificato del client
  _mapLightToSimple(l) {
    const state = {
      on: l.ison,
      name: l.name,
      bri: l.bri,
      hue: l.hue,
      sat: l.sat,
      ct: l.ct,
      xy: l.xy,
      colormode: l.colormode,
      modelid: l.modelid,
      reachable: l.reachable
    }
    return {
      id: l.id,
      name: l.name,
      ison: l.ison,
      bri: l.bri,
      hue: l.hue,
      sat: l.sat,
      ct: l.ct,
      xy: l.xy,
      colormode: l.colormode,
      modelid: l.modelid,
      reachable: l.reachable,
      type: l.type,
      hex: this.stateToHex(state),
      capabilities: this.getLightCapabilities({ state: state, type: l.type })
    }
  }

  _mapLightsV1(data) {
    return Object.entries(data).map(([id, l]) => ({
      id,
      name: l.name,
      ison: l.state.on,
      bri: l.state.bri,
      hue: l.state.hue,
      sat: l.state.sat,
      ct: l.state.ct,
      xy: l.state.xy,
      colormode: l.state.colormode,
      modelid: l.modelid,
      type: l.type,
      reachable: l.state.reachable,
      hex: this.stateToHex(l.state)
    }))
  }

  _mapLightsV2(data) {
    return data.map(l => ({
      id: l.id,
      name: l.metadata?.name || 'Unknown',
      ison: l.on?.on || false,
      bri: Math.round((l.dimming?.brightness || 0) * 2.54),
      ct: l.state.ct,
      colormode: l.state.colormode,
      reachable: l.status !== 'connectivity_issue',
      hex: this.stateToHex({ on: l.on?.on, bri: l.dimming?.brightness })
    }))
  }

  async toggleLight(id, state) {
    if (this.demo) {
      clog(`DEMO MODE: Toggle light ${id} to ${state}`)
      return this._handleDemoAction(id, { ison: state })
    }
    if (!this.bridgeIp || !this.username)
      throw new Error('Bridge not configured')

    return await this.toggleLightV1(id, state)
    /*try {
      return await this.toggleLightV2(id, state)
    } catch {
      return await this.toggleLightV1(id, state)
    }*/
  }

  async toggleLightV1(id, state) {
    const url = `http://${this.bridgeIp}/api/${this.username}/lights/${id}/state`
    const res = await hueFetch({
      url,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on: state })
    })
    const result = await safeJson(res)
    if (result[0]?.error) throw new Error(result[0].error.description)

    // ✅ NUOVO: Fetch dati aggiornati usando getLightDetail()
    try {
      const updatedLight = await this.getLightDetail(id)

      return {
        success: true,
        updatedState: {
          name: updatedLight.name,
          ison: updatedLight.ison,
          bri: updatedLight.bri,
          hue: updatedLight.hue,
          sat: updatedLight.sat,
          ct: updatedLight.ct,
          xy: updatedLight.xy,
          colormode: updatedLight.colormode,
          modelid: updatedLight.modelid,
          type: updatedLight.type,
          reachable: updatedLight.reachable,
          hex: updatedLight.hex,
          capabilities: updatedLight.capabilities
        }
      }
    } catch (e) {
      cerr('Failed to fetch updated light state:', e)
      // Fallback: ritorna solo success senza dati
      return { success: true }
    }
  }

  async toggleLightV2(id, state) {
    const url = `https://${this.bridgeIp}/clip/v2/resource/light/${id}`
    const res = await hueFetch({
      url,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'hue-application-key': this.username
      },
      body: JSON.stringify({ on: { on: state } })
    })
    const result = await safeJson(res)
    if (result.errors?.length) throw new Error(result.errors[0].description)
    return { success: true }
  }

  async setLightBrightness(id, bri) {
    if (this.demo) {
      clog(`DEMO MODE: Set brightness for light ${id} to ${bri}`)
      return this._handleDemoAction(id, { bri: bri, colormode: 'bri' })
    }
    if (!this.bridgeIp || !this.username)
      throw new Error('Bridge not configured')
    return await this.setLightBrightnessV1(id, bri)

    /*try {
      return await this.setLightBrightnessV2(id, brightness)
    } catch {
      return await this.setLightBrightnessV1(id, brightness)
    }*/
  }

  async setLightBrightnessV1(id, bri) {
    const url = `http://${this.bridgeIp}/api/${this.username}/lights/${id}/state`
    const res = await hueFetch({
      url,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bri: bri })
    })
    const result = await safeJson(res)
    if (result[0]?.error) throw new Error(result[0].error.description)
    return { success: true }
  }

  async setLightBrightnessV2(id, bri) {
    // V2 usa percentuale 0-100
    const brightnessPercent = Math.round((bri / 254) * 100)

    const url = `https://${this.bridgeIp}/clip/v2/resource/light/${id}`
    const res = await hueFetch({
      url,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'hue-application-key': this.username
      },
      body: JSON.stringify({
        dimming: { brightness: brightnessPercent }
      })
    })
    const result = await safeJson(res)
    if (result.errors?.length) throw new Error(result.errors[0].description)
    return { success: true }
  }

  async setLightColor(lightId, colorParams) {
    if (this.demo) {
      clog(`DEMO MODE: Set color for light ${lightId} with params:`, colorParams)
      // Mappa i parametri Hue API (hue, sat, bri) allo stato interno demo
      const newState = { colormode: 'hs', ison: true } // Presume che l'impostazione del colore accenda la luce
      if (colorParams.hue !== undefined) newState.hue = colorParams.hue
      if (colorParams.sat !== undefined) newState.sat = colorParams.sat
      if (colorParams.bri !== undefined) newState.bri = colorParams.bri
      if (colorParams.ct !== undefined) {
        newState.ct = colorParams.ct
        newState.colormode = 'ct'
      }
      return this._handleDemoAction(lightId, newState)
    }
    if (!this.bridgeIp || !this.username)
      throw new Error('Bridge not configured')
    return await this.setLightColorV1(lightId, colorParams)

    /*try {
      return await this.setLightColorV2(lightId, colorParams)
    } catch {
      return await this.setLightColorV1(lightId, colorParams)
    }*/
  }

  async setLightColorV1(lightId, colorParams) {
    if (!this.bridgeIp || !this.username)
      throw new Error('Bridge not configured')

    const url = `http://${this.bridgeIp}/api/${this.username}/lights/${lightId}/state`
    const body = {}

    // Priorità: XY > CT > HS

    // 1. XY Color Mode (più accurato)
    if (colorParams.xy !== undefined && Array.isArray(colorParams.xy)) {
      const [x, y] = colorParams.xy
      // Verifica gamut (opzionale, il bridge lo fa comunque)
      const corrected = forceIntoGamut(x, y, 'C')
      body.xy = [corrected.x, corrected.y]
    }
    // 2. Color Temperature
    else if (colorParams.ct !== undefined) {
      body.ct = colorParams.ct
    }
    // 3. Hue/Saturation
    else {
      if (colorParams.hue !== undefined) body.hue = colorParams.hue
      if (colorParams.sat !== undefined) body.sat = colorParams.sat
    }

    // Brightness (sempre incluso se presente)
    if (colorParams.bri !== undefined) body.bri = colorParams.bri

    // Accendi la luce quando si imposta il colore
    if (Object.keys(body).length > 0) body.on = true

    clog('Setting color with body:', body)

    const res = await hueFetch({
      url,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const result = await safeJson(res)
    if (result[0]?.error) throw new Error(result[0].error.description)
    return { success: true }
  }

  async setLightColorV2(lightId, { hex, rgb }) {
    // V2 uses XY color space - convert from RGB
    // Simplified conversion (full implementation needed)
    const url = `https://${this.bridgeIp}/clip/v2/resource/light/${lightId}`
    const res = await hueFetch({
      url,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'hue-application-key': this.username
      },
      body: JSON.stringify({
        color: {
          xy: { x: 0.5, y: 0.5 } // Placeholder
        },
        on: { on: true } // Accendi quando imposti il colore
      })
    })
    const result = await safeJson(res)
    if (result.errors?.length) throw new Error(result.errors[0].description)
    return { success: true }
  }

  async toggleAllLights(on) {
    if (this.demo) {
      clog(`DEMO MODE: Toggle ALL lights to ${on}`)
      return this._handleDemoAction('all', on)
    }
    const url = `http://${this.bridgeIp}/api/${this.username}/groups/0/action`
    await hueFetch({
      url,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on })
    })
    return { success: true }
  }

  async applyScene(sceneId, groupId) {
    if (this.demo) {
      clog(`DEMO MODE: Apply scene ${sceneId} to group ${groupId}`)
      // In demo, applica i colori della scena alle luci del gruppo
      const scene = this.DEMO_STATE.scenes[sceneId]
      const group = this.DEMO_STATE.groups[groupId]

      if (scene && group) {
        group.lights.forEach(lightId => {
          const light = this.DEMO_STATE.lights[lightId]
          if (light) {
            light.ison = true
            // Puoi impostare colori/bri specifici della scena qui
          }
        })
        this._updateGroupState()
        return { success: true }
      }
      throw new Error('Demo scene or group not found')
    }

    if (!this.bridgeIp || !this.username)
      throw new Error('Bridge not configured')

    return await this.applySceneV1(sceneId, groupId)
  }

  async applySceneV1(sceneId, groupId) {
    const url = `http://${this.bridgeIp}/api/${this.username}/groups/${groupId}/action`
    const res = await hueFetch({
      url,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene: sceneId })
    })
    const result = await safeJson(res)
    if (result[0]?.error) throw new Error(result[0].error.description)
    return { success: true }
  }

  async getLightDetail(lightId) {
    if (this.demo) {
      clog(`DEMO MODE: Get light detail for ${lightId}`)
      const light = this.DEMO_STATE.lights[lightId]
      if (!light) throw new Error('Demo Light not found')

      return {
        ...light,
        hex: this.stateToHex({
          on: light.ison,
          bri: light.bri,
          hue: light.hue,
          sat: light.sat,
          ct: light.ct,
          xy: light.xy,
          colormode: light.colormode
        }),
        capabilities: light.capabilities
      }
    }

    // ✅ OTTIMIZZATO: Chiamata diretta singola luce invece di getAllLights()
    const url = `http://${this.bridgeIp}/api/${this.username}/lights/${lightId}`
    const res = await hueFetch({ url, method: 'GET' })
    const fullLight = await safeJson(res)

    if (Array.isArray(fullLight) && fullLight[0]?.error)
      throw new Error(fullLight[0].error.description)

    if (!fullLight || !fullLight.state)
      throw new Error('Light not found')

    const capabilities = this._parseCapabilities(fullLight.capabilities)

    // Mappiamo i dati come in _mapLightsV1
    return {
      id: lightId,
      name: fullLight.name || 'Unknown',
      ison: fullLight.state.on || false,
      bri: fullLight.state.bri || 0,
      hue: fullLight.state.hue || 0,
      sat: fullLight.state.sat || 0,
      ct: fullLight.state.ct || 0,
      xy: fullLight.state.xy || [0, 0],
      colormode: fullLight.state.colormode || '',
      modelid: fullLight.modelid || '',
      type: fullLight.type || '',
      reachable: fullLight.state.reachable !== false,
      hex: this.stateToHex(fullLight.state),
      capabilities: capabilities//this.getLightCapabilities(fullLight)
    }
  }

  // Helper per parsare le capabilities della bridge
  _parseCapabilities(bridgeCapabilities) {
    const caps = ['brightness']
    if (bridgeCapabilities?.control?.ct) {
      caps.push('ct')
    }
    if (bridgeCapabilities?.control?.colorgamut) {
      caps.push('color')
    }
    return caps
  }

  getLightCapabilities(light) {
    const caps = []
    if (light.state?.bri !== undefined) caps.push('brightness')
    if (light.state?.ct !== undefined) caps.push('ct')
    if (light.state?.hue !== undefined || light.state?.xy !== undefined) caps.push('color')
    return caps
  }


  async fetchAllData() {
    if (this.demo) {
      clog('DEMO MODE: Fetching all data mock')
      const lights = Object.values(this.DEMO_STATE.lights).map(l => this._mapLightToSimple(l))
      const groups = await this.getGroups()
      return {
        lights: lights,
        rooms: groups.rooms,
        zones: groups.zones,
        scenes: Object.values(this.DEMO_STATE.scenes)
      }
    }

    this.cancelFetch()

    // Create cancellation token
    const cancellationToken = { cancelled: false }
    this.currentFetchCancellation = cancellationToken

    try {
      // Check cancellation before fetch
      if (cancellationToken.cancelled) {
        throw new Error('Fetch cancelled')
      }

      const groups = await this.getGroups()

      if (cancellationToken.cancelled) {
        throw new Error('Fetch cancelled')
      }

      const lights = await this.getLights()

      if (cancellationToken.cancelled) {
        throw new Error('Fetch cancelled')
      }

      // Clear token on success
      this.currentFetchCancellation = null

      return {
        lights: lights,
        rooms: groups.rooms,
        zones: groups.zones,
        scenes: []
      }
    } catch (e) {
      this.currentFetchCancellation = null
      throw e
    }
  }

  // Funzione unificata per generare l'HEX dal color state
  // Funzione unificata per generare l'HEX dal color state
  stateToHex(s) {
    if (!s || !s.on) return '000000'

    const bri = s.bri || 254 // 0-254
    const colormode = s.colormode || ''

    // 1. Modalità XY (priorità più alta per accuratezza colore)
    if (colormode === 'xy' && s.xy && Array.isArray(s.xy)) {
      const [x, y] = s.xy
      if (x !== undefined && y !== undefined) {
        const { r, g, b } = xyBriToRgb(x, y, bri)
        return [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
      }
    }

    // 2. Modalità HS (Hue/Saturation)
    const hue = s.hue || 0 // 0-65535
    const sat = s.sat || 0 // 0-254

    if (colormode === 'hs' || hue > 0 || sat > 0) {
      const { r, g, b } = hsbToRgb(hue, sat, bri)
      return [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
    }

    // 3. Modalità CT (Color Temperature) - già gestita implicitamente
    // Le lampade in CT mode hanno hue=0 e sat=0, quindi finiscono nel caso white

    // 4. Bianco/Grigio (solo luminosità)
    const val = Math.round((bri / 254) * 255)
      .toString(16)
      .padStart(2, '0')
    return val + val + val
  }

  setManualBridgeIp(ip) {
    this.bridgeIp = ip
    this.saveConfig()
  }
}

// ============================================
// USAGE IN app-side/index.js
// ============================================

const hueBridge = new HueBridgeManager()

// The widget's taps answered in the last minute (ZML gives up on a request
// after 60 s), by the id the watch gave each tap
const WIDGET_TAP_MEMORY_MS = 60000
const recentWidgetTaps = new Map()
function rememberWidgetTap(tapId, answer) {
  const now = Date.now()
  for (const [id, tap] of recentWidgetTaps) {
    if (now - tap.at > WIDGET_TAP_MEMORY_MS) recentWidgetTaps.delete(id)
  }
  recentWidgetTaps.set(tapId, { at: now, answer })
}

AppSideService(
  BaseSideService({
    onInit() {
      clog('App side service initializing...')
      // A release build after a test one: the lines it left are dropped
      if (!logsEnabled() && settingsLib.getItem(LOG_KEY)) settingsLib.removeItem(LOG_KEY)
      plog(`phone service started (log level ${LOG_LEVEL}): bridge ${hueBridge.bridgeIp ? 'set' : 'not set'}, key ${hueBridge.username ? 'set' : 'not set'}, demo ${hueBridge.demo ? 'on' : 'off'}`)
    },

    onRun() {
      clog('App side service running')
    },

    onDestroy() {
      clog('App side service destroyed')
      plog('phone service stopped')
      hueBridge.cancelAllOperations()
    },

    onSettingsChange({ key, newValue, oldValue }) {
      // The Logs box's own writes: no line about them (each line would
      // write the store again)
      if (key === LOG_KEY) return
      clog('Settings changed:', key)
      // Values stay out: the bridge key and address are among them
      if (key === DEMO_MODE) plog(`[settings] demo mode ${newValue === 'true' || newValue === true ? 'on' : 'off'}`)
      else vlog(`[settings] ${key} ${newValue === undefined || newValue === null ? 'removed' : 'changed'}`)

      switch (key) {
        case 'data:clear': {
          // Action needed: clear all stored data
          this.settings.clear()
          hueBridge.reloadConfig()
          clog('Settings cleared!')
          break
        }

        // The settings page edited the bridge's IP or cleared the config:
        // the bridge manager read them once at start and kept using the old
        // ones until the Zepp app was restarted
        case BRIDGE_IP_KEY:
        case USERNAME_KEY:
        case API_VERSION_KEY:
          hueBridge.applyStoredValue(key, newValue)
          plog(`[settings] bridge config now: bridge ${hueBridge.bridgeIp ? 'set' : 'not set'}, key ${hueBridge.username ? 'set' : 'not set'}${hueBridge.demo ? ' (demo on: used when it is turned off)' : ''}`)
          break

        case DEMO_MODE: {
          // Action needed: update demo mode in memory
          const isDemoMode = newValue === 'true' || newValue === true
          clog('Demo mode changed to:', isDemoMode)

          hueBridge.demo = isDemoMode

          if (isDemoMode) {
            hueBridge._initDemoState()
            clog('Demo mode enabled - initialized demo state')
          } else {
            // A service started in demo mode held the demo's dummy address
            // and key: the real ones come back from the storage
            hueBridge.reloadConfig()
            clog('Demo mode disabled')
          }
          break
        }

        // No action needed - read on-demand
        case SHOW_SCENES:
        case DISPLAY_ORDER:
        case FAVORITE_COLORS:
          clog('User preference updated:', key)
          // Settings automatically picked up next time getUserSettings() is called
          break

        default:
          clog('Unhandled setting change:', key)
      }
    },

    onRequest(req, reply) {
      // The watch's lines for the Logs box: stored, never logged themselves
      if (req.method === 'debug.deviceLog') {
        writeLines([].concat((req.params && req.params.lines) || []).map((line) => `[w] ${line}`))
        reply(null, {})
        return
      }

      clog('Received request:', req.method)
      // Every answer gets a line: what was asked, how long it took, how it
      // ended. The user's actions at info, the reads at trace, failures always
      const t0 = Date.now()
      const asked = `${req.method}${paramsForLog(req.params)}`
      const res = (err, data) => {
        const ms = Date.now() - t0
        if (err) wlog(`[req] ${asked} failed in ${ms}ms: ${errorText(err)}`)
        else if (data && data.success === false) wlog(`[req] ${asked} answered without success in ${ms}ms${resultForLog(data)}`)
        else if (ACTION_METHODS.has(req.method)) plog(`[req] ${asked} ok in ${ms}ms${resultForLog(data)}`)
        else vlog(`[req] ${asked} ok in ${ms}ms${resultForLog(data)}`)
        reply(err, data)
      }

      switch (req.method) {
        case 'GET_USER_SETTINGS':
          this.handleGetUserSettings(res)
          break

        case 'GET_FAVORITE_COLORS':
          this.handleGetFavoriteColors(res)
          break

        case 'ADD_FAVORITE_COLOR':
          this.handleAddFavoriteColor(req, res)
          break

        case 'REMOVE_FAVORITE_COLOR':
          this.handleRemoveFavoriteColor(req, res)
          break

        case 'RESET_FAVORITE_COLORS':
          this.handleResetFavoriteColors(res)
          break

        case 'CHECK_CONNECTION':
          this.handleCheckConnection(res)
          break

        case 'DISCOVER_BRIDGES':
          this.handleDiscoverBridges(res)
          break

        case 'PAIR':
          this.handlePair(req, res)
          break

        case 'GET_LIGHTS':
          this.handleGetLights(res)
          break

        case 'GET_LIGHT_DETAIL':
          this.handleGetLightDetail(req, res)
          break

        case 'TOGGLE_LIGHT':
          this.handleToggleLight(req, res)
          break

        case 'SET_BRIGHTNESS':
          this.handleSetBrightness(req, res)
          break

        case 'SET_COLOR':
          this.handleSetColor(req, res)
          break

        case 'SET_HS': // Nuovo caso richiesto per Hue e Saturation
          this.handleSetHS(req, res)
          break

        case 'SET_XY':
          this.handleSetXY(req, res)
          break

        case 'ALL_LIGHTS':
          this.handleAllLights(req, res)
          break

        case 'SET_MANUAL_IP':
          this.handleSetManualIp(req, res)
          break

        case 'GET_CONFIG_STATUS':
          this.handleGetConfigStatus(res)
          break

        case 'CLEAR_CONFIG':
          this.handleClearConfig(res)
          break

        case 'FETCH_ALL_DATA':
          this.handleFetchAllData(res)
          break

        case 'GET_GROUPS':
          this.handleGetGroups(res)
          break

        case 'TOGGLE_GROUP':
          this.handleToggleGroup(req, res)
          break

        case 'GET_GROUP_DETAIL':
          this.handleGetGroupDetail(req, res)
          break

        case 'APPLY_SCENE':
          this.handleApplyScene(req, res)
          break

        case 'WIDGET_TOGGLE_LIGHT':
          this.handleWidgetToggleLight(req, res)
          break

        case 'CANCEL_PAIRING':
          this.handleCancelPairing(res)
          break

        case 'CANCEL_DISCOVERY':
          this.handleCancelDiscovery(res)
          break

        case 'CANCEL_FETCH':
          this.handleCancelFetch(res)
          break

        case 'CANCEL_ALL':
          this.handleCancelAll(res)
          break

        default:
          cerr('Unknown method:', req.method)
          res({ error: 'Unknown method: ' + req.method })
      }
    },

    async handleGetUserSettings(res) {
      try {
        clog('Retrieving user settings...')
        const settings = hueBridge.getUserSettings()
        res(null, { success: true, settings })
      } catch (error) {
        cerr('Get user settings error:', error)
        res({ error: error.message })
      }
    },

    async handleGetFavoriteColors(res) {
      try {
        clog('Getting favorite colors...')
        const settings = hueBridge.getUserSettings()
        clog('Favorite colors from settings:', settings.favorite_colors)
        res(null, {
          success: true,
          colors: settings.favorite_colors || DEFAULT_PRESETS
        })
      } catch (error) {
        cerr('Get favorite colors error:', error)
        res({ error: error.message })
      }
    },

    async handleAddFavoriteColor(req, res) {
      try {
        const { colorData } = req.params
        clog('Adding favorite color:', colorData)

        const result = hueBridge.addFavoriteColor(colorData)
        res(null, result)
      } catch (error) {
        cerr('Add favorite color error:', error)
        res({ error: error.message })
      }
    },

    async handleRemoveFavoriteColor(req, res) {
      try {
        const { favoriteId } = req.params
        clog('Removing favorite color at index:', favoriteId)
        const result = hueBridge.removeFavoriteColor(favoriteId)
        res(null, result)
      } catch (error) {
        cerr('Remove favorite color error:', error)
        res({ error: error.message })
      }
    },

    async handleResetFavoriteColors(res) {
      try {
        clog('Resetting favorite colors to defaults...')
        const result = hueBridge.resetFavoriteColors()
        res(null, result)
      } catch (error) {
        cerr('Reset favorite colors error:', error)
        res({ error: error.message })
      }
    },

    async handleCheckConnection(res) {
      try {
        clog('Checking connection...')
        const status = await hueBridge.checkConnection()
        res(null, status)
      } catch (error) {
        cerr('Check connection error:', error)
        res(null, { connected: false, reason: error.message })
      }
    },

    async handleDiscoverBridges(res) {
      try {
        clog('Discovering bridges...')
        const bridges = await hueBridge.discoverBridges()

        res(null, {
          success: true,
          bridges: bridges.map(b => ({
            id: b.id,
            ip: b.internalipaddress,
            name: b.name || 'Philips Hue'
          })),
          autoSelected: bridges.length > 0 ? bridges[0].internalipaddress : null
        })
      } catch (error) {
        cerr('Discovery error:', error)
        res({ error: error.message })
      }
    },

    async handlePair(req, res) {
      try {
        clog('Starting pairing...')
        //const result = await hueBridge.pair()
        const result = await hueBridge.pairWithRetry(10, 2000)
        res(null, result)
      } catch (error) {
        cerr('Pairing error:', error)

        if (error.message === 'BUTTON_NOT_PRESSED') {
          res({
            error: 'BUTTON_NOT_PRESSED',
            message: 'Press the link button on the bridge and try again'
          })
        } else {
          res({ error: error.message })
        }
      }
    },

    async handleGetLights(res) {
      try {
        clog('Getting lights...')
        const lights = await hueBridge.getLights()

        res(null, {
          success: true,
          lights: lights
        })
      } catch (error) {
        cerr('Get lights error:', error)
        res({ error: error.message })
      }
    },

    async handleToggleLight(req, res) {
      try {
        const { lightId, state } = req.params
        clog(`Toggle light ${lightId} to ${state}`)

        const result = await hueBridge.toggleLight(lightId, state)
        res(null, result)
      } catch (error) {
        cerr('Toggle light error:', error)
        res({ error: error.message })
      }
    },

    async handleSetBrightness(req, res) {
      try {
        const { lightId, bri } = req.params
        clog(`Set brightness ${lightId} to ${bri}`)

        await hueBridge.setLightBrightness(lightId, bri)
        res(null, { success: true })
      } catch (error) {
        cerr('Set brightness error:', error)
        res({ error: error.message })
      }
    },

    async handleSetColor(req, res) {
      try {
        const { lightId, hex, rgb, hue, sat, bri, ct, xy } = req.params
        clog(`Set color ${lightId} - xy: ${xy}, ct: ${ct}, hue: ${hue}, hex: ${hex}`)

        let colorParams = {}

        // Priorità: XY > CT > HS > RGB

        // 1. Se abbiamo coordinate XY direttamente
        if (xy && Array.isArray(xy) && xy.length === 2) {
          clog('Using XY coordinates:', xy)
          colorParams.xy = xy
          if (bri !== undefined) colorParams.bri = bri
        }
        // 2. Se abbiamo Color Temperature
        else if (ct !== undefined) {
          clog('Using CT mode:', ct)
          colorParams.ct = ct
          if (bri !== undefined) colorParams.bri = bri
        }
        // 3. Se abbiamo Hue/Sat
        else if (hue !== undefined && sat !== undefined) {
          clog('Using HS mode')
          colorParams.hue = hue
          colorParams.sat = sat
          if (bri !== undefined) colorParams.bri = bri
        }
        // 4. Se abbiamo RGB, converti in XY (più accurato di HS)
        else if (rgb && rgb.r !== undefined && rgb.g !== undefined && rgb.b !== undefined) {
          clog('Converting RGB to XY...')
          const xyBri = rgbToXy(rgb.r, rgb.g, rgb.b)
          colorParams.xy = [xyBri.x, xyBri.y]
          colorParams.bri = bri !== undefined ? bri : xyBri.bri
        }

        // Rimuove parametri null/undefined
        Object.keys(colorParams).forEach(key => {
          if (colorParams[key] === null || colorParams[key] === undefined) {
            delete colorParams[key]
          }
        })

        await hueBridge.setLightColor(lightId, colorParams)
        res(null, { success: true })
      } catch (error) {
        cerr('Set color error:', error)
        res({ error: error.message })
      }
    },

    async handleSetHS(req, res) {
      try {
        const { lightId, hue, sat, bri } = req.params
        clog(`Set HSB for light ${lightId} - H:${hue}, S:${sat}, B:${bri}`)

        if (lightId === undefined || hue === undefined || sat === undefined) {
          throw new Error('Missing lightId, hue, or sat parameter')
        }

        // Passa direttamente hue, sat, e brightness (se presente)
        const colorParams = { hue: hue, sat: sat }
        if (bri !== undefined) {
          colorParams.bri = bri
        }

        await hueBridge.setLightColor(lightId, colorParams)
        res(null, { success: true })
      } catch (error) {
        cerr('Set HSB error:', error)
        res({ error: error.message })
      }
    },

    async handleSetXY(req, res) {
      try {
        const { lightId, x, y, bri } = req.params
        clog(`Set XY for light ${lightId} - X:${x}, Y:${y}, B:${bri}`)

        if (lightId === undefined || x === undefined || y === undefined) {
          throw new Error('Missing lightId, x, or y parameter')
        }

        // Forza nel gamut se necessario
        const corrected = forceIntoGamut(x, y, 'C')

        const colorParams = { xy: [corrected.x, corrected.y] }
        if (bri !== undefined) {
          colorParams.bri = bri
        }

        await hueBridge.setLightColor(lightId, colorParams)
        res(null, { success: true })
      } catch (error) {
        cerr('Set XY error:', error)
        res({ error: error.message })
      }
    },

    async handleAllLights(req, res) {
      try {
        const { state } = req.params
        clog(`Toggle all lights to ${state}`)

        await hueBridge.toggleAllLights(state)
        res(null, { success: true })
      } catch (error) {
        cerr('All lights error:', error)
        res({ error: error.message })
      }
    },

    async handleSetManualIp(req, res) {
      try {
        const { ip } = req.params
        clog('Setting manual IP:', ip)

        hueBridge.setManualBridgeIp(ip)
        res(null, { success: true })
      } catch (error) {
        cerr('Set manual IP error:', error)
        res({ error: error.message })
      }
    },

    async handleGetConfigStatus(res) {
      try {
        clog('Getting config status...')

        // Whether they are set, not their values: the watch has no use for
        // the bridge key
        const status = {
          hasBridgeIp: !!hueBridge.bridgeIp,
          hasKey: !!hueBridge.username,
          apiVersion: hueBridge.apiVersion,
          isConfigured: !!(hueBridge.bridgeIp && hueBridge.username)
        }

        clog('Config status:', status)
        res(null, status)

      } catch (error) {
        cerr('Get config status error:', error)
        res({ error: error.message })
      }
    },

    async handleClearConfig(res) {
      try {
        clog('Clearing config...')
        hueBridge.clearConfig()
        res(null, { success: true })
      } catch (error) {
        cerr('Clear config error:', error)
        res({ error: error.message })
      }
    },

    async handleFetchAllData(res) {
      try {
        clog('Fetching all data...')
        const data = await hueBridge.fetchAllData()

        res(null, {
          success: true,
          data: data
        })
      } catch (error) {
        cerr('Fetch all data error:', error)
        res({ error: error.message })
      }
    },

    async handleGetGroups(res) {
      try {
        clog('Getting groups...')
        const groups = await hueBridge.getGroups()
        //Recupera user settings
        const userSettings = hueBridge.getUserSettings();

        res(null, {
          success: true,
          data: {
            rooms: groups.rooms,
            zones: groups.zones,
            userSettings: userSettings
          }
        })
      } catch (error) {
        cerr('Get groups error:', error)
        res({ error: error.message })
      }
    },

    async handleToggleGroup(req, res) {
      try {
        const { groupId, state } = req.params
        clog(`Toggle group ${groupId} to ${state}`)

        await hueBridge.toggleGroup(groupId, state)
        res(null, { success: true })
      } catch (error) {
        cerr('Toggle group error:', error)
        res({ error: error.message })
      }
    },

    async handleGetGroupDetail(req, res) {
      try {
        const groupId = req?.params?.groupId;

        if (!groupId) {
          cerr('Missing group ID in request.')
          res({ error: 'Missing group ID in request.' })
          return;
        }

        clog('Getting group detail for:', groupId);

        // ✅ Recupera dati gruppo
        const groupDetails = await hueBridge.getGroupDetail(groupId);

        // ✅ Recupera user settings
        //const userSettings = hueBridge.getUserSettings();

        // ✅ Ritorna tutto insieme
        res(null, {
          success: true,
          data: {
            ...groupDetails, // lights, scenes
            //userSettings // ← AGGIUNTO
          }
        });
      } catch (error) {
        cerr('Get group detail error:', error);
        res({ error: error.message });
      }
    },

    async handleApplyScene(req, res) {
      try {
        const { sceneId, groupId } = req.params
        clog(`Apply scene ${sceneId} to group ${groupId}`)

        await hueBridge.applyScene(sceneId, groupId)
        res(null, { success: true })
      } catch (error) {
        cerr('Apply scene error:', error)
        res({ error: error.message })
      }
    },

    async handleGetLightDetail(req, res) {
      try {
        const { lightId } = req.params
        clog('Getting light detail for ID:', lightId)

        const lightDetail = await hueBridge.getLightDetail(lightId)
        clog('Light detail retrieved:', lightDetail)
        res(null, {
          success: true,
          data: { light: lightDetail }
        })
      } catch (error) {
        cerr('Get light detail error:', error)
        res({ error: error.message })
      }
    },

    // A pure toggle (reads the light, sends the opposite), so a request
    // delivered twice (seen ~5 s apart, field-notes.md "Messaging") switched
    // the light on and back off. The watch names each tap (tapId): a tap seen
    // already gets the first one's answer, and the light is toggled once
    async handleWidgetToggleLight(req, firstRes) {
      const tapId = req.params && req.params.tapId
      const seen = tapId ? recentWidgetTaps.get(tapId) : null
      if (seen) {
        wlog(`[widget] tap ${tapId} delivered again ${Date.now() - seen.at}ms later: answered as the first, light not toggled again`)
        seen.answer.then(({ err, data }) => firstRes(err, data))
        return
      }
      let settle
      const answer = new Promise((resolve) => { settle = resolve })
      if (tapId) rememberWidgetTap(tapId, answer)
      const res = (err, data) => {
        settle({ err, data })
        firstRes(err, data)
      }

      try {
        const { lightId } = req.params
        clog('Widget toggle light:', lightId)

        // Handle demo mode
        if (hueBridge.demo) {
          clog('DEMO MODE: Widget toggle light', lightId)
          const light = hueBridge.DEMO_STATE.lights[lightId]
          if (!light) {
            res({ error: 'Demo Light not found' })
            return
          }

          // Toggle the light state
          const newState = !light.ison
          hueBridge._handleDemoAction(lightId, { ison: newState })

          res(null, { success: true, newState })
          return
        }

        // Normal mode - requires bridge configuration
        if (!hueBridge.bridgeIp || !hueBridge.username) {
          res({ error: 'Bridge not configured' })
          return
        }

        // Get current state to toggle
        const url = `http://${hueBridge.bridgeIp}/api/${hueBridge.username}/lights/${lightId}`
        const stateRes = await hueFetch({ url, method: 'GET' })
        const lightData = typeof stateRes.body === 'string' ? JSON.parse(stateRes.body) : stateRes.body

        const currentState = lightData?.state?.on || false
        const newState = !currentState

        // Toggle
        const toggleUrl = `http://${hueBridge.bridgeIp}/api/${hueBridge.username}/lights/${lightId}/state`
        await hueFetch({
          url: toggleUrl,
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ on: newState })
        })

        res(null, { success: true, newState })
      } catch (error) {
        cerr('Widget toggle light error:', error)
        res({ error: error.message })
      }
    },

    async handleCancelPairing(res) {
      try {
        clog('Cancelling pairing...')
        hueBridge.cancelPairing()
        res(null, { success: true, message: 'Pairing cancelled' })
      } catch (error) {
        cerr('Cancel pairing error:', error)
        res({ error: error.message })
      }
    },

    async handleCancelDiscovery(res) {
      try {
        clog('Cancelling discovery...')
        hueBridge.cancelDiscovery()
        res(null, { success: true, message: 'Discovery cancelled' })
      } catch (error) {
        cerr('Cancel discovery error:', error)
        res({ error: error.message })
      }
    },

    async handleCancelFetch(res) {
      try {
        clog('Cancelling fetch...')
        hueBridge.cancelFetch()
        res(null, { success: true, message: 'Fetch cancelled' })
      } catch (error) {
        cerr('Cancel fetch error:', error)
        res({ error: error.message })
      }
    },

    async handleCancelAll(res) {
      try {
        clog('Cancelling all operations...')
        hueBridge.cancelAllOperations()
        res(null, { success: true, message: 'All operations cancelled' })
      } catch (error) {
        cerr('Cancel all error:', error)
        res({ error: error.message })
      }
    },


  })
)