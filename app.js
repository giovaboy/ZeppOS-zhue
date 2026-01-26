import { BaseApp } from '@zeppos/zml/base-app'
import { DEFAULT_USER_SETTINGS } from './utils/constants.js'
import { getLogger } from './utils/logger.js'

const logger = getLogger('zhue-app')
const TTL = 1000 * 5 // 5 seconds

App(
  BaseApp({
    globalData: {
      groupsData: {
        rooms: [],
        zones: [],
        hasLoadedOnce: false,
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

    // ============================================
    // NEW: Helper method to check demo mode
    // ============================================
    isDemoMode() {
      // Check if demo_mode flag is set in settings
      // This is populated by the GET_USER_SETTINGS response from app-side
      return this.globalData.settings?.demo_mode === true
    },

    loadUserSettings() {
      logger.debug('Loading user settings from backend...')

      this.request({
        method: 'GET_USER_SETTINGS'
      })
        .then(result => {
          if (result.success && result.settings) {
            logger.debug('User settings loaded:', result.settings)

            // Update settings including demo_mode flag
            this.globalData.settings = {
              ...this.globalData.settings,
              ...result.settings
            }

            this.globalData.settingsLoaded = true

            // Log demo mode status
            if (this.isDemoMode()) {
              logger.debug('Demo mode is ACTIVE - cache will never expire')
            }
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

    // ============================================
    // PATCHED: getLightData - Skip expiry in demo mode
    // ============================================
    getLightData(lightId) {
      const data = this.globalData.lightData[lightId]
      if (!data) return null

      // In demo mode, cache never expires
      if (this.isDemoMode()) {
        logger.debug('Demo mode: returning cached light data (no expiry)')
        return data
      }

      // Normal mode: verify cache is still valid
      const age = Date.now() - (data._timestamp || 0)
      if (age > TTL) {
        logger.debug('Light data cache expired')
        this.clearLightData(lightId)
        return null
      }

      return data
    },

    setLightData(lightId, lightData) {
      logger.debug('Global Store: Setting current light data', lightData?.id)
      this.globalData.lightData[lightId] = {
        ...lightData,
        _timestamp: Date.now()
      }
      this.globalData.currentLightId = lightId
    },

    clearLightData(lightId) {
      logger.debug('Global Store: Clearing current light data')
      this.globalData.lightData[lightId] = null
    },

    // ============================================
    // PATCHED: getGroupsData - Skip expiry in demo mode
    // ============================================
    getGroupsData() {
      const data = this.globalData.groupsData

      // In demo mode, data never expires
      if (this.isDemoMode()) {
        return {
          ...data,
          _isExpired: false  // Always valid in demo mode
        }
      }

      // Normal mode: check expiration
      const age = Date.now() - (data._timestamp || 0)
      const isExpired = age > TTL

      if (isExpired && data.hasLoadedOnce) {
        logger.debug(`Groups cache expired (age: ${Math.round(age / 1000)}s)`)
        this.globalData.needsGroupsRefresh = true
      }

      return {
        ...data,
        _isExpired: isExpired
      }
    },

    setGroupsData(apiData) {
      logger.debug('Global Store: Updating Groups Data')
      logger.debug('API Data:', JSON.stringify(apiData))
      this.globalData.groupsData.rooms = apiData.rooms || []
      this.globalData.groupsData.zones = apiData.zones || []
      this.globalData.groupsData.hasLoadedOnce = true
      this.globalData.groupsData._timestamp = Date.now()

      // Update settings if present (including demo_mode)
      if (apiData.userSettings) {
        logger.debug('Global Store: Updating User Settings from API')
        this.globalData.settings = {
          ...this.globalData.settings,
          ...apiData.userSettings
        }
      }
    },

    invalidateGroupsCache() {
      logger.debug('Global Store: Invalidating groups cache')
      this.globalData.groupsData._timestamp = 0
      this.globalData.needsGroupsRefresh = true
    },

    // ============================================
    // PATCHED: shouldRefreshGroups - Never refresh in demo mode (if data loaded)
    // ============================================
    shouldRefreshGroups() {
      // In demo mode, only refresh if we haven't loaded data yet
      if (this.isDemoMode()) {
        return !this.globalData.groupsData.hasLoadedOnce
      }

      // Normal mode: check all refresh conditions
      const needsRefresh = this.globalData.needsGroupsRefresh
      const data = this.globalData.groupsData
      const age = Date.now() - (data._timestamp || 0)
      const isExpired = age > TTL

      return needsRefresh || isExpired || !data.hasLoadedOnce
    },

    // ============================================
    // PATCHED: getGroupDetailCache - Skip expiry in demo mode
    // ============================================
    getGroupDetailCache(groupId) {
      const cached = this.globalData.groupDetailCache[groupId]

      if (!cached) return null

      // In demo mode, cache never expires
      if (this.isDemoMode()) {
        logger.debug(`Demo mode: using cached group detail for ${groupId} (no expiry)`)
        return cached
      }

      // Normal mode: check expiration
      const age = Date.now() - (cached._timestamp || 0)

      if (age > TTL) {
        logger.debug(`Group detail cache expired for ${groupId} (age: ${Math.round(age / 1000)}s)`)
        this.globalData.groupDetailCache[groupId] = null
        return null
      }

      logger.debug(`Using cached group detail for ${groupId} (age: ${Math.round(age / 1000)}s)`)
      return cached
    },

    setGroupDetailCache(groupId, data) {
      if (data) {
        data._timestamp = Date.now()
      }
      this.globalData.groupDetailCache[groupId] = data
      logger.debug(`Group detail cache set for ${groupId}`)
    },

    invalidateGroupDetailCache(groupId) {
      logger.debug(`Invalidating group detail cache for ${groupId}`)
      this.globalData.groupDetailCache[groupId] = null
    },

    // ... rest of existing methods remain unchanged ...

    setCurrentTab(tabName) {
      logger.debug('Global Store: Setting current tab to', tabName)
      this.globalData.currentTab = tabName
    },

    getCurrentTab() {
      if (this.globalData.currentTab) {
        return this.globalData.currentTab
      }

      if (this.globalData.settings && this.globalData.settings.default_tab) {
        const pref = this.globalData.settings.default_tab
        if (pref === 'ROOMS' || pref === 'ZONES') {
          return pref
        }
      }

      return 'ROOMS'
    },

    setGroupsScrollY(y) {
      const currentTab = this.getCurrentTab()
      logger.debug(`Global Store: Saving groups scroll Y for tab ${currentTab}:`, y)
      this.globalData.scrollPositions.groups[currentTab] = y
    },

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

    getGroupDetailScrollY(groupId) {
      const y = this.globalData.scrollPositions.groupDetail[groupId] || 0
      logger.debug(`Global Store: Retrieved group-detail scroll Y for group ${groupId}:`, y)
      return y
    },

    setCurrentLightId(id) {
      this.globalData.currentLightId = id
      logger.debug('Global Store: Current Light ID saved:', id)
    },

    getCurrentLightId() {
      return this.globalData.currentLightId
    },

    updateGroupStatusInCache(groupId, isOn) {
      const cachedGroup = this.globalData.groupDetailCache[groupId]

      if (cachedGroup) {
        logger.debug(`Global Store: Patching cache for group ${groupId} -> ${isOn}`)
        cachedGroup.anyOn = isOn

        if (cachedGroup.lights && Array.isArray(cachedGroup.lights)) {
          cachedGroup.lights.forEach(lightInGroup => {
            if (lightInGroup) {
              lightInGroup.ison = isOn
            }
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

    updateLightStatusInGroupsCache(lightId, updates) {
      logger.debug(`Global Store: Updating light ${lightId} status to ${JSON.stringify(updates)} in all groups cache`)
      Object.keys(this.globalData.groupDetailCache).forEach(groupId => {
        const cachedGroup = this.globalData.groupDetailCache[groupId]

        if (cachedGroup && cachedGroup.lights) {
          const lightInGroup = cachedGroup.lights.find(l => (l.id === lightId))

          if (lightInGroup) {
            logger.debug(`Global Store: Updating light ${lightId} inside group ${groupId}`)
            Object.assign(lightInGroup, updates)

            const anyOn = cachedGroup.lights.some(l => {
              return !!(l.ison)
            })

            cachedGroup.anyOn = anyOn
            cachedGroup._timestamp = Date.now()
          }
        }
      })

      const gData = this.globalData.groupsData
      if (gData.hasLoadedOnce) {
        let updated = false;
        [...gData.rooms, ...gData.zones].forEach(group => {
          const detail = this.globalData.groupDetailCache[group.id]

          if (detail) {
            group.anyOn = detail.anyOn
            updated = true
          } else if (group.lights && group.lights.includes(lightId)) {
            if (updates.ison) {
              group.anyOn = true
              updated = true
            } else {
              this.globalData.needsGroupsRefresh = true
            }
          }
        })
        if (updated) {
          gData._timestamp = Date.now()
        }
      }
    },

    clearAllCache() {
      logger.debug('Global Store: Clearing all cache data')

      this.globalData.groupsData = {
        rooms: [],
        zones: [],
        hasLoadedOnce: false,
        _timestamp: 0
      }

      this.globalData.groupDetailCache = {}
      this.globalData.lightData = {}
      this.globalData.needsGroupDetailRefresh = false
      this.globalData.needsGroupsRefresh = false

      this.globalData.scrollPositions = {
        groups: {
          ROOMS: 0,
          ZONES: 0
        },
        groupDetail: {}
      }

      this.globalData.currentTab = null
      this.globalData.currentLightId = null

      this.globalData.settingsLoaded = false
      this.globalData.settings = { ...DEFAULT_USER_SETTINGS }

      logger.debug('Global Store: Cache cleared successfully')
    },

    onDestroy(options) {
      logger.debug('Hue On-Off App Destroyed - Cleaning up...')
      this.clearAllCache()
      /*try {
        this.request({ method: 'CANCEL_ALL' })
          .catch(err => logger.debug('Cancel all failed:', err))
      } catch (e) {
        logger.debug('Could not send cancellation:', e)
      }*/
      logger.debug('Hue On-Off App cleanup completed')
    }
  })
)