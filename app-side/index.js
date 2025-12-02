import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'

// ============================================
// 1. CONFIGURAZIONE DEMO
// Imposta a 'true' per ignorare le chiamate di rete e usare i dati fittizi.
const DEMO = false
// ============================================

const BRIDGE_IP_KEY = 'hue_bridge_ip'
const USERNAME_KEY = 'hue_username'
const API_VERSION_KEY = 'hue_api_version'

// --- Nuova funzione: HSB (0-65535, 0-254, 0-254) a RGB (0-255) ---
function hsbToRgb(h, s, v) {
  h = h / 65535 * 360 // Hue API (0-65535) -> 0-360
  s = s / 254         // Sat API (0-254) -> 0-1
  v = v / 254         // Bri API (0-254) -> 0-1

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
      case 0: r = v; g = t; b = p; break
      case 1: r = q; g = v; b = p; break
      case 2: r = p; g = v; b = t; break
      case 3: r = p; g = q; b = v; break
      case 4: r = t; g = p; b = v; break
      case 5: r = v; g = p; b = q; break
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
    hue: Math.round(h / 360 * 65535), // Hue API usa 0-65535
    sat: Math.round(s * 254),          // Hue API usa 0-254
    bri: Math.round(bri * 254)         // Hue API usa 0-254
  }
}

async function safeJson(resp) {
  console.log('safeJson:', resp)
  try {
    if (resp.json) return await resp.json()
    if (typeof resp.body === 'string') return JSON.parse(resp.body)
    if (resp.data) return JSON.parse(resp.data)
  } catch (e) {
    console.error('JSON parse error:', e, resp)
  }
  return {}
}

class HueBridgeManager {
  constructor() {
      console.log('HueBridgeManager initializing')
    this.bridgeIp = settingsLib.getItem(BRIDGE_IP_KEY) || null
    this.username = settingsLib.getItem(USERNAME_KEY) || null
    this.apiVersion = settingsLib.getItem(API_VERSION_KEY) || 'v1'

    // --- LOGICA DEMO ---
    if (DEMO) {
        this._initDemoState()
        this.bridgeIp = '192.168.1.100' // Dummy IP
        this.username = 'DEMO_USER_HUE' // Dummy Username
        this.apiVersion = 'v1'
    }
    // --------------------

    console.log('HueBridgeManager initialized:', {
      bridgeIp: this.bridgeIp,
      username: this.username,
      apiVersion: this.apiVersion
    })
  }

  // --- Funzioni per lo stato DEMO ---
  _initDemoState() {
      this.DEMO_STATE = {
          lights: {
              '1': { id: '1', name: 'Lampada Soggiorno', ison: true, bri: 200, hue: 46920, sat: 254, ct: 0, colormode: 'hs', reachable: true, capabilities: ['brightness', 'color'] }, // Blu
              '2': { id: '2', name: 'Striscia Cucina', ison: false, bri: 100, hue: 0, sat: 0, ct: 350, colormode: 'ct', reachable: true, capabilities: ['brightness', 'ct'] }, // Spenta, bianca calda
              '3': { id: '3', name: 'Scrivania', ison: true, bri: 150, hue: 13000, sat: 254, ct: 0, colormode: 'hs', reachable: true, capabilities: ['brightness', 'color'] }, // Verde/Giallo
              '4': { id: '4', name: 'Giardino (No Segnale)', ison: true, bri: 254, hue: 0, sat: 0, ct: 0, colormode: 'bri', reachable: false, capabilities: ['brightness'] }, // Non raggiungibile
          },
          groups: {
              '1': { id: '1', name: 'Soggiorno', type: 'Room', lights: ['1', '3'], state: { all_on: false, any_on: true } },
              '2': { id: '2', name: 'Casa Intera', type: 'Zone', lights: ['1', '2', '3', '4'], state: { all_on: false, any_on: true } },
              '3': { id: '3', name: 'Esterno', type: 'Zone', lights: ['4'], state: { all_on: false, any_on: true } }
          },
          scenes: {
              's1': { id: 's1', name: 'Lettura', group: '1', color: '#6A5ACD' },
              's2': { id: 's2', name: 'Relax', group: '1', color: '#ADD8E6' }
          }
      }
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
    if (DEMO) return // Non salvare configurazioni dummy
    settingsLib.setItem(BRIDGE_IP_KEY, this.bridgeIp)
    settingsLib.setItem(USERNAME_KEY, this.username)
    settingsLib.setItem(API_VERSION_KEY, this.apiVersion)
    console.log('Hue config saved:', {
      bridgeIp: this.bridgeIp,
      username: this.username,
      apiVersion: this.apiVersion
    })
  }

