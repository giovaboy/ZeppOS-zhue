import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style, prop, event } from '@zos/ui'
import { createModal, MODAL_CONFIRM } from '@zos/interaction'
import { getText } from '@zos/i18n'
import { COLORS, PRESET_TYPES, ct2hex, hsb2hex } from '../utils/constants'
import { getLogger } from '../utils/logger'

const logger = getLogger('light-detail.layout')

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
    const { light, lightName, favoriteColors, isLoading } = state
    const { toggleLightFunc, setBrightnessDrag, openColorPickerFunc, applyPresetFunc, addFavoriteFunc, deleteFavoriteFunc, getLightBgColor } = callbacks

    // 1. Sfondo
    const lightOn = !!light?.ison;
    let bgColor = COLORS.background;

    if (!lightOn) {
        // Se la luce è spenta, il colore rimane il default (sfondo)
        // bgColor = COLORS.background; // Già fatto sopra
    } else if (light.colormode === 'hs' && light.hex) {
        // 1. Modalità Colore
        bgColor = getLightBgColor(light.hex);
    } else if (light.colormode === 'ct' && light.ct) {
        // 2. Modalità Temperatura Colore
        bgColor = ((ct2hex(light.ct) >> 3) & 0x1f1f1f) + 0x0a0a0a
    } else {
        // Modalità sconosciuta (es. solo luminosità) o dati mancanti
        bgColor = COLORS.background;
    }

    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT,
        color: bgColor
    })

    if (!light) return;

    // 2. Header (Titolo)
    pageContext.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(10), w: DEVICE_WIDTH, h: px(40),
        text: lightName,
        text_size: px(34),
        color: COLORS.text,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
    })

    let currentY = px(90)
    
      // 2. Loading State
    if (isLoading) {
        pageContext.createTrackedWidget(widget.TEXT, {
            x: 0, y: px(200), w: DEVICE_WIDTH, h: px(50),
            text: getText('LOADING'),
            text_size: px(28),
            color: COLORS.inactive,
            align_h: align.CENTER_H,
            align_v: align.CENTER_V
        })
        return
    }

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
        currentY = renderPresets(pageContext, state, currentY, applyPresetFunc, addFavoriteFunc, deleteFavoriteFunc, callbacks)
    }

    return currentY; // Ritorna l'ultima Y
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
        radius: sliderH / 2,
        color: COLORS.sliderBg
    })

    // Fill (parte riempita in base al valore)
    // Utilizziamo Math.max(px(5), ...) per garantire che il riempimento sia visibile anche a luminosità molto basse
    const fillWidth = Math.max(px(5), (brightness / 254) * sliderW)
    const fillWidget = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX,
        y: sliderY,
        w: fillWidth,
        h: sliderH,
        radius: sliderH / 2,
        color: COLORS.sliderFill
    })
    pageContext.state.brightnessSliderFillWidget = fillWidget

    // Testo / Percentuale
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

    // Icona Bassa Luminosità
    pageContext.createTrackedWidget(widget.IMG, {
        x: sliderX + px(20),
        y: sliderY + sliderH / 2 - px(24 / 2),
        src: 'bri-low.png'//24*24
    })

    // Icona Alta Luminosità
    pageContext.createTrackedWidget(widget.IMG, {
        x: sliderX + sliderW - px(20 + 32),
        y: sliderY + sliderH / 2 - px(32 / 2),
        src: 'bri-hi.png'//32*32
    })

    // Hitbox (area touch estesa - CRUCIALE per la stabilità del touch)
    const HITBOX_PADDING = px(20);
    const hitbox = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX - HITBOX_PADDING,
        y: sliderY - HITBOX_PADDING,
        w: sliderW + (HITBOX_PADDING * 2),
        h: sliderH + (HITBOX_PADDING * 2),
        color: 0,
        alpha: 0 // Invisibile
    })

    if (dragCallback) {
        // Aggiungi i listener al widget hitbox
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
    //const btnColor = light.colormode === 'hs' ? parseInt(light.hex.replace('#', '0x'), 16) : ct2hex(light.ct);

    let btnColor;

    if (light.colormode === 'hs' && light.hex) {
        // Caso 2: Modalità Colore (HS). Usa il valore HEX già calcolato.
        btnColor = parseInt(light.hex.replace('#', '0x'), 16);
    } else if (light.colormode === 'ct' && light.ct) {
        // Caso 3: Modalità Temperatura (CT). Converte CT -> HEX String -> Intero.
        btnColor = ct2hex(light.ct);
    } else {
        // Caso 4: Solo Luminosità / Fallback (es. light.colormode non definito).
        // Usiamo il bianco puro per indicare che è accesa ma non ha un colore specifico.
        btnColor = 0xFFFFFF; // Bianco
    }

    logger.debug('Rendering color button. light.colormode:', light.colormode, 'light.ct:', light.ct, 'hex:', light.hex, 'parsed as', btnColor);

    // Bordo per visibilità su colori scuri
    pageContext.createTrackedWidget(widget.STROKE_RECT, {
        x: colorBtnX, y: yPos, w: colorBtnW, h: colorBtnH,
        radius: 12, line_width: 2, color: 0xFFFFFF
    })

    // Disegna il bottone con il colore attuale
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: colorBtnX + 2, y: yPos + 2,
        w: colorBtnW - 4, h: colorBtnH - 4,
        text: getText('CHANGE'),
        text_size: px(22),
        color: 0x000000,
        normal_color: btnColor,
        press_color: 0xFFFFFF,
        radius: 12,
        click_func: openCallback
    })

    return yPos + colorBtnH + px(30)
}

function renderPresets(pageContext, state, yPos, applyCallback, addCallback, deleteCallback, callbacks) {
    const { presetsW, presetsX } = LAYOUT_CONFIG
    const { favoriteColors, light } = state

    pageContext.createTrackedWidget(widget.TEXT, {
        x: presetsX, y: yPos, w: presetsW - px(40), h: px(35),
        text: getText('PRESETS_TITLE'),
        text_size: px(24),
        color: COLORS.text,
        align_h: align.LEFT
    })

    pageContext.createTrackedWidget(widget.BUTTON, {
        x: DEVICE_WIDTH - px(60), y: yPos, w: px(40), h: px(35),
        text: '+',
        normal_color: COLORS.highlight, press_color: COLORS.success, radius: 6,
        click_func: addCallback
    })

    let currentY = yPos + px(40)
    const ITEM_SIZE = px(60)
    const ITEM_MARGIN = px(10)
    const ROW_WIDTH = presetsW
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
                // Un preset WHITE viene mostrato solo se la luce NON supporta CT o COLOR,
                // altrimenti l'utente dovrebbe usare lo slider Bri nel picker.
                return !isCtLight && !isColorLight;
            default:
                return false;
        }
    });

    if (compatiblePresets.length === 0) {
        pageContext.createTrackedWidget(widget.TEXT, {
            x: presetsX, y: currentY, w: presetsW, h: px(50),
            text: getText('NO_PRESETS'),
            text_size: px(22),
            color: COLORS.inactive,
            align_h: align.CENTER_H
        })
        currentY += px(60);
        return currentY;
    }

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
            // Usa parseInt con prefisso 0x
            normal_color: parseInt(fav.hex.replace('#', '0x'), 16),
            press_color: 0x33ffffff,
            radius: fav.type === PRESET_TYPES.COLOR ? ITEM_SIZE/2 : 8,
            click_func: () => applyCallback(fav),
            longpress_func: () => deleteCallback(fav) //qui aprimo un createModal per eliminare il preferito
        })
    })

    const numRows = Math.ceil(compatiblePresets.length / COLS);
    return currentY + (numRows * (ITEM_SIZE + ITEM_MARGIN)) + px(20);
}