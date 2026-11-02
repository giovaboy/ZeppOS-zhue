import { BaseApp } from '@zeppos/zml/base-app'
import { writeFileSync, readFileSync, statSync, rmSync } from '@zos/fs'
import { log } from '@zos/utils'
import { DEFAULT_USER_SETTINGS } from './utils/constants.js'
import { getLogger } from './utils/logger.js'
import { logs, LOG_LEVEL } from './config.js'

const logger = getLogger('zhue-app')
const TTL = 1000 * 5 // 5 seconds

// ── Remote log (shared rule: ../_shared/zeppos-ai-doc/logging.md) ──
// The remote log's own console: @zos/utils directly, so app.js's own methods
// don't call a module function shared with the pages (field-notes.md,
// "app.js and undefined names")
const remoteConsole = log.getLogger('zhue-remote')
// Log levels of this build (config.js LOG_LEVEL), read once
const LOG_TRACE = logs('trace')
const LOG_INFO = logs('info')
// false only with LOG_LEVEL 'off' (public releases): no line leaves the watch
const LOG_WARN = logs('warn')
// Watch lines waiting at most for the phone (the oldest are dropped)
const REMOTE_LOG_MAX = 100
// A batch unanswered this long is taken as lost: its lines go again
const REMOTE_LOG_LOST_MS = 90000
// Lines still waiting when the app closes: sent at the next start
const PENDING_LOG_FILE = 'pending_log.json'

// Before each request ZML shakes hands with the phone, 5 s by default: with
// the phone busy, requests failed with "shake timeout". 20 s worked in zeppamp
// and http-buttons (field-notes.md, "Messaging")
const SHAKE_TIMEOUT_MS = 20000

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
      // On the app's messaging object, beside ZML's requestTimeout (60 s);
      // the pages' requests go through it too
      if (this.messaging) this.messaging.shakeTimeout = SHAKE_TIMEOUT_MS
      this._loadPendingLog()
      this.remoteLog(`app started (log level ${LOG_LEVEL})${this.messaging ? '' : ', no messaging object: shake timeout left at 5 s'}`)
    },

    // ── Remote log ───────────────────────────────────────────
    // Watch lines sent to the phone's Logs box (settings page, [w] prefix).
    // Three levels: devLog (trace: diagnostics), remoteLog (info: main
    // events), warnLog (problems; none with 'off'). Pages reach them through
    // utils/remote-log.js.

    remoteLog(msg) {
      if (LOG_INFO) this._sendLog(msg)
      else if (LOG_WARN) remoteConsole.log(msg)
    },

    warnLog(msg) {
      if (LOG_WARN) this._sendLog(msg)
    },

    devLog(msg) {
      if (LOG_TRACE) this._sendLog(msg)
      else if (LOG_WARN) remoteConsole.log(msg)
    },

    // Lines carry the watch time (its clock runs ~2 s behind the phone's).
    // If the phone can't be reached they wait (up to REMOTE_LOG_MAX) and go
    // with the next line.
    _sendLog(msg) {
      remoteConsole.log(`[remote] ${msg}`)
      const queue = this._remoteLog || (this._remoteLog = [])
      queue.push(`${new Date().toTimeString().slice(0, 8)} ${msg}`)
      if (queue.length > REMOTE_LOG_MAX) queue.splice(0, queue.length - REMOTE_LOG_MAX)
      this._flushRemoteLog()
    },

    // One batch at a time; a batch whose request never settles is taken as
    // lost after REMOTE_LOG_LOST_MS (checked on the next line: a timer would
    // die with the page that started it)
    _flushRemoteLog() {
      const sending = this._remoteLogSending
      if (sending && Date.now() - sending.at > REMOTE_LOG_LOST_MS) {
        this._remoteLog.unshift(...sending.lines)
        this._remoteLogSending = null
      }
      if (this._remoteLogSending || !this._remoteLog || !this._remoteLog.length) return
      const lines = this._remoteLog.splice(0)
      const batch = { lines, at: Date.now() }
      this._remoteLogSending = batch
      let sent
      try { sent = this.request({ method: 'debug.deviceLog', params: { lines } }) } catch (e) { sent = Promise.reject(e) }
      Promise.resolve(sent).then(
        () => { if (this._remoteLogSending === batch) { this._remoteLogSending = null; this._flushRemoteLog() } },
        () => { if (this._remoteLogSending === batch) { this._remoteLogSending = null; this._remoteLog.unshift(...lines) } },
      )
    },

    // The lines not confirmed by the phone (waiting, or in a batch still
    // unanswered) go to a small file at close; the phone skips a line
    // "from the last run" it already has...
    _savePendingLog() {
      try {
        const sending = this._remoteLogSending
        const lines = [].concat(sending ? sending.lines : [], this._remoteLog || [])
        if (!lines.length) return
        writeFileSync({
          path: PENDING_LOG_FILE,
          data: JSON.stringify(lines.slice(-REMOTE_LOG_MAX)),
          options: { encoding: 'utf8' },
        })
      } catch (e) { /* never throw from the logger */ }
    },

    // ...and are queued again at the next start, marked as from before
    _loadPendingLog() {
      try {
        if (!statSync({ path: PENDING_LOG_FILE })) return
        // A release build after a test one: the lines it left are dropped
        if (!LOG_WARN) { rmSync({ path: PENDING_LOG_FILE }); return }
        const text = readFileSync({ path: PENDING_LOG_FILE, options: { encoding: 'utf8' } })
        rmSync({ path: PENDING_LOG_FILE })
        const lines = JSON.parse(text || '[]')
        if (Array.isArray(lines) && lines.length) {
          this._remoteLog = lines.map((l) => `${l} (from the last run)`).slice(-REMOTE_LOG_MAX)
        }
      } catch (e) { /* never throw from the logger */ }
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
      if (LOG_TRACE) {
        const demo = apiData.userSettings ? `, demo ${apiData.userSettings.demo_mode === true ? 'on' : 'off'}` : ''
        this.devLog(`[store] groups: ${(apiData.rooms || []).length} rooms, ${(apiData.zones || []).length} zones${demo}`)
      }
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
      this.remoteLog('app closed')
      this._savePendingLog()
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