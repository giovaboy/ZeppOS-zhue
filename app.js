import { BaseApp } from '@zeppos/zml/base-app'

App(
  BaseApp({
    globalData: {
      lights: [],
      isComingBack: false,
      bridgeConnected: false,
      userSettings: {
        show_global_toggle: true,
        show_scenes: true,
        display_order: 'LIGHTS_FIRST'
      }
    },
    onCreate(options) {
      console.log('Hue On-Off App Created')
    },
    onDestroy(options) {
      console.log('Hue On-Off App Destroyed')
    }
  })
)