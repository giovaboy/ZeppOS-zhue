import { BaseApp } from '@zeppos/zml/base-app'
import { log } from '@zos/utils'

App(
  BaseApp({
    globalData: {
      // Dati Applicativi (Runtime)
      data: {
        rooms: [],
        zones: [],
        hasLoadedOnce: false // Flag per sapere se abbiamo dati validi
      },
      
      // Impostazioni Utente (Persistenti)
      settings: {
        bridgeIp: null,
        username: null,
        show_global_toggle: true,
        show_scenes: true,
        display_order: 'LIGHTS_FIRST'
      }
    },

    onCreate(options) {
      console.log('Hue On-Off App Created')
      // Qui in futuro caricherai i settings dal file system
    },

    // --- HELPER METHODS ---
    // Usiamo questi metodi invece di toccare globalData direttamente
    // così se domani cambi struttura, modifichi solo qui.
    
    setGroupsData(apiData) {
      console.log('Global Store: Updating Groups Data')
      this.globalData.data.rooms = apiData.rooms || []
      this.globalData.data.zones = apiData.zones || []
      this.globalData.data.hasLoadedOnce = true
    },

    getGroupsData() {
      return this.globalData.data
    },

    onDestroy(options) {
      console.log('Hue On-Off App Destroyed')
    }
  })
)
