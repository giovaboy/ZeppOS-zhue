import { BaseApp } from '@zeppos/zml/base-app'
import { DEFAULT_USER_SETTINGS } from './utils/constants.js'
import { getLogger } from './utils/logger.js'

const logger = getLogger('zhue-app')
const TTL = 1000 * 5 // 5 secondi

App(
  BaseApp({
    globalData: {
      groupsData: {
        rooms: [],
        zones: [],
        hasLoadedOnce: false, // Flag per sapere se abbiamo dati validi
        _timestamp: 0
      },
      groupDetailCache: {},
      currentTab: null,
      scrollPositions: {
        groups: {
          ROOMS: 0,
          ZONES: 0
        },
        groupDetail: {}
      },
      needsGroupDetailRefresh: false,
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
      this.globalData.groupsData.rooms = apiData.rooms || []
      this.globalData.groupsData.zones = apiData.zones || []
      this.globalData.groupsData.hasLoadedOnce = true
      this.globalData.groupsData._timestamp = Date.now()

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
      const data = this.globalData.groupsData

      // ✅ SEMPLIFICATO: Ritorna sempre, ma segnala se scaduto
      const age = Date.now() - (data._timestamp || 0)
      const isExpired = age > TTL

      if (isExpired && data.hasLoadedOnce) {
        logger.debug(`Groups cache expired (age: ${Math.round(age/1000)}s)`)
        // ✅ Setta flag invece di invalidare subito
        this.globalData.needsGroupsRefresh = true
      }

      return {
        ...data,
        _isExpired: isExpired  // ✅ Info utile per le pagine
      }
    },

    invalidateGroupsCache() {
      logger.debug('Global Store: Invalidating groups cache')
      this.globalData.groupsData._timestamp = 0
      this.globalData.needsGroupsRefresh = true
    },

    shouldRefreshGroups() {
      const needsRefresh = this.globalData.needsGroupsRefresh
      const data = this.globalData.groupsData
      const age = Date.now() - (data._timestamp || 0)
      const isExpired = age > TTL

      return needsRefresh || isExpired || !data.hasLoadedOnce
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
      if (data) {
        data._timestamp = Date.now()  // ✅ Timestamp aggiunto
      }
      // Salviamo i dati associandoli all'ID
      this.globalData.groupDetailCache[groupId] = data
      logger.debug(`Group detail cache set for ${groupId}`)
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
            }
            // B. Aggiorna la cache della singola luce (se esiste e fa parte del gruppo)
            // Le luci nel gruppo hanno un ID, usiamolo per trovare la cache singola
            const individualLightId = lightInGroup.id
            const cachedLight = this.globalData.lightData[individualLightId]

            if (cachedLight) {
              logger.debug(`Global Store: Syncing individual light ${individualLightId} to ${isOn}`)
              cachedLight.ison = isOn
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
            cachedGroup._timestamp = Date.now()
          }
        }

        logger.debug('After cachedGroup:', JSON.stringify(cachedGroup))
        logger.debug('After cachedGroup lights:', cachedGroup.lights.length)
      })

      // Aggiorna anche la lista generale dei gruppi (quella di groups.js)
      // Aggiorna la lista generale dei gruppi
      const gData = this.globalData.groupsData
      if (gData.hasLoadedOnce) {
        let updated = false;
        [...gData.rooms, ...gData.zones].forEach(group => {
          logger.debug('group:', JSON.stringify(group))
          // Se abbiamo il dettaglio in cache, usiamo quello che è super preciso
          const detail = this.globalData.groupDetailCache[group.id]

          if (detail) {
            group.anyOn = detail.anyOn
            updated = true
          } else if (group.lights && group.lights.includes(lightId)) {
            // Se non abbiamo il dettaglio, usiamo la logica "optimistic" che hai scritto
            if (updates.ison) {
              group.anyOn = true
              updated = true
            } else {
              // Se spegniamo, non sappiamo se altre luci sono accese senza il dettaglio.
              this.globalData.needsGroupsRefresh = true
            }
          }
        })
        if (updated) {
          gData._timestamp = Date.now()  // ✅ Refresh timestamp lista
        }
      }
    },

    getGroupDetailCache(groupId) {
      const cached = this.globalData.groupDetailCache[groupId]

      if (!cached) return null

      const age = Date.now() - (cached._timestamp || 0)

      if (age > TTL) {
        logger.debug(`Group detail cache expired for ${groupId} (age: ${Math.round(age/1000)}s)`)
        this.globalData.groupDetailCache[groupId] = null
        return null
      }

      logger.debug(`Using cached group detail for ${groupId} (age: ${Math.round(age/1000)}s)`)
      return cached
    },

    invalidateGroupDetailCache(groupId) {
      logger.debug(`Invalidating group detail cache for ${groupId}`)
      this.globalData.groupDetailCache[groupId] = null
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
        _timestamp: Date.now()
      }
      this.globalData.currentLightId = lightId
    },

    getLightData(lightId) {
      //return this.globalData.lightData[lightId] || null
      const data = this.globalData.lightData[lightId]
      if (!data) return null

      // Verifica se il cache è ancora valido
      const age = Date.now() - (data._timestamp || 0)
      if (age > TTL) {
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

    // ✅ NUOVO: Metodo per ripulire completamente la cache
    clearAllCache() {
      logger.debug('Global Store: Clearing all cache data')

      // Resetta dati runtime
      this.globalData.groupsData = {
        rooms: [],
        zones: [],
        hasLoadedOnce: false,
        _timestamp: 0
      }

      // Resetta cache
      this.globalData.groupDetailCache = {}
      this.globalData.lightData = {}
      this.globalData.needsGroupDetailRefresh = false
      this.globalData.needsGroupsRefresh = false

      // Resetta scroll positions
      this.globalData.scrollPositions = {
        groups: {
          ROOMS: 0,
          ZONES: 0
        },
        groupDetail: {}
      }

      // Resetta current items
      this.globalData.currentTab = null
      this.globalData.currentLightId = null

      //settings
      this.globalData.settingsLoaded = false
      this.globalData.settings = { ...DEFAULT_USER_SETTINGS }

      logger.debug('Global Store: Cache cleared successfully')
    },

    onDestroy(options) {
      logger.debug('Hue On-Off App Destroyed - Cleaning up...')

      // ✅ Pulizia completa della globalData
      this.clearAllCache()

      logger.debug('Hue On-Off App cleanup completed')
    }
  })
)