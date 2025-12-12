import { BaseApp } from '@zeppos/zml/base-app'

App(
  BaseApp({
    globalData: {
      lights: [],
      isComingBack: false,
      bridgeConnected: false
    },
    onCreate(options) {
      console.log('Hue On-Off App Created')
    },
    onDestroy(options) {
      console.log('Hue On-Off App Destroyed')
    }
  })
)