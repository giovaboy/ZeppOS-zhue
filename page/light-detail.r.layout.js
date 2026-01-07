import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, prop, event } from '@zos/ui'
import { getText } from '@zos/i18n'
import { BRI_RANGE, COLORS, PRESET_TYPES, btnPressColor, ct2hex, xy2hex } from '../utils/constants'
import { getLogger } from '../utils/logger'

const logger = getLogger('zhue-light-detail-layout')

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

export const LAYOUT_CONFIG = {
  headerY: px(20),
  headerH: px(60),
  sliderX: (DEVICE_WIDTH - px(300)) / 2,
  sliderY: DEVICE_HEIGHT - px(90),
  sliderW: px(300),
  sliderH: px(50),
  colorBtnX: px(60),
  colorBtnW: DEVICE_WIDTH - px(120),
  colorBtnH: px(50),
  presetsTitleH: px(35),
  presetsX: px(60),
  presetsW: DEVICE_WIDTH - px(120),
  presetItemSize: px(60)
}

export function renderLightDetail(pageContext, state, callbacks) {
  const { light, lightName, isLoading, error } = state
  const { retryFunc } = callbacks

  // === GESTIONE STATI PRIORITARIA ===

  // 1. LOADING (priorità massima)
  if (isLoading) {
    renderLoadingState(pageContext, lightName)
    return
  }

  // 2. ERROR
  if (error) {
    renderErrorState(pageContext, lightName, error, retryFunc)
    return
  }

  // 3. NO DATA (sanity check)
  if (!light) {
    renderNoDataState(pageContext, lightName, retryFunc)
    return
  }

  // === RENDERING NORMALE ===
  renderNormalState(pageContext, state, callbacks)
}

// === STATE RENDERERS ===

function renderLoadingState(pageContext, lightName) {
  logger.log('Rendering loading state for light detail page...')
  pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: 0,
    y: 0,
    w: DEVICE_WIDTH,
    h: DEVICE_HEIGHT,
    color: COLORS.background
  })

  // Header
  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0,
    y: LAYOUT_CONFIG.headerY,
    w: DEVICE_WIDTH,
    h: LAYOUT_CONFIG.headerH,
    text: lightName || getText('LIGHT_DETAIL'),
    text_size: px(34),
    color: COLORS.text,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  // Loading text
  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0,
    y: DEVICE_HEIGHT / 2 - px(50),
    w: DEVICE_WIDTH,
    h: px(50),
    text: getText('LOADING'),
    text_size: px(28),
    color: COLORS.loading,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })
}

