import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style, prop, event } from '@zos/ui'
import { getText } from '@zos/i18n'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

export const LAYOUT_CONFIG = {
  sliderX: px(40),
  sliderW: DEVICE_WIDTH - px(80),
  sliderH: px(60),
  // Configurazioni per il bottone che apre il picker
  colorBtnX: px(60),
  colorBtnW: DEVICE_WIDTH - px(120),
  colorBtnH: px(50)
}

const COLORS = {
  background: 0x000000,
  text: 0xffffff,
  highlight: 0x0055ff,
  success: 0x00aa00,
  error: 0xff0000,
  sliderBg: 0x2a2a2a,
  sliderFill: 0x0088ff,
}

export function renderLightDetail(pageContext, state, callbacks) {
    const { light, lightName, isDraggingBrightness, tempBrightness, favoriteColors } = state
    const { toggleLightFunc, setBrightnessDrag, openColorPickerFunc, applyPresetFunc, addFavoriteFunc, getLightBgColor } = callbacks

    // 1. Sfondo
    const lightOn = !!light?.ison;
    const bgColor = lightOn && light.hex ? getLightBgColor(light.hex) : COLORS.background

    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT,
        color: bgColor
    })

    if (!light) return;

    // 2. Header (Titolo)
    pageContext.createTrackedWidget(widget.TEXT, {
        x: px(40), y: px(30), w: DEVICE_WIDTH - px(80), h: px(50),
        text: lightName,
        text_size: px(32),
        color: COLORS.text,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.ELLIPSIS
    })

    let currentY = px(90)

    // 3. Main Toggle Button
    const toggleColor = lightOn ? COLORS.success : COLORS.error
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: (DEVICE_WIDTH - px(360)) / 2,
        y: currentY, w: px(360), h: px(60),
        text: lightOn ? getText('LIGHT_ON') : getText('LIGHT_OFF'),
        normal_color: toggleColor,
        press_color: 0x33ffffff,
        radius: 12,
        click_func: toggleLightFunc
    })

    currentY += px(80)

    const caps = callbacks.capabilities || ['brightness']

    // 4. Brightness Slider (Rimane qui per accesso rapido)
    if (lightOn && caps.includes('brightness')) {
        currentY = renderBrightnessSlider(pageContext, state, currentY, setBrightnessDrag)
    }

    // 5. COLOR BUTTON (Sostituisce il Picker complesso)
    // Mostra un bottone che apre la pagina dedicata
    if (lightOn && (caps.includes('color') || caps.includes('ct'))) {
        currentY = renderColorButton(pageContext, state, currentY, openColorPickerFunc)
    }

    // 6. Presets
    if (lightOn) {
        renderPresets(pageContext, state, currentY, applyPresetFunc, addFavoriteFunc, callbacks)
    }
}

function renderBrightnessSlider(pageContext, state, yPos, dragCallback) {
    const { light, isDraggingBrightness, tempBrightness } = state
    const brightness = isDraggingBrightness ? tempBrightness : light.bri
    const brightnessPercent = Math.round(brightness / 254 * 100)
    const { sliderX, sliderW, sliderH } = LAYOUT_CONFIG
    const trackHeight = px(20)
    const sliderY = yPos + px(40)
    const trackCenterY = sliderY + (sliderH / 2)

    // Label
    const labelWidget = pageContext.createTrackedWidget(widget.TEXT, {
        x: sliderX, y: yPos, w: sliderW, h: px(35),
        text: getText('BRIGHTNESS', brightnessPercent),
        text_size: px(26),
        color: COLORS.text,
        align_h: align.LEFT,
        align_v: align.CENTER_V
    })
    pageContext.state.brightnessLabel = labelWidget

    // Track
    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX, y: trackCenterY - (trackHeight / 2),
        w: sliderW, h: trackHeight,
        color: COLORS.sliderBg, radius: trackHeight / 2
    })

    // Fill
    const fillWidth = Math.round(sliderW * brightness / 254)
    const fillWidget = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX, y: trackCenterY - (trackHeight / 2),
        w: fillWidth, h: trackHeight,
        color: COLORS.sliderFill, radius: trackHeight / 2
    })
    pageContext.state.brightnessSliderFillWidget = fillWidget

    // Hitbox
    const trackHitbox = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX, y: sliderY, w: sliderW, h: sliderH,
        color: 0, alpha: 0
    })

    if (dragCallback) {
        trackHitbox.addEventListener(event.CLICK_DOWN, (info) => dragCallback('DOWN', info))
        trackHitbox.addEventListener(event.MOVE, (info) => dragCallback('MOVE', info))
        trackHitbox.addEventListener(event.CLICK_UP, (info) => dragCallback('UP', info))
    }

    return sliderY + sliderH + px(20)
}

function renderColorButton(pageContext, state, yPos, openCallback) {
    const { colorBtnX, colorBtnW, colorBtnH } = LAYOUT_CONFIG
    const { light } = state

    // Usiamo light.hex per il colore del bottone.
    // light.hex dovrebbe essere calcolato dalla logica (HSB to Hex o CT to Hex)
    const btnColor = light.hex ? parseInt(light.hex.replace('#',''), 16) : 0xFFFFFF;

    // Bordo per visibilità su colori scuri
    pageContext.createTrackedWidget(widget.STROKE_RECT, {
        x: colorBtnX, y: yPos, w: colorBtnW, h: colorBtnH,
        radius: 12, line_width: 2, color: 0xFFFFFF
    })

    // Disegna il bottone con il colore attuale
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: colorBtnX+2, y: yPos+2,
        w: colorBtnW-4, h: colorBtnH-4,
        text: getText('CHANGE'),
        text_size: px(22),
        color: 0x000000, // Testo nero per contrasto su colori vivaci? O dinamico? Teniamo nero per sicurezza su luci accese.
        normal_color: btnColor,
        press_color: 0xFFFFFF,
        radius: 12,
        click_func: openCallback
    })

    return yPos + colorBtnH + px(30)
}

function renderPresets(pageContext, state, yPos, applyCallback, addCallback, callbacks) {
    const { favoriteColors, light } = state

    pageContext.createTrackedWidget(widget.TEXT, {
        x: px(20), y: yPos, w: DEVICE_WIDTH - px(60), h: px(35),
        text: getText('PRESETS_TITLE'),
        text_size: px(24),
        color: COLORS.text,
        align_h: align.LEFT
    })

    pageContext.createTrackedWidget(widget.BUTTON, {
        x: DEVICE_WIDTH - px(60), y: yPos, w: px(40), h: px(35),
        text: '+',
        normal_color: COLORS.highlight, press_color: COLORS.success, radius: px(6),
        click_func: addCallback
    })

    let currentY = yPos + px(40)
    const ITEM_SIZE = px(50)
    const ITEM_MARGIN = px(10)
    const ROW_WIDTH = DEVICE_WIDTH - px(40)
    const COLS = Math.floor(ROW_WIDTH / (ITEM_SIZE + ITEM_MARGIN))
    const startX = px(20) + (ROW_WIDTH - (COLS * (ITEM_SIZE + ITEM_MARGIN) - ITEM_MARGIN)) / 2

    // Access caps from callbacks safely
    const caps = callbacks.capabilities || [];
    const isColorLight = caps.includes('color');

    favoriteColors.forEach((fav, i) => {
        // Mostra solo preset compatibili
        if (fav.isColor && !isColorLight) return;

        const col = i % COLS
        const row = Math.floor(i / COLS)

        pageContext.createTrackedWidget(widget.BUTTON, {
            x: startX + col * (ITEM_SIZE + ITEM_MARGIN),
            y: currentY + row * (ITEM_SIZE + ITEM_MARGIN),
            w: ITEM_SIZE, h: ITEM_SIZE,
            text: '',
            normal_color: parseInt(fav.hex.replace('#', ''), 16),
            press_color: 0x33ffffff,
            radius: px(8),
            click_func: () => applyCallback(fav)
        })
    })
}