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
      detailCache: {},
      currentTab: 'ROOMS',
      isComingBackFromDetail: false,
      needsGroupsRefresh: false,
      settingsLoaded: false,
      settings: {
        ...DEFAULT_USER_SETTINGS
      }
    },

    onCreate(options) {
      console.log('Hue On-Off App Created')
      // Qui in futuro caricherai i settings dal file system
      //this.loadUserSettings()
    },

    // 👇 NUOVO: Carica settings dal backend
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
          ...this.globalData.settings,  // Mantiene bridgeIp/username
          ...apiData.userSettings        // Sovrascrive con backend
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
      this.globalData.detailCache[groupId] = data
    },

    getGroupDetailCache(groupId) {
      return this.globalData.detailCache[groupId] || null
    },

    onDestroy(options) {
      console.log('Hue On-Off App Destroyed')
    }
  })
)