function renderErrorState(pageContext, lightName, error, retryFunc) {
  pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: 0,
    y: 0,
    w: DEVICE_WIDTH,
    h: DEVICE_HEIGHT,
    color: COLORS.background
  })

  // Header
  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0,
    y: LAYOUT_CONFIG.headerY,
    w: DEVICE_WIDTH,
    h: LAYOUT_CONFIG.headerH,
    text: lightName,
    text_size: px(34),
    color: COLORS.text,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  // Error icon
  pageContext.createTrackedWidget(widget.CIRCLE, {
    center_x: DEVICE_WIDTH / 2,
    center_y: DEVICE_HEIGHT / 2 - px(100),
    radius: px(50),
    color: COLORS.error,
    alpha: 100
  })

  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0,
    y: DEVICE_HEIGHT / 2 - px(130),
    w: DEVICE_WIDTH,
    h: px(60),
    text: '✕',
    text_size: px(60),
    color: COLORS.error,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  // Error message
  pageContext.createTrackedWidget(widget.TEXT, {
    x: px(30),
    y: DEVICE_HEIGHT / 2 - px(20),
    w: DEVICE_WIDTH - px(60),
    h: px(80),
    text: error || getText('ERROR') || 'Error loading light',
    text_size: px(22),
    color: COLORS.textSecondary,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  // Retry button
  if (retryFunc) {
    pageContext.createTrackedWidget(widget.BUTTON, {
      x: DEVICE_WIDTH / 2 - px(80),
      y: DEVICE_HEIGHT / 2 + px(80),
      w: px(160),
      h: px(50),
      text: getText('RETRY') || 'Retry',
      normal_color: COLORS.primary,
      press_color: btnPressColor(COLORS.primary, 0.8),
      radius: px(25),
      click_func: retryFunc
    })
  }
}

function renderNoDataState(pageContext, lightName, retryFunc) {
  pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: 0,
    y: 0,
    w: DEVICE_WIDTH,
    h: DEVICE_HEIGHT,
    color: COLORS.background
  })

  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0,
    y: px(10),
    w: DEVICE_WIDTH,
    h: px(40),
    text: lightName,
    text_size: px(34),
    color: COLORS.text,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  pageContext.createTrackedWidget(widget.TEXT, {
    x: px(30),
    y: DEVICE_HEIGHT / 2 - px(40),
    w: DEVICE_WIDTH - px(60),
    h: px(80),
    text: getText('NO_DATA') || 'No light data available',
    text_size: px(22),
    color: COLORS.textSecondary,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  if (retryFunc) {
    pageContext.createTrackedWidget(widget.BUTTON, {
      x: DEVICE_WIDTH / 2 - px(80),
      y: DEVICE_HEIGHT / 2 + px(40),
      w: px(160),
      h: px(50),
      text: getText('RELOAD') || 'Reload',
      normal_color: COLORS.primary,
      press_color: btnPressColor(COLORS.primary, 0.8),
      radius: px(25),
      click_func: retryFunc
    })
  }
}

function renderNormalState(pageContext, state, callbacks) {
  logger.log('Rendering normal state for light detail page...')
  const { light, lightName, favoriteColors } = state
  const {
    toggleLightFunc,
    setBrightnessDrag,
    openColorPickerFunc,
    applyPresetFunc,
    addFavoriteFunc,
    deleteFavoriteFunc,
    getLightBgColor,
    isInWidgetShortcuts,
    toggleWidgetShortcutFunc
  } = callbacks

  const lightOn = !!light.ison
  let bgColor = COLORS.background

  logger.debug('Light is', lightOn ? 'ON' : 'OFF')
  logger.debug('Light colormode:', light.colormode)
  logger.debug('Light hex color:', light.hex)
  logger.debug('Light ct value:', light.ct)
  logger.debug('Light xy value:', light.xy)
  logger.debug('Light bri value:', light.bri)

  if (lightOn) {
    if (light.colormode === 'hs' && light.hex) {
      bgColor = getLightBgColor(light.hex)
    } else if (light.colormode === 'ct' && light.ct) {
      bgColor = getLightBgColor(ct2hex(light.ct).toString(16).padStart(6, '0').toUpperCase())
    } else if (light.colormode === 'xy' && light.xy) {
      bgColor = getLightBgColor(xy2hex(light.xy, light.bri).toString(16).padStart(6, '0').toUpperCase())
    } else if (light.hex) {
      bgColor = getLightBgColor(light.hex)
    } else {
      bgColor = COLORS.white
    }
  }

  logger.debug('Determined background color:', bgColor.toString(16).padStart(6, '0').toUpperCase())

  // Sfondo
  pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: 0,
    y: 0,
    w: DEVICE_WIDTH,
    h: DEVICE_HEIGHT,
    color: bgColor
  })

  // Header
  // Toggle Button
  const toggleColor = lightOn ? COLORS.success : COLORS.inactive
  pageContext.createTrackedWidget(widget.BUTTON, {
    x: px(20),
    y: LAYOUT_CONFIG.headerY, w: DEVICE_WIDTH - px(40),
    h: lightOn ? LAYOUT_CONFIG.headerH : DEVICE_HEIGHT - LAYOUT_CONFIG.headerY * 2,
    text: lightName,// || lightOn ? getText('LIGHT_ON') : getText('LIGHT_OFF'),
    text_size: px(34),
    normal_color: toggleColor,
    press_color: btnPressColor(toggleColor, 0.8),
    radius: lightOn ? px(8) : DEVICE_HEIGHT - LAYOUT_CONFIG.headerY * 2,
    click_func: toggleLightFunc
  })

  let currentY = LAYOUT_CONFIG.headerY + LAYOUT_CONFIG.headerH + px(10)

  const caps = callbacks.capabilities(light) || ['brightness']

  // Presets
  if (lightOn && favoriteColors) {
    currentY = renderPresets(pageContext, state, currentY, applyPresetFunc, addFavoriteFunc, deleteFavoriteFunc, callbacks)
  }

  // Brightness Slider (solo brightness-only)
  const showBrightnessSlider = lightOn && caps.includes('brightness') && !caps.includes('color') && !caps.includes('ct')
  if (showBrightnessSlider) {
    currentY = renderBrightnessSlider(pageContext, state, currentY, setBrightnessDrag)
  }

  // Color Button
  if (lightOn && (caps.includes('color') || caps.includes('ct'))) {
    currentY = renderColorButton(pageContext, state, currentY, openColorPickerFunc)
  }

  // ==========================================
  // WIDGET SHORTCUT BUTTON
  // ==========================================
  const isInWidget = isInWidgetShortcuts || false
  const toggleWidgetFunc = toggleWidgetShortcutFunc

  if (toggleWidgetFunc) {
    const widgetBtnColor = isInWidget ? COLORS.warning || 0xff6600 : COLORS.highlight || 0x0055ff
    const widgetBtnText = isInWidget ?  '★' : '☆'

    pageContext.createTrackedWidget(widget.BUTTON, {
      x: DEVICE_WIDTH /2 - px(10),
      y: 0,//px(3),
      w: px(20),
      h: LAYOUT_CONFIG.headerY,//px(14),
      text: widgetBtnText,
      text_size: px(14),
      color: COLORS.white,
      normal_color: bgColor,// widgetBtnColor,
      press_color: bgColor,//btnPressColor(widgetBtnColor, 0.8),
      //radius: px(8),
      click_func: toggleWidgetFunc
    })

    //currentY += px(55)
  }

  return currentY
}

// === COMPONENT RENDERERS ===

function renderBrightnessSlider(pageContext, state, yPos, dragCallback) {
  const { light, isDraggingBrightness, tempBrightness } = state
  const brightness = isDraggingBrightness ? tempBrightness : light.bri
  const brightnessPercent = Math.round(brightness / BRI_RANGE * 100)
  const { sliderX, sliderW, sliderH } = LAYOUT_CONFIG

  const sliderY = yPos

  // Track
  pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: sliderX,
    y: sliderY,
    w: sliderW,
    h: sliderH,
    radius: sliderH / 2,
    color: COLORS.sliderBg
  })

  // Fill
  const fillWidth = Math.max(px(10), (brightness / BRI_RANGE) * sliderW)
  const fillWidget = pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: sliderX,
    y: sliderY,
    w: fillWidth,
    h: sliderH,
    radius: sliderH / 2,
    color: COLORS.sliderFill
  })
  pageContext.state.brightnessSliderFillWidget = fillWidget

  // Label
  const labelWidget = pageContext.createTrackedWidget(widget.TEXT, {
    x: sliderX,
    y: sliderY,
    w: sliderW,
    h: sliderH,
    text: `${brightnessPercent}%`,
    text_size: px(28),
    color: COLORS.briText || COLORS.text,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })
  pageContext.state.brightnessLabel = labelWidget

  // Icons
  pageContext.createTrackedWidget(widget.IMG, {
    x: sliderX + px(20),
    y: sliderY + sliderH / 2 - px(32 / 2),
    src: 'bri-low.png'//32*32
  })

  pageContext.createTrackedWidget(widget.IMG, {
    x: sliderX + sliderW - px(20 + 32),
    y: sliderY + sliderH / 2 - px(32 / 2),
    src: 'bri-hi.png'//32*32
  })

  // Hitbox
  const HITBOX_PADDING = px(20)
  const hitbox = pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: sliderX - HITBOX_PADDING,
    y: sliderY - HITBOX_PADDING,
    w: sliderW + (HITBOX_PADDING * 2),
    h: sliderH + (HITBOX_PADDING * 2),
    color: 0,
    alpha: 0
  })

  if (dragCallback) {
    hitbox.addEventListener(event.CLICK_DOWN, (info) => dragCallback('DOWN', info))
    hitbox.addEventListener(event.MOVE, (info) => dragCallback('MOVE', info))
    hitbox.addEventListener(event.CLICK_UP, (info) => dragCallback('UP', info))
  }

  return sliderY + sliderH + px(30)
}

function renderColorButton(pageContext, state, yPos, openCallback) {
  const { colorBtnX, colorBtnW, colorBtnH } = LAYOUT_CONFIG
  const { light } = state

  let btnColor
  if (light.colormode === 'hs' && light.hex) {
    btnColor = parseInt(light.hex.replace('#', '0x'), 16)
  } else if (light.colormode === 'ct' && light.ct) {
    btnColor = ct2hex(light.ct)
  } else if (light.colormode === 'xy' && light.xy) {
    btnColor = xy2hex(light.xy, light.bri || BRI_RANGE)
  } else {
    btnColor = COLORS.white
  }
  //return btnColor

  // Border
  /*pageContext.createTrackedWidget(widget.STROKE_RECT, {
    x: colorBtnX,
    y: yPos,
    w: colorBtnW,
    h: colorBtnH,
    radius: 12,
    line_width: 2,
    color: 0xFFFFFF
  })*/

  // Button
  /* pageContext.createTrackedWidget(widget.BUTTON, {
     x: colorBtnX + 2,
     y: yPos + 2,
     w: colorBtnW - 4,
     h: colorBtnH - 4,
     text: getText('CHANGE'),
     text_size: px(22),
     color: 0x000000,
     normal_color: btnColor,
     press_color: btnPressColor(btnColor, 0.8),
     radius: 12,
     click_func: openCallback
   })
 */

  // color picker background
  let iconSize = px(70)
  const iconX = DEVICE_WIDTH / 2 - iconSize / 2
  const iconY = DEVICE_HEIGHT - iconSize - px(20)
  pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: iconX + px(10),
    y: iconY + px(12),
    w: iconSize - px(26),
    h: iconSize - px(22),
    radius: px(8),
    color: btnColor
  })
  // color picker mask
  pageContext.createTrackedWidget(widget.IMG, {
    x: iconX,
    y: iconY,
    w: iconSize,
    h: iconSize,
    src: 'color-picker2.png',
    auto_scale: true
  })

  // Clickable overlay for toggle
  const toggleOverlay = pageContext.createTrackedWidget(widget.BUTTON, {
    x: iconX - px(5),
    y: iconY,
    w: iconSize + px(10),
    h: iconSize + px(30),
    text: '',
    normal_color: COLORS.black,
    press_color: COLORS.white,
    //radius: px(10),
    click_func: openCallback
  })

  toggleOverlay.setAlpha(0)

  return yPos + colorBtnH + px(30)
}

function renderPresets(pageContext, state, yPos, applyCallback, addCallback, deleteCallback, callbacks) {
  const { presetsW, presetsX, presetsTitleH, presetItemSize } = LAYOUT_CONFIG
  const { light, favoriteColors, scrollPos_y } = state

  // Header
  pageContext.createTrackedWidget(widget.TEXT, {
    x: presetsX,
    y: yPos,
    w: presetsW - px(40),
    h: presetsTitleH,
    text: getText('PRESETS_TITLE'),
    text_size: px(24),
    text_w: 50,
    color: COLORS.text,
    align_h: align.LEFT
  })

  // Add button
  pageContext.createTrackedWidget(widget.BUTTON, {
    x: presetsX + presetsW - px(40),
    y: yPos,
    w: px(40),
    h: presetsTitleH,
    text: '+',
    text_size: px(24),
    normal_color: COLORS.highlight,
    press_color: btnPressColor(COLORS.highlight, 0.8),
    radius: px(6),
    click_func: addCallback
  })

  // Calcoliamo l'area rimanente per i bottoni
  const gridY = yPos + presetsTitleH + px(10)
  const containerHeight = DEVICE_HEIGHT - gridY - px(90) - px(10)// Arriva fino a poco prima del pulsante per i colori o slider bri

  // 3. IL VIEW_CONTAINER (Solo per la griglia dei bottoni)
  const presetContainer = pageContext.createTrackedWidget(widget.VIEW_CONTAINER, {
    x: 0,
    y: gridY,
    w: DEVICE_WIDTH,
    h: containerHeight,
    scroll_enable: true,
    bounce: false,
    pos_y: scrollPos_y || 0,
    scroll_frame_func: (FrameParams) => {
      if (FrameParams.yoffset !== undefined && callbacks.onScrollChange) {
        callbacks.onScrollChange(FrameParams.yoffset)
      }
    }
  })

  /*presetContainer.createWidget(widget.FILL_RECT, {
   x: 0,
   y: 0,
   w: DEVICE_WIDTH,
   h: containerHeight + px(20),
   color: COLORS.background
 })*/

  const ITEM_SIZE = presetItemSize
  const ITEM_MARGIN = px(10)
  const ROW_WIDTH = presetsW
  const COLS = Math.floor(ROW_WIDTH / (ITEM_SIZE + ITEM_MARGIN))
  const startX = presetsX + (ROW_WIDTH - (COLS * (ITEM_SIZE + ITEM_MARGIN) - ITEM_MARGIN)) / 2

  const caps = callbacks.capabilities(light) || []
  const isColorLight = caps.includes('color')
  const isCtLight = caps.includes('ct')

  // Filtra preset compatibili
  const compatiblePresets = favoriteColors.filter(fav => {
    switch (fav.type) {
      case PRESET_TYPES.COLOR:
        return isColorLight
      case PRESET_TYPES.CT:
        return isCtLight || isColorLight
      case PRESET_TYPES.WHITE:
        return !isCtLight && !isColorLight
      default:
        return false
    }
  })

  if (compatiblePresets.length === 0) {
    presetContainer.createWidget(widget.TEXT, {
      x: 0, y: px(20), w: DEVICE_WIDTH, h: px(50),
      text: getText('NO_PRESETS') || 'No presets',
      text_size: px(22),
      color: COLORS.inactive,
      align_h: align.CENTER_H
    })
    return gridY + containerHeight
  }

  // Render presets
  compatiblePresets.forEach((fav, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)

    let buttonText = ''
    if (fav.type === PRESET_TYPES.WHITE) {
      const briPercent = Math.round((fav.bri / BRI_RANGE) * 100)
      buttonText = `${briPercent}%`
    }

    presetContainer.createWidget(widget.BUTTON, {
      x: startX + col * (ITEM_SIZE + ITEM_MARGIN),
      y: row * (ITEM_SIZE + ITEM_MARGIN),
      w: ITEM_SIZE,
      h: ITEM_SIZE,
      color: 0x000000,
      text: buttonText,
      text_size: px(18),
      normal_color: parseInt(fav.hex.replace('#', '0x'), 16),
      press_color: btnPressColor(parseInt(fav.hex.replace('#', '0x'), 16), 0.8),
      radius: fav.type === PRESET_TYPES.COLOR ? ITEM_SIZE / 2 : 8,
      click_func: () => applyCallback(fav),
      longpress_func: () => deleteCallback(fav)
    })
  })

  // 5. Padding finale per lo scroll (invisibile)
  const numRows = Math.ceil(compatiblePresets.length / COLS)
  const contentHeight = numRows * (ITEM_SIZE + ITEM_MARGIN)

  presetContainer.createWidget(widget.FILL_RECT, {
    x: 0, y: contentHeight, w: DEVICE_WIDTH, h: px(20), alpha: 0
  })

  return gridY + containerHeight
}