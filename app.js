import { BaseApp } from '@zeppos/zml/base-app'
import { DEFAULT_USER_SETTINGS } from './utils/constants.js'

App(
  BaseApp({
    globalData: {
      // Dati Applicativi (Runtime)
      data: {
        rooms: [],
        zones: [],
        hasLoadedOnce: false // Flag per sapere se abbiamo dati validi
      },
      needsGroupDetailRefresh: false,
      groupDetailCache: {},
      currentTab: 'ROOMS',
      isComingBackFromDetail: false,
      needsGroupsRefresh: false,
      settingsLoaded: false,
      settings: {
        ...DEFAULT_USER_SETTINGS
      },
      currentLightId: null,
      lightData: {}
    },
    
    onCreate(options) {
      console.log('Hue On-Off App Created')
    },
    
    loadUserSettings() {
      console.log('Loading user settings from backend...')
      
      // Richiesta al backend per ottenere le settings
      this.request({
          method: 'GET_USER_SETTINGS'
        })
        .then(result => {
          if (result.success && result.settings) {
            console.log('User settings loaded:', result.settings)
            
            // Aggiorna le settings mantenendo bridgeIp e username
            this.globalData.settings = {
              ...this.globalData.settings, // Mantiene bridgeIp/username
              ...result.settings // Sovrascrive con backend
            }
            
            this.globalData.settingsLoaded = true
          } else {
            console.warn('Failed to load settings, using defaults')
            this.globalData.settingsLoaded = true
          }
        })
        .catch(err => {
          console.error('Error loading user settings:', err)
          this.globalData.settingsLoaded = true
        })
    },
    
    areSettingsReady() {
      return this.globalData.settingsLoaded
    },
    
    updateSettings(newSettings) {
      console.log('Global Store: Updating settings', newSettings)
      this.globalData.settings = {
        ...this.globalData.settings,
        ...newSettings
      }
    },
    
    getSettings() {
      return this.globalData.settings
    },
    
    // --- HELPER METHODS ---
    // Usiamo questi metodi invece di toccare globalData direttamente
    // così se domani cambi struttura, modifichi solo qui.
    
    setGroupsData(apiData) {
      console.log('Global Store: Updating Groups Data')
      this.globalData.data.rooms = apiData.rooms || []
      this.globalData.data.zones = apiData.zones || []
      this.globalData.data.hasLoadedOnce = true
      
      // 👇 NUOVO: Aggiorna anche settings se presenti
      if (apiData.userSettings) {
        console.log('Global Store: Updating User Settings from API')
        this.globalData.settings = {
          ...this.globalData.settings, // Mantiene bridgeIp/username
          ...apiData.userSettings // Sovrascrive con backend
        }
      }
    },
    
    getGroupsData() {
      return this.globalData.data
    },
    
    setCurrentTab(tabName) {
      console.log('Global Store: Setting current tab to', tabName)
      this.globalData.currentTab = tabName
    },
    
    getCurrentTab() {
      return this.globalData.currentTab || 'ROOMS'
    },
    
    setGroupDetailCache(groupId, data) {
      // Salviamo i dati associandoli all'ID
      this.globalData.groupDetailCache[groupId] = data
    },
    
    // ✅ NUOVO METODO: Aggiorna la cache "chirurgicamente"
    updateGroupStatusInCacheold(groupId, isOn) {
      const cachedGroup = this.globalData.groupDetailCache[groupId]
      
      if (cachedGroup) {
        console.log(`Global Store: Patching cache for group ${groupId} -> ${isOn}`)
        
        // 1. Aggiorna lo stato del gruppo (Hue usa action.on o state.any_on a seconda del tipo)
        if (cachedGroup.action) cachedGroup.action.on = isOn
        if (cachedGroup.state) {
          cachedGroup.state.any_on = isOn
          cachedGroup.state.all_on = isOn
        }
        
        // 2. Aggiorna tutte le luci contenute nel gruppo
        // Se accendo una stanza, assumiamo che tutte le luci si accendano (o spengano)
        if (cachedGroup.lights && Array.isArray(cachedGroup.lights)) {
          cachedGroup.lights.forEach(light => {
            // Le luci hanno lo stato dentro 'state' o direttamente alla radice se semplificate
            if (light.state) {
              light.state.on = isOn
              // Opzionale: se accendi, metti bri al massimo se è 0, per coerenza visiva
              if (isOn && light.state.bri === 0) light.state.bri = 254
            }
            // Se la struttura è piatta (dipende dal tuo parser API):
            if (light.on !== undefined) light.on = isOn
          })
        }
        
        // 3. Rinnova il timestamp per non farla scadere subito
        cachedGroup._timestamp = Date.now()
      }
    },
    
    // In app.js
    
    updateGroupStatusInCache(groupId, isOn) {
      const cachedGroup = this.globalData.groupDetailCache[groupId]
      
      if (cachedGroup) {
        console.log(`Global Store: Patching cache for group ${groupId} -> ${isOn}`)
        
        // 1. Aggiorna lo stato del gruppo
        cachedGroup.anyOn = isOn
        if (cachedGroup.action) cachedGroup.action.on = isOn
        if (cachedGroup.state) {
          cachedGroup.state.any_on = isOn
          cachedGroup.state.all_on = isOn
        }
        
        // 2. Aggiorna le luci dentro il gruppo E la cache delle luci singole
        if (cachedGroup.lights && Array.isArray(cachedGroup.lights)) {
          cachedGroup.lights.forEach(lightInGroup => {
            // A. Aggiorna dentro l'oggetto gruppo
            if (lightInGroup) {
              lightInGroup.ison = isOn
              //if (isOn && lightInGroup.bri === 0) lightInGroup.bri = 254
            }
            
            // B. ✅ AGGIUNTA FONDAMENTALE: Aggiorna la cache della singola luce (se esiste)
            // Le luci nel gruppo hanno un ID, usiamolo per trovare la cache singola
            const individualLightId = lightInGroup.id // O lightInGroup.lightId a seconda della tua API
            const cachedLight = this.globalData.lightData[individualLightId]
            
            if (cachedLight) {
              console.log(`Global Store: Syncing individual light ${individualLightId} to ${isOn}`)
              cachedLight.ison = isOn // Nota: lightData spesso è "piatto" (light.on)
              // Se la struttura di lightData usa 'state', usa cachedLight.state.on = isOn
             // if (cachedLight.state) cachedLight.state.ison = isOn
              
              // Aggiorna timestamp per tenerla valida
              cachedLight._timestamp = Date.now()
            }
          })
        }
        
        cachedGroup._timestamp = Date.now()
      }
    },
    
    // ✅ SINCRONIZZAZIONE LUCE -> GRUPPO
    updateLightStatusInGroupsCache(lightId, isOn) {
      Object.keys(this.globalData.groupDetailCache).forEach(groupId => {
        const cachedGroup = this.globalData.groupDetailCache[groupId]
        
        if (cachedGroup && cachedGroup.lights) {
          // Cerchiamo se la luce fa parte di questo gruppo
          const lightInGroup = cachedGroup.lights.find(l => (l.id === lightId || l.lightId === lightId))
          
          if (lightInGroup) {
            console.log(`Global Store: Updating light ${lightId} inside group ${groupId}`)
            
            // 1. Aggiorna la luce dentro il gruppo
            //if (lightInGroup.state) lightInGroup.state.on = isOn
           // if (lightInGroup.ison !== undefined)
            lightInGroup.ison = isOn
            
            // 2. Ricalcola lo stato del gruppo (any_on / all_on)
            const anyOn = cachedGroup.lights.some(l => {
              return !!(l.ison)
            })
            
            cachedGroup.state.anyOn = anyOn
            if (cachedGroup.state) cachedGroup.state.any_on = anyOn
            if (cachedGroup.action) cachedGroup.action.on = anyOn // Per coerenza UI
            
            cachedGroup._timestamp = Date.now()
          }
        }
      })
      
      // Aggiorna anche la lista generale dei gruppi (quella di groups.js)
      const gData = this.globalData.data
      if (gData.hasLoadedOnce) {
        [...gData.rooms, ...gData.zones].forEach(group => {
          if (group.lights && group.lights.includes(lightId)) {
            // Qui la struttura è più semplice, di solito anyOn
            group.anyOn = isOn || group.anyOn // Logica semplificata: se una è accesa, anyOn è true
            // Per essere precisi servirebbe ricalcolare su tutte le luci del gruppo, 
            // ma come "update veloce" questo basta a non mostrare dati palesemente falsi.
          }
        })
      }
    },
    
    getGroupDetailCache(groupId) {
      return this.globalData.groupDetailCache[groupId] || null
    },
    
    setCurrentLightId(id) {
      this.globalData.currentLightId = id
      console.log('Global Store: Current Light ID saved:', id)
    },
    
    getCurrentLightId() {
      return this.globalData.currentLightId
    },
    
    setLightData(lightId, lightData) {
      console.log('Global Store: Setting current light data', lightData?.id)
      this.globalData.lightData[lightId] = {
        ...lightData,
        _timestamp: Date.now(),
        _ttl: 1000000 // 1000 secondi di validità
      }
      this.globalData.currentLightId = lightId
    },
    
    getLightData(lightId) {
      //return this.globalData.lightData[lightId] || null
      const data = this.globalData.lightData[lightId]
      if (!data) return null
      
      // Verifica se il cache è ancora valido
      const age = Date.now() - (data._timestamp || 0)
      if (age > (data._ttl || 1000000)) {
        console.log('Light data cache expired')
        this.clearLightData(lightId)
        return null
      }
      
      return data
    },
    
    clearLightData(lightId) {
      console.log('Global Store: Clearing current light data')
      this.globalData.lightData[lightId] = null
    },
    
    onDestroy(options) {
      console.log('Hue On-Off App Destroyed')
    }
  })
)