  clearConfig() {
    if (DEMO) {
        this._initDemoState()
        console.log('DEMO MODE: Config cleared (reset to initial demo state)')
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
    if (DEMO) {
        console.log('DEMO MODE: Discovering bridges mock')
        const bridges = [{ id: 'demo-1', internalipaddress: this.bridgeIp, name: 'Demo Hue Bridge' }]
        this.saveConfig()
        return bridges
    }

    console.log('Discovering bridges...')
    const res = await fetch({
      url: 'https://discovery.meethue.com',
      method: 'GET',
      timeout: 5000,
      headers: { 'Accept': 'application/json' }
    }).catch((e) => {
      console.log('fetch=>', e)
    })
    const bridges = await safeJson(res)
    if (!Array.isArray(bridges) || bridges.length === 0)
      throw new Error('No bridges found on network')
    this.bridgeIp = bridges[0].internalipaddress
    this.saveConfig()
    return bridges
  }

  async pair() {
    if (DEMO) {
        console.log('DEMO MODE: Pairing success')
        return { success: true, username: this.username, bridgeIp: this.bridgeIp }
    }
    if (!this.bridgeIp) throw new Error('No bridge IP configured')
    console.log('Pairing bridge (v1 API)...')
    return await this.pairV1()
  }

  async pairWithRetry(maxRetries = 5, delayMs = 3000) {
    if (DEMO) {
        return this.pair()
    }
    if (!this.bridgeIp) throw new Error('No bridge IP configured')

    let attempt = 0
    while (attempt < maxRetries) {
      attempt++
      try {
        console.log(`Pairing attempt ${attempt}/${maxRetries}...`)
        const result = await this.pairV1()
        console.log('Pairing successful:', result)
        return result
      } catch (e) {
        if (e.message === 'BUTTON_NOT_PRESSED') {
          console.warn('Bridge button not pressed, waiting and retrying...')
          await new Promise(r => setTimeout(r, delayMs))
        } else {
          // altri errori li rilanciamo subito
          throw e
        }
      }
    }

    throw new Error('Failed to pair: button not pressed within retry limit')
  }

  async pairV1() {
    if (DEMO) {
        return this.pair()
    }
    const url = `http://${this.bridgeIp}/api`
    const res = await fetch({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devicetype: 'zeppos_hue#watch' })
    })
    const result = await safeJson(res)
    console.log('Pair result:', result)

    if (!Array.isArray(result) || !result[0]) throw new Error('Bad bridge response')
    if (result[0].error) {
      const err = result[0].error
      if (err.type === 101) throw new Error('BUTTON_NOT_PRESSED')
      throw new Error(err.description || 'Pairing failed')
    }

    this.username = result[0].success.username
    this.apiVersion = 'v1'
    this.saveConfig()
    return { success: true, username: this.username, bridgeIp: this.bridgeIp }
  }

  async checkConnection() {
    if (DEMO) {
        console.log('DEMO MODE: Connection check success')
        return { connected: true }
    }
    if (!this.bridgeIp || !this.username) {
      console.log('Not configured')
      return { connected: false, reason: 'Not configured' }
    }
    try {
      console.log('configured')
      await this.getLights()
      return { connected: true }
    } catch (e) {
      console.error('Connection failed:', e)
      return { connected: false, reason: e.message }
    }
  }

  async getGroups() {
    if (DEMO) {
        console.log('DEMO MODE: Get groups mock')
        return { 
            rooms: Object.values(this.DEMO_STATE.groups).filter(g => g.type === 'Room'),
            zones: Object.values(this.DEMO_STATE.groups).filter(g => g.type === 'Zone')
        }
    }
    if (!this.bridgeIp || !this.username)
      throw new Error('Bridge not configured')
    return await this.getGroupsV1()
    /*try {
      return await this.getGroupsV2()
    } catch {
      return await this.getGroupsV1()
    }*/
  }

  async getGroupsV1() {
    const url = `http://${this.bridgeIp}/api/${this.username}/groups`
    const res = await fetch({ url, method: 'GET' })
    const json = await safeJson(res)

    if (Array.isArray(json) && json[0]?.error)
      throw new Error(json[0].error.description)

    return this._mapGroupsV1(json)
  }

  async getGroupsV2() {
    const url = `https://${this.bridgeIp}/clip/v2/resource/room`
    const res = await fetch({
      url,
      method: 'GET',
      headers: { 'hue-application-key': this.username }
    })
    const json = await safeJson(res)
    if (json.errors?.length) throw new Error(json.errors[0].description)

    const rooms = this._mapGroupsV2(json.data || [], 'room')

    // Get zones
    const zonesUrl = `https://${this.bridgeIp}/clip/v2/resource/zone`
    const zonesRes = await fetch({
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
    if (DEMO) {
        console.log(`DEMO MODE: Toggle group ${groupId} to ${state}`)
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
    const res = await fetch({
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
    const res = await fetch({
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
    if (DEMO) {
        console.log(`DEMO MODE: Get group detail for ${groupId}`)
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
    const res = await fetch({ url, method: 'GET' })
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
    if (DEMO) {
        console.log(`DEMO MODE: Get scenes for group ${groupId}`)
        return Object.values(this.DEMO_STATE.scenes)
            .filter(s => s.group === groupId)
            .map(s => ({ id: s.id, name: s.name, color: s.color }))
    }
    const url = `http://${this.bridgeIp}/api/${this.username}/scenes`
    const res = await fetch({ url, method: 'GET' })
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
    if (DEMO) {
        console.log('DEMO MODE: Get lights mock')
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
      console.warn('v2 getLights failed, fallback to v1:', e.message)
    }*/
    return await this.getLightsV1()
  }

  async getLightsV1() {
    const url = `http://${this.bridgeIp}/api/${this.username}/lights`
    const res = await fetch({ url, method: 'GET' })
    const json = await safeJson(res)
    if (Array.isArray(json) && json[0]?.error)
      throw new Error(json[0].error.description)
    return this._mapLightsV1(json)
  }

  async getLightsV2() {
    const url = `https://${this.bridgeIp}/clip/v2/resource/light`
    const res = await fetch({
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
        bri: l.bri,
        hue: l.hue,
        sat: l.sat,
        ct: l.ct,
        colormode: l.colormode
    }
    return {
        id: l.id,
        name: l.name,
        ison: l.ison,
        bri: l.bri,
        ct: l.ct,
        colormode: l.colormode,
        reachable: l.reachable,
        hex: this.stateToHex(state)
    }
  }

  _mapLightsV1(data) {
    return Object.entries(data).map(([id, l]) => ({
      id,
      name: l.name,
      ison: l.state.on,
      bri: l.state.bri,
      ct: l.state.ct,
      colormode: l.state.colormode,
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
    if (DEMO) {
        console.log(`DEMO MODE: Toggle light ${id} to ${state}`)
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
    const res = await fetch({
      url,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on: state })
    })
    const result = await safeJson(res)
    if (result[0]?.error) throw new Error(result[0].error.description)
    return { success: true }
  }

  async toggleLightV2(id, state) {
    const url = `https://${this.bridgeIp}/clip/v2/resource/light/${id}`
    const res = await fetch({
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

  async setLightBrightness(id, brightness) {
    if (DEMO) {
        console.log(`DEMO MODE: Set brightness for light ${id} to ${brightness}`)
        return this._handleDemoAction(id, { bri: brightness, colormode: 'bri' })
    }
    if (!this.bridgeIp || !this.username)
      throw new Error('Bridge not configured')
    return await this.setLightBrightnessV1(id, brightness)

    /*try {
      return await this.setLightBrightnessV2(id, brightness)
    } catch {
      return await this.setLightBrightnessV1(id, brightness)
    }*/
  }

  async setLightBrightnessV1(id, brightness) {
    const url = `http://${this.bridgeIp}/api/${this.username}/lights/${id}/state`
    const res = await fetch({
      url,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bri: brightness })
    })
    const result = await safeJson(res)
    if (result[0]?.error) throw new Error(result[0].error.description)
    return { success: true }
  }

  async setLightBrightnessV2(id, brightness) {
    // V2 usa percentuale 0-100
    const brightnessPercent = Math.round((brightness / 254) * 100)

    const url = `https://${this.bridgeIp}/clip/v2/resource/light/${id}`
    const res = await fetch({
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
    if (DEMO) {
        console.log(`DEMO MODE: Set color for light ${lightId} with params:`, colorParams)
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

    // Aggiunto: CT (Priorità del bridge)
    if (colorParams.ct !== undefined) body.ct = colorParams.ct

    // Hue, Sat e Bri (Gestiti dalla pulizia in handleSetColor, quindi se arrivano sono validi)
    if (colorParams.hue !== undefined) body.hue = colorParams.hue
    if (colorParams.sat !== undefined) body.sat = colorParams.sat
    if (colorParams.bri !== undefined) body.bri = colorParams.bri
    
    // Per assicurarsi che la luce si accenda quando si imposta il colore
    if (Object.keys(body).length > 0) body.on = true


    console.log('Setting color with body:', body)

    const res = await fetch({
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
    const res = await fetch({
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
    if (DEMO) {
        console.log(`DEMO MODE: Toggle ALL lights to ${on}`)
        return this._handleDemoAction('all', on)
    }
    const url = `http://${this.bridgeIp}/api/${this.username}/groups/0/action`
    await fetch({
      url,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on })
    })
    return { success: true }
  }


  async getLightDetail(lightId) {
    if (DEMO) {
        console.log(`DEMO MODE: Get light detail for ${lightId}`)
        const light = this.DEMO_STATE.lights[lightId]
        if (!light) throw new Error('Demo Light not found')

        // I dati nello stato demo sono già dettagliati, basta aggiungere l'hex
        return {
            ...light,
            hex: this.stateToHex({
                on: light.ison,
                bri: light.bri,
                hue: light.hue,
                sat: light.sat
            }),
            capabilities: light.capabilities
        }
    }
    const allLights = await this.getLights()
    const light = allLights.find(l => l.id === lightId)

    if (!light) throw new Error('Light not found')

    // Get full light info
    const url = `http://${this.bridgeIp}/api/${this.username}/lights/${lightId}`
    const res = await fetch({ url, method: 'GET' })
    const fullLight = await safeJson(res)

    if (Array.isArray(fullLight) && fullLight[0]?.error)
      throw new Error(fullLight[0].error.description)

    return {
      ...light,
      hue: fullLight.state?.hue || 0,
      sat: fullLight.state?.sat || 0,
      ct: fullLight.state?.ct || 0,
      colormode: fullLight.state?.colormode || '',
      capabilities: this.getLightCapabilities(fullLight)
    }
  }

  getLightCapabilities(light) {
    const caps = []
    if (light.state?.bri !== undefined) caps.push('brightness')
    if (light.state?.hue !== undefined) caps.push('color')
    return caps
  }



  // In HueBridgeManager
  async fetchAllData() {
    if (DEMO) {
        console.log('DEMO MODE: Fetching all data mock')
        const lights = Object.values(this.DEMO_STATE.lights).map(l => this._mapLightToSimple(l))
        const groups = await this.getGroups()
        return {
            lights: lights,
            rooms: groups.rooms,
            zones: groups.zones,
            scenes: Object.values(this.DEMO_STATE.scenes)
        }
    }

    const groups = await this.getGroups()
    const lights = await this.getLights()

    return {
      lights: lights,
      rooms: groups.rooms,
      zones: groups.zones,
      scenes: []   // TODO
    }
  }

  // Funzione unificata per generare l'HEX dal color state
  stateToHex(s) {
    if (!s || !s.on) return '000000'

    const bri = s.bri || 254 // 0-254
    const hue = s.hue || 0   // 0-65535
    const sat = s.sat || 0   // 0-254

    // Se è un colore (colormode 'hs' o 'xy' o semplicemente se hue/sat sono presenti)
    // Usiamo il convertitore HSB -> RGB per una rappresentazione più accurata
    if (hue > 0 || sat > 0 || s.colormode === 'hs') {
        const { r, g, b } = hsbToRgb(hue, sat, bri)
        return [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
    }

    // Altrimenti, è bianco/grigio (solo luminosità)
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

AppSideService(
  BaseSideService({
    onInit() {
      console.log('App side service initializing...')
    },

    onRun() {
      console.log('App side service running')
    },

    onDestroy() {
      console.log('App side service destroyed')
    },

    onSettingsChange({ key, newValue, oldValue }) {
      console.log('settings changed:', key, ':', oldValue, '>', newValue)
        switch (key) {
        case 'data:clear': {
          this.settings.clear()
          break
        }
      }
    },

    onRequest(req, res) {
      console.log('Received request:', req.method)

      switch (req.method) {
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
          this.HandleToggleGroup(req, res)
          break

        case 'GET_GROUP_DETAIL':
          this.HandleGetGroupDetail(req, res)
          break

        default:
          console.error('Unknown method:', req.method)
          res({ error: 'Unknown method: ' + req.method })
      }
    },

    async handleCheckConnection(res) {
      try {
        console.log('Checking connection...')
        const status = await hueBridge.checkConnection()
        res(null, status)
      } catch (error) {
        console.error('Check connection error:', error)
        res(null, { connected: false, reason: error.message })
      }
    },

    async handleDiscoverBridges(res) {
      try {
        console.log('Discovering bridges...')
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
        console.error('Discovery error:', error)
        res({ error: error.message })
      }
    },

    async handlePair(req, res) {
      try {
        console.log('Starting pairing...')
        //const result = await hueBridge.pair()
        const result = await hueBridge.pairWithRetry(10, 2000)
        res(null, result)
      } catch (error) {
        console.error('Pairing error:', error)

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
        console.log('Getting lights...')
        const lights = await hueBridge.getLights()

        res(null, {
          success: true,
          lights: lights
        })
      } catch (error) {
        console.error('Get lights error:', error)
        res({ error: error.message })
      }
    },

    async handleToggleLight(req, res) {
      try {
        const { lightId, state } = req.params
        console.log(`Toggle light ${lightId} to ${state}`)

        await hueBridge.toggleLight(lightId, state)
        res(null, { success: true })
      } catch (error) {
        console.error('Toggle light error:', error)
        res({ error: error.message })
      }
    },

    async handleSetBrightness(req, res) {
      try {
        const { lightId, brightness } = req.params
        console.log(`Set brightness ${lightId} to ${brightness}`)

        await hueBridge.setLightBrightness(lightId, brightness)
        res(null, { success: true })
      } catch (error) {
        console.error('Set brightness error:', error)
        res({ error: error.message })
      }
    },

   async handleSetColor(req, res) {
      try {
        // AGGIUNTO: 'ct' nella destrutturazione dei parametri
        const { lightId, hex, rgb, hue, sat, bri, ct } = req.params
        console.log(`Set color ${lightId} - ct: ${ct}, hex: ${hex}, rgb:`, rgb)

        // Includo tutti i parametri che potrebbero essere usati
        let colorParams = { hue, sat, bri, ct }

        // Se abbiamo RGB (e non CT), convertiamo a HSB
        if (rgb && (!hue || !sat) && !ct) {
          console.log('Converting RGB to HSB...')
          const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b)
          colorParams = {
            hue: hsb.hue,
            sat: hsb.sat,
            bri: bri || hsb.bri,
            ct: null // Forza a non inviare ct con HSB
          }
        }

        // PULIZIA: Rimuove i parametri 'null' o 'undefined' prima di inviare alla funzione Bridge
        Object.keys(colorParams).forEach(key => {
          if (colorParams[key] === null || colorParams[key] === undefined) {
            delete colorParams[key]
          }
        })

        await hueBridge.setLightColor(lightId, colorParams)
        res(null, { success: true })
      } catch (error) {
        console.error('Set color error:', error)
        res({ error: error.message })
      }
    },

    async handleSetHS(req, res) {
      try {
        const { lightId, hue, sat, bri } = req.params
        console.log(`Set HSB for light ${lightId} - H:${hue}, S:${sat}, B:${bri}`)

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
        console.error('Set HSB error:', error)
        res({ error: error.message })
      }
    },

    async handleAllLights(req, res) {
      try {
        const { state } = req.params
        console.log(`Toggle all lights to ${state}`)

        await hueBridge.toggleAllLights(state)
        res(null, { success: true })
      } catch (error) {
        console.error('All lights error:', error)
        res({ error: error.message })
      }
    },

    async handleSetManualIp(req, res) {
      try {
        const { ip } = req.params
        console.log('Setting manual IP:', ip)

        hueBridge.setManualBridgeIp(ip)
        res(null, { success: true })
      } catch (error) {
        console.error('Set manual IP error:', error)
        res({ error: error.message })
      }
    },

    async handleGetConfigStatus(res) {
      try {
        console.log('Getting config status...')

        const status = {
          bridgeIp: hueBridge.bridgeIp,
          username: hueBridge.username,
          apiVersion: hueBridge.apiVersion,
          isConfigured: !!(hueBridge.bridgeIp && hueBridge.username)
        }

        console.log('Config status:', status)
        res(null, status)

      } catch (error) {
        console.error('Get config status error:', error)
        res({ error: error.message })
      }
    },

    async handleClearConfig(res) {
      try {
        console.log('Clearing config...')
        hueBridge.clearConfig()
        res(null, { success: true })
      } catch (error) {
        console.error('Clear config error:', error)
        res({ error: error.message })
      }
    },

    async handleFetchAllData(res) {
      try {
        console.log('Fetching all data...')
        const data = await hueBridge.fetchAllData()

        res(null, {
          success: true,
          data: data
        })
      } catch (error) {
        console.error('Fetch all data error:', error)
        res({ error: error.message })
      }
    },

    async handleGetGroups(res) {
      try {
        console.log('Getting groups...')
        const groups = await hueBridge.getGroups()

        res(null, {
          success: true,
          data: groups
        })
      } catch (error) {
        console.error('Get groups error:', error)
        res({ error: error.message })
      }
    },

    async HandleToggleGroup(req, res) {
      try {
        const { groupId, state } = req.params
        console.log(`Toggle group ${groupId} to ${state}`)

        await hueBridge.toggleGroup(groupId, state)
        res(null, { success: true })
      } catch (error) {
        console.error('Toggle group error:', error)
        res({ error: error.message })
      }
    },

    async HandleGetGroupDetail(req, res) {
      try {
        // Uso l'optional chaining (?.) per leggere groupId in modo sicuro.
        // Se req o req.params sono undefined, groupId sarà semplicemente undefined (non c'è crash).
        const groupId = req?.params?.groupId;

        // Se l'ID è ancora mancante (cioè non è arrivato correttamente)
        if (!groupId) {
          console.error('Missing group ID in request. (req.params was undefined)')
          // Invia una risposta di errore pulita al client
          res({ error: 'Missing group ID in request.' })
          return;
        }

        console.log('Getting group detail for:', groupId);

        // Chiama la funzione del bridge con l'ID finalmente valido
        const groupDetails = await hueBridge.getGroupDetail(groupId);

        res(null, {
          success: true,
          data: groupDetails
        });
      } catch (error) {
        console.error('Get group detail error:', error);
        res({ error: error.message });
      }
    },

    async handleGetLightDetail(req, res) {
      try {
        const { lightId } = req.params // *** FIX: Estrae lightId da req.params ***
        console.log('Getting light detail for ID:', lightId)

        const lightDetail = await hueBridge.getLightDetail(lightId) // *** FIX: Passa lightId ***

        res(null, {
          success: true,
          data: { light: lightDetail } // *** FIX: Ritorna come { data: { light: ... } } ***
        })
      } catch (error) {
        console.error('Get light detail error:', error)
        res({ error: error.message })
      }
    }


  })
)