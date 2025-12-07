import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style, prop, event } from '@zos/ui'
import { createModal, MODAL_CONFIRM } from '@zos/interaction'
import { getText } from '@zos/i18n'
import { COLORS, PRESET_TYPES } from '../utils/constants'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

export const LAYOUT_CONFIG = {
  sliderX: px(40),
  sliderW: DEVICE_WIDTH - px(80),
  sliderH: px(60),
  // Configurazioni per il bottone che apre il picker
  colorBtnX: px(60),
  colorBtnW: DEVICE_WIDTH - px(120),
  colorBtnH: px(50),
  
  presetsX: px(60),
  presetsW: DEVICE_WIDTH - px(120)
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

    // 4. Brightness Slider
    // Mostralo SOLO se:
    // - La luce è accesa
    // - Supporta brightness
    // - NON supporta colori (se supporta colori, lo slider è nel color-picker)
    const showBrightnessSlider = lightOn && caps.includes('brightness') && !caps.includes('color') && !caps.includes('ct')

    if (showBrightnessSlider) {
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

    // Posizionamento come nel color-picker
    const sliderY = yPos

    // Track (sfondo dello slider)
    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX,
        y: sliderY,
        w: sliderW,
        h: sliderH,
        radius: sliderH/2,
        color: COLORS.sliderBg
    })

    // Fill (parte riempita in base al valore)
    const fillWidth = Math.max(px(20), (brightness / 254) * sliderW)
    const fillWidget = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX,
        y: sliderY,
        w: fillWidth,
        h: sliderH,
        radius: sliderH/2,
        color: COLORS.sliderFill
    })
    pageContext.state.brightnessSliderFillWidget = fillWidget

    const labelWidget = pageContext.createTrackedWidget(widget.TEXT, {
        x: sliderX, 
        y: sliderY, 
        w: sliderW, 
        h: sliderH,
        text: `${brightnessPercent}%`,
        text_size: px(28),
        color: COLORS.briText,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
    })
    pageContext.state.brightnessLabel = labelWidget
    
    pageContext.createTrackedWidget(widget.IMG, {
        x: sliderX + px(20),
        y: sliderY,
        src: bri_low
    })
    
    pageContext.createTrackedWidget(widget.IMG, {
        x: sliderX + sliderW - px(20),
        y: sliderY,
        src: bri_hi
    })
    
    // Hitbox (area touch estesa come nel color-picker)
    const hitbox = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX - 20,
        y: sliderY - 20,
        w: sliderW + 40,
        h: sliderH + 40,
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
    const { presetsW, presetsX} = LAYOUT_CONFIG
    const { favoriteColors, light } = state

    pageContext.createTrackedWidget(widget.TEXT, {
        x: presetsX, y: yPos, w: presetsW - px(40), h: px(35),
        text: getText('PRESETS_TITLE'),
        text_size: px(24),
        color: COLORS.text,
        align_h: align.LEFT
    })

    pageContext.createTrackedWidget(widget.BUTTON, {
        x: DEVICE_WIDTH - px(60),  y: yPos, w: px(40), h: px(35),
        text: '+',
        normal_color: COLORS.highlight, press_color: COLORS.success, radius: px(6),
        click_func: addCallback
    })

    let currentY = yPos + px(40)
    const ITEM_SIZE = px(60)
    const ITEM_MARGIN = px(10)
    const ROW_WIDTH = presetsW//DEVICE_WIDTH - px(40)
    const COLS = Math.floor(ROW_WIDTH / (ITEM_SIZE + ITEM_MARGIN))
    const startX = presetsX + (ROW_WIDTH - (COLS * (ITEM_SIZE + ITEM_MARGIN) - ITEM_MARGIN)) / 2

    // Access caps from callbacks safely
    const caps = callbacks.capabilities || [];
    const isColorLight = caps.includes('color');
    const isCtLight = caps.includes('ct');

    // Filtra i preset in base alla compatibilità della luce (IL FIX)
    const compatiblePresets = favoriteColors.filter(fav => {
        switch (fav.type) {
            case PRESET_TYPES.COLOR:
                // Richiede una luce che supporti il colore
                return isColorLight;
            case PRESET_TYPES.CT:
                // Richiede una luce che supporti CT *o* COLOR
                return isCtLight || isColorLight;
            case PRESET_TYPES.WHITE:
                return !isCtLight && !isColorLight;
            default:
                return false;
        }
    });

    compatiblePresets.forEach((fav, i) => {
        const col = i % COLS
        const row = Math.floor(i / COLS)

        let buttonText = '';
        if (fav.type === PRESET_TYPES.WHITE) {
            // Calcola la percentuale di luminosità (bri va da 0 a 254)
            const briPercent = Math.round((fav.bri / 254) * 100);
            buttonText = `${briPercent}%`;
        }

        pageContext.createTrackedWidget(widget.BUTTON, {
            x: startX + col * (ITEM_SIZE + ITEM_MARGIN),
            y: currentY + row * (ITEM_SIZE + ITEM_MARGIN),
            w: ITEM_SIZE, h: ITEM_SIZE,
            color: 0x000000,
            text: buttonText,
            text_size: px(18),
            normal_color: parseInt(fav.hex.replace('#', '0x'), 16),
            press_color: 0x33ffffff,
            radius: px(8),
            click_func: () => applyCallback(fav),
            //longpress_func: () => deleteCallback(fav) //qui aprimo un createModal per eliminare il preferito
        })
    })
}