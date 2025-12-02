
import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'

const BRIDGE_IP_KEY = 'hue_bridge_ip'
const USERNAME_KEY = 'hue_username'
const API_VERSION_KEY = 'hue_api_version'

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
    sat: Math.round(s * 254),          // Hue API usa 0-254
    bri: Math.round(bri * 254)         // Hue API usa 0-254
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
    console.log('HueBridgeManager initialized:', {
      bridgeIp: this.bridgeIp,
      username: this.username,
      apiVersion: this.apiVersion
    })
  }

  saveConfig() {
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
    settingsLib.removeItem(BRIDGE_IP_KEY)
    settingsLib.removeItem(USERNAME_KEY)
    settingsLib.removeItem(API_VERSION_KEY)
    this.bridgeIp = null
    this.username = null
    this.apiVersion = 'v1'
  }

  async discoverBridges() {
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
    if (!this.bridgeIp) throw new Error('No bridge IP configured')
    console.log('Pairing bridge (v1 API)...')
    return await this.pairV1()
  }

  async pairWithRetry(maxRetries = 5, delayMs = 3000) {
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
  const url = `http://${this.bridgeIp}/api/${this.username}/lights/${lightId}/state`
  const body = {}

  // Supporta sia hue/sat/bri che hex
  if (colorParams.hue !== undefined) body.hue = colorParams.hue
  if (colorParams.sat !== undefined) body.sat = colorParams.sat
  if (colorParams.bri !== undefined) body.bri = colorParams.bri

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
        }
      })
    })
    const result = await safeJson(res)
    if (result.errors?.length) throw new Error(result.errors[0].description)
    return { success: true }
  }


  async toggleAllLights(on) {
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
    const lights = await this.getLights()

    // Per ora ritorna solo lights
    // TODO: aggiungere rooms, zones, scenes quando implementati
    return {
      lights: lights,
      rooms: [],   // TODO
      zones: [],   // TODO
      scenes: []   // TODO
    }
  }

  stateToHex(s) {
    if (!s || !s.on) return '000000'
    const bri = s.bri || 254
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
        const { lightId, hex, rgb, hue, sat, bri } = req.params
        console.log(`Set color ${lightId} - hex: ${hex}, rgb:`, rgb)

        // Se abbiamo RGB, convertiamo a HSB
        let colorParams = { hue, sat, bri }

        if (rgb && (!hue || !sat)) {
          console.log('Converting RGB to HSB...')
          const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b)
          colorParams = {
            hue: hsb.hue,
            sat: hsb.sat,
            bri: bri || hsb.bri // Usa bri dal param o dal calcolo
          }
        }

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

    // Nel file index_app.js (Sostituisci l'intera funzione)

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