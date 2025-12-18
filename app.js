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
    updateGroupStatusInCache(groupId, isOn) {
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