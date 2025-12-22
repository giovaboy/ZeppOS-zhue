import { BaseApp } from '@zeppos/zml/base-app'
import { DEFAULT_USER_SETTINGS } from './utils/constants.js'
import { getLogger } from './utils/logger.js'

const logger = getLogger('zhue-app')
const TTL = 1000 * 300 // 30 secondi

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
      currentTab: null,
      scrollPositions: {
        groups: {
          ROOMS: 0,
          ZONES: 0
        },
        groupDetail: {} // { groupId: yPosition }
      },
      needsGroupsRefresh: false,
      settingsLoaded: false,
      settings: {
        ...DEFAULT_USER_SETTINGS
      },
      currentLightId: null,
      lightData: {}
    },
    
    onCreate(options) {
      logger.debug('Hue On-Off App Created')
    },
    
    loadUserSettings() {
      logger.debug('Loading user settings from backend...')
      
      // Richiesta al backend per ottenere le settings
      this.request({
          method: 'GET_USER_SETTINGS'
        })
        .then(result => {
          if (result.success && result.settings) {
            logger.debug('User settings loaded:', result.settings)
            
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
      logger.debug('Global Store: Updating settings', newSettings)
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
      logger.debug('Global Store: Updating Groups Data')
      logger.debug('API Data:', JSON.stringify(apiData))
      this.globalData.data.rooms = apiData.rooms || []
      this.globalData.data.zones = apiData.zones || []
      this.globalData.data.hasLoadedOnce = true
      
      // 👇 NUOVO: Aggiorna anche settings se presenti
      if (apiData.userSettings) {
        logger.debug('Global Store: Updating User Settings from API')
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
      logger.debug('Global Store: Setting current tab to', tabName)
      this.globalData.currentTab = tabName
    },
    
    getCurrentTab() {
      // 1. Priorità alla sessione corrente: se l'utente ha già navigato, manteniamo la sua scelta
      if (this.globalData.currentTab) {
        return this.globalData.currentTab
      }
      
      // 2. Se è il primo avvio, controlliamo le Settings dell'utente
      if (this.globalData.settings && this.globalData.settings.default_tab) {
        // Un piccolo controllo di sicurezza non guasta
        const pref = this.globalData.settings.default_tab
        if (pref === 'ROOMS' || pref === 'ZONES') {
          return pref
        }
      }
      
      // 3. Fallback finale (se le settings mancano o sono corrotte)
      return 'ROOMS'
    },
    
    setGroupsScrollY(y) {
      const currentTab = this.getCurrentTab()
      logger.debug(`Global Store: Saving groups scroll Y for tab ${currentTab}:`, y)
      this.globalData.scrollPositions.groups[currentTab] = y
    },
    
    // 👇 CORRETTO: Recupera scroll Y per la pagina groups (per tab)
    getGroupsScrollY() {
      const currentTab = this.getCurrentTab()
      const y = this.globalData.scrollPositions.groups[currentTab] || 0
      logger.debug(`Global Store: Retrieved groups scroll Y for tab ${currentTab}:`, y)
      return y
    },
    
    setGroupDetailScrollY(groupId, y) {
      logger.debug(`Global Store: Saving group-detail scroll Y for group ${groupId}:`, y)
      this.globalData.scrollPositions.groupDetail[groupId] = y
    },
    
    // 👇 CORRETTO: Recupera scroll Y per group-detail (per groupId)
    getGroupDetailScrollY(groupId) {
      const y = this.globalData.scrollPositions.groupDetail[groupId] || 0
      logger.debug(`Global Store: Retrieved group-detail scroll Y for group ${groupId}:`, y)
      return y
    },
    
    setGroupDetailCache(groupId, data) {
      // Salviamo i dati associandoli all'ID
      this.globalData.groupDetailCache[groupId] = data
    },
    
    updateGroupStatusInCache(groupId, isOn) {
      const cachedGroup = this.globalData.groupDetailCache[groupId]
      
      if (cachedGroup) {
        logger.debug(`Global Store: Patching cache for group ${groupId} -> ${isOn}`)
        
        // 1. Aggiorna lo stato del gruppo
        cachedGroup.anyOn = isOn
        // 2. Aggiorna le luci dentro il gruppo E la cache delle luci singole
        if (cachedGroup.lights && Array.isArray(cachedGroup.lights)) {
          cachedGroup.lights.forEach(lightInGroup => {
            // A. Aggiorna dentro l'oggetto gruppo
            if (lightInGroup) {
              lightInGroup.ison = isOn
              //if (isOn && lightInGroup.bri === 0) lightInGroup.bri = 254
            }
            // B. Aggiorna la cache della singola luce (se esiste e fa parte del gruppo)
            // Le luci nel gruppo hanno un ID, usiamolo per trovare la cache singola
            const individualLightId = lightInGroup.id
            const cachedLight = this.globalData.lightData[individualLightId]
            
            if (cachedLight) {
              logger.debug(`Global Store: Syncing individual light ${individualLightId} to ${isOn}`)
              cachedLight.ison = isOn
              // Aggiorna timestamp per tenerla valida
              cachedLight._timestamp = Date.now()
            }
          })
        }
        
        cachedGroup._timestamp = Date.now()
      }
    },
    
    // ✅ SINCRONIZZAZIONE LUCE -> GRUPPO
    updateLightStatusInGroupsCache(lightId, updates) {
      logger.debug(`Global Store: Updating light ${lightId} status to ${JSON.stringify(updates)} in all groups cache`)
      Object.keys(this.globalData.groupDetailCache).forEach(groupId => {
        const cachedGroup = this.globalData.groupDetailCache[groupId]
        
        logger.debug('Before cachedGroup:', JSON.stringify(cachedGroup))
        logger.debug('Before cachedGroup lights:', cachedGroup.lights.length)
        
        if (cachedGroup && cachedGroup.lights) {
          // Cerchiamo se la luce fa parte di questo gruppo
          const lightInGroup = cachedGroup.lights.find(l => (l.id === lightId))
          
          if (lightInGroup) {
            logger.debug(`Global Store: Updating light ${lightId} inside group ${groupId}`)
            logger.debug('Before update:', JSON.stringify(lightInGroup))
            
            // 1. Aggiorna la luce dentro il gruppo
            //lightInGroup.ison = isOn
            Object.assign(lightInGroup, updates)
            
            // 2. Ricalcola lo stato del gruppo (any_on)
            const anyOn = cachedGroup.lights.some(l => {
              return !!(l.ison)
            })
            
            cachedGroup.anyOn = anyOn
          }
        }
        
        logger.debug('After cachedGroup:', JSON.stringify(cachedGroup))
        logger.debug('After cachedGroup lights:', cachedGroup.lights.length)
      })
      
      // Aggiorna anche la lista generale dei gruppi (quella di groups.js)
      // Aggiorna la lista generale dei gruppi
      const gData = this.globalData.data
      if (gData.hasLoadedOnce) {
        [...gData.rooms, ...gData.zones].forEach(group => {
          logger.debug('group:', JSON.stringify(group))
          // Se abbiamo il dettaglio in cache, usiamo quello che è super preciso
          const detail = this.globalData.groupDetailCache[group.id]
          
          if (detail) {
            group.anyOn = detail.anyOn
          } else if (group.lights && group.lights.includes(lightId)) {
            // Se non abbiamo il dettaglio, usiamo la logica "optimistic" che hai scritto
            if (updates.ison) {
              group.anyOn = true
            } else {
              // Se spegniamo, non sappiamo se altre luci sono accese senza il dettaglio.
              this.globalData.needsGroupsRefresh = true
            }
          }
        })
      }
    },
    
    getGroupDetailCache(groupId) {
      return this.globalData.groupDetailCache[groupId] || null
    },
    
    setCurrentLightId(id) {
      this.globalData.currentLightId = id
      logger.debug('Global Store: Current Light ID saved:', id)
    },
    
    getCurrentLightId() {
      return this.globalData.currentLightId
    },
    
    setLightData(lightId, lightData) {
      logger.debug('Global Store: Setting current light data', lightData?.id)
      this.globalData.lightData[lightId] = {
        ...lightData,
        _timestamp: Date.now(),
        _ttl: TTL
      }
      this.globalData.currentLightId = lightId
    },
    
    getLightData(lightId) {
      //return this.globalData.lightData[lightId] || null
      const data = this.globalData.lightData[lightId]
      if (!data) return null
      
      // Verifica se il cache è ancora valido
      const age = Date.now() - (data._timestamp || 0)
      if (age > (data._ttl || TTL)) {
        logger.debug('Light data cache expired')
        this.clearLightData(lightId)
        return null
      }
      
      return data
    },
    
    clearLightData(lightId) {
      logger.debug('Global Store: Clearing current light data')
      this.globalData.lightData[lightId] = null
    },
    
    onDestroy(options) {
      logger.debug('Hue On-Off App Destroyed')
    }
  })
)