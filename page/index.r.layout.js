import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { createWidget, deleteWidget, widget, align, prop, text_style, event, getTextLayout, anim_status, setStatusBarVisible } from '@zos/ui'
import { getText } from '@zos/i18n'
import { getLogger } from '../utils/logger.js'

const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()
const TEXT_SIZE = DEVICE_WIDTH / 16;

const NOTIFICATION_X = 60
const NOTIFICATION_Y = 350
const NOTIFICATION_WIDTH = DEVICE_WIDTH - (NOTIFICATION_X * 2)
const NOTIFICATION_H_MIN = 40
const NOTIFICATION_TEXT_SIZE = 32

const logger = getLogger('hue-on-off-layout')

export const LOADING_TEXT_WIDGET = {
  x: 0,
  y: (DEVICE_HEIGHT/2)+155,
  w: DEVICE_WIDTH, h: TEXT_SIZE*1.5,
  text_size: TEXT_SIZE,
  color: COLOR_WHITE,
  align_h: align.CENTER_H,
  align_v: align.CENTER_V,
  text_style: text_style.WRAP,
  text: getText('loading')
};

export const LOADING_IMG_ANIM_WIDGET = {//155*155
    anim_path: 'anim',
    anim_prefix: 'loading',
    anim_ext: 'png',
    anim_fps: 24,
    anim_size: 54,
    repeat_count: 0,
    anim_status: anim_status.START,
    x: (DEVICE_WIDTH/2)-(155/2), y: DEVICE_HEIGHT/2
  };


export function createLayout(lights = [], isPairing = false) {
  if (isPairing) {
    return createPairingLayout()
  }
  
  if (lights.length === 0) {
    return createInitialLayout()
  }
  
  return createLightsLayout(lights)
}

function createInitialLayout() {
  return {
    type: 'page',
    children: [
      {
        type: 'fill-rect',
        x: 0,
        y: 0,
        w: DEVICE_HEIGHT,
        h: DEVICE_HEIGHT,
        color: COLORS.background
      },
      {
        type: 'text',
        id: 'title',
        x: 0,
        y: px(30),
        w: DEVICE_HEIGHT,
        h: px(60),
        text: 'Hue Lights',
        text_size: px(42),
        color: COLORS.text,
        align_h: 'center',
        align_v: 'center'
      },
      {
        type: 'text',
        id: 'status',
        x: 0,
        y: px(100),
        w: DEVICE_HEIGHT,
        h: px(40),
        text: 'Bridge not connected',
        text_size: px(26),
        color: COLORS.error,
        align_h: 'center',
        align_v: 'center'
      },
      {
        type: 'button',
        id: 'pairButton',
        x: px(90),
        y: px(200),
        w: px(300),
        h: px(60),
        text: 'PAIR BRIDGE',
        text_size: px(26),
        normal_color: COLORS.warning,
        press_color: COLORS.highlight,
        radius: px(10)
      }
    ]
  }
}

function createPairingLayout() {
  return {
    type: 'page',
    children: [
      {
        type: 'fill-rect',
        x: 0,
        y: 0,
        w: DEVICE_HEIGHT,
        h: DEVICE_HEIGHT,
        color: COLORS.warning
      },
      {
        type: 'text',
        x: 0,
        y: px(80),
        w: DEVICE_HEIGHT,
        h: px(60),
        text: 'Hue Bridge',
        text_size: px(36),
        color: COLORS.warningText,
        align_h: 'center',
        align_v: 'center'
      },
      {
        type: 'circle',
        id: 'bridgeIcon',
        center_x: DEVICE_HEIGHT / 2,
        center_y: px(200),
        radius: px(50),
        color: COLORS.warningText
      },
      {
        type: 'text',
        id: 'pairingText',
        x: px(40),
        y: px(280),
        w: DEVICE_HEIGHT - px(80),
        h: px(120),
        text: 'Pairing! Push the button on your Hue bridge.',
        text_size: px(28),
        color: COLORS.warningText,
        align_h: 'center',
        align_v: 'center',
        text_style: 'wrap'
      },
      {
        type: 'fill-rect',
        id: 'progress',
        x: px(190),
        y: px(420),
        w: px(10),
        h: px(6),
        color: COLORS.warningText,
        radius: px(3)
      }
    ]
  }
}

function createLightsLayout(lights) {
  const lightItems = lights.map((light, index) => ({
    type: 'group',
    y: px(160 + index * 85),
    children: [
      {
        type: 'fill-rect',
        x: px(20),
        y: 0,
        w: DEVICE_HEIGHT - px(40),
        h: px(75),
        color: getLightBgColor(light),
        radius: px(10)
      },
      {
        type: 'text',
        x: px(30),
        y: px(10),
        w: DEVICE_HEIGHT - px(60),
        h: px(40),
        text: light.name,
        text_size: px(32),
        color: light.ison ? COLORS.text : COLORS.inactive
      },
      {
        type: 'text',
        x: px(30),
        y: px(45),
        w: DEVICE_HEIGHT - px(60),
        h: px(30),
        text: light.reachable ? `Brightness: ${light.bri}` : 'Unreachable',
        text_size: px(24),
        color: light.ison ? COLORS.text : COLORS.inactive
      },
      {
        type: 'button',
        id: `light_${index}`,
        x: px(20),
        y: 0,
        w: DEVICE_HEIGHT - px(40),
        h: px(75),
        text: '',
        normal_color: 0x00000000,
        press_color: 0x33ffffff,
        radius: px(10)
      }
    ]
  }))

  return {
    type: 'page',
    children: [
      {
        type: 'fill-rect',
        x: 0,
        y: 0,
        w: DEVICE_HEIGHT,
        h: DEVICE_HEIGHT,
        color: COLORS.background
      },
      {
        type: 'text',
        x: 0,
        y: px(20),
        w: DEVICE_HEIGHT,
        h: px(50),
        text: 'Hue Lights',
        text_size: px(38),
        color: COLORS.text,
        align_h: 'center',
        align_v: 'center'
      },
      {
        type: 'text',
        id: 'status',
        x: 0,
        y: px(75),
        w: DEVICE_HEIGHT,
        h: px(35),
        text: `${lights.length} lights`,
        text_size: px(24),
        color: COLORS.text,
        align_h: 'center',
        align_v: 'center'
      },
      ...lightItems.slice(0, 3), // Show up to 3 lights (scrolling would need scroll_list)
      {
        type: 'button',
        id: 'allOnButton',
        x: px(30),
        y: DEVICE_HEIGHT - px(110),
        w: px(190),
        h: px(50),
        text: 'ALL ON',
        text_size: px(22),
        normal_color: COLORS.highlight,
        press_color: COLORS.success,
        radius: px(8)
      },
      {
        type: 'button',
        id: 'allOffButton',
        x: DEVICE_HEIGHT - px(220),
        y: DEVICE_HEIGHT - px(110),
        w: px(190),
        h: px(50),
        text: 'ALL OFF',
        text_size: px(22),
        normal_color: COLORS.highlight,
        press_color: COLORS.error,
        radius: px(8)
      },
      {
        type: 'button',
        id: 'refreshButton',
        x: px(190),
        y: DEVICE_HEIGHT - px(170),
        w: px(100),
        h: px(45),
        text: 'REFRESH',
        text_size: px(18),
        normal_color: 0x333333,
        press_color: COLORS.highlight,
        radius: px(8)
      }
    ]
  }
}

function getLightBgColor(light) {
  if (!light.ison || !light.hex) {
    return 0x1a1a1a
  }
  
  const hex = light.hex.replace('#', '')
  if (hex === '000000') return 0x1a1a1a
  
  const color = parseInt(hex, 16)
  // Darken for better text visibility
  return ((color >> 2) & 0x3f3f3f) + 0x202020
}