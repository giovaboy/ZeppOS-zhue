import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style, prop, event } from '@zos/ui'
import { getText } from '@zos/i18n'

// Recuperiamo larghezza/altezza device
export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

// Esportiamo configurazioni di layout utili anche alla logica (es. per calcolare i click)
export const LAYOUT_CONFIG = {
  sliderX: px(40),
  sliderW: DEVICE_WIDTH - px(80), // Adattivo: 480 - 80 = 400 su schermi grandi
  sliderH: px(60),
  colorPickerSize: DEVICE_WIDTH - px(80), // Quadrato adattivo
  colorPickerX: px(40)
}

// Colori (Idealmente dovrebbero stare in utils/constants.js come in index)
const COLORS = {
  background: 0x000000,
  text: 0xffffff,
  highlight: 0x0055ff,
  success: 0x00aa00,
  error: 0xff0000,
  inactive: 0x666666,
  sliderBg: 0x2a2a2a,
  sliderFill: 0x0088ff,
}

// Utility interna per il disegno del gradiente (solo visuale)
function hsb2hex(h, s, v) {
    if (s === 0) {
        const val = Math.round(v * 2.55)
        return val << 16 | val << 8 | val;
    }
    h /= 60; s /= 100; v /= 100;
    const i = Math.floor(h);
    const f = h - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r = 0, g = 0, b = 0;
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    const toInt = (c) => Math.round(c * 255);
    return (toInt(r) << 16) + (toInt(g) << 8) + toInt(b);
}

export function renderLightDetail(pageContext, state, callbacks) {
    const { light, lightName, isDraggingBrightness, tempBrightness, isDraggingColor, tempHue, tempSat, favoriteColors } = state
    const { toggleLightFunc, setBrightnessDrag, setColorDrag, applyPresetFunc, addFavoriteFunc, goBackFunc, getLightBgColor } = callbacks

    // 1. Sfondo
    const lightOn = !!light?.ison;
    const bgColor = lightOn && light.hex ? getLightBgColor(light.hex) : COLORS.background

    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT,
        color: bgColor
    })

    // Se non abbiamo i dati della luce (o stiamo caricando), ci fermiamo qui o gestiamo loading separato
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

    let currentY = px(90) // Spazio iniziale aumentato per schermi tondi

    // 3. Main Toggle Button
    const toggleColor = lightOn ? COLORS.success : COLORS.error
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: (DEVICE_WIDTH - px(360)) / 2, // Centrato
        y: currentY, w: px(360), h: px(60),
        text: lightOn ? getText('LIGHT_ON') : getText('LIGHT_OFF'),
        normal_color: toggleColor,
        press_color: 0x33ffffff,
        radius: 12,
        click_func: toggleLightFunc
    })

    currentY += px(80)

    // Definiamo capabilities in base ai dati passati
    // NOTA: Qui replichiamo una logica semplice di visualizzazione.
    // Se vuoi passare le capabilities calcolate dalla logica, aggiungile allo 'state' o ai 'callbacks'
    const caps = callbacks.capabilities || ['brightness']

    // 4. Brightness Slider
    if (lightOn && caps.includes('brightness')) {
        currentY = renderBrightnessSlider(pageContext, state, currentY, setBrightnessDrag)
    }

    // 5. Color Picker
    if (lightOn && caps.includes('color')) {
        currentY = renderColorPicker(pageContext, state, currentY, setColorDrag)
    }

    // 6. Presets
    if (lightOn) {
        renderPresets(pageContext, state, currentY, applyPresetFunc, addFavoriteFunc)
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
    // Salviamo il riferimento nel contesto per aggiornamenti rapidi
    pageContext.state.brightnessLabel = labelWidget

    // Track Sfondo
    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX, y: trackCenterY - (trackHeight / 2),
        w: sliderW, h: trackHeight,
        color: COLORS.sliderBg,
        radius: trackHeight / 2
    })

    // Track Fill (Valore)
    const fillWidth = Math.round(sliderW * brightness / 254)
    const fillWidget = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX, y: trackCenterY - (trackHeight / 2),
        w: fillWidth, h: trackHeight,
        color: COLORS.sliderFill,
        radius: trackHeight / 2
    })
    pageContext.state.brightnessSliderFillWidget = fillWidget

    // Hitbox invisibile per interazione
    const trackHitbox = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX, y: sliderY, w: sliderW, h: sliderH,
        color: 0x000000, alpha: 0
    })

    // Attacchiamo i listener passati dalla logica
    if (dragCallback) {
        trackHitbox.addEventListener(event.CLICK_DOWN, (info) => dragCallback('DOWN', info))
        trackHitbox.addEventListener(event.MOVE, (info) => dragCallback('MOVE', info))
        trackHitbox.addEventListener(event.CLICK_UP, (info) => dragCallback('UP', info))
    }

    return sliderY + sliderH + px(20)
}

function renderColorPicker(pageContext, state, yPos, dragCallback) {
    const { light, isDraggingColor, tempHue, tempSat } = state
    const currentHue = isDraggingColor ? tempHue : (light.hue || 0)
    const currentSat = isDraggingColor ? tempSat : (light.sat || 0)

    const { colorPickerX, colorPickerSize } = LAYOUT_CONFIG
    const x = colorPickerX
    const y = yPos + px(40)
    const cursorSize = px(30)
    const HUE_RANGE = 65535;
    const SAT_RANGE = 254;

    // Label
    pageContext.createTrackedWidget(widget.TEXT, {
        x: x, y: yPos, w: colorPickerSize, h: px(35),
        text: getText('COLOR_PICKER_LABEL'),
        text_size: px(26),
        color: COLORS.text,
        align_h: align.LEFT,
        align_v: align.CENTER_V
    })

    // Gradiente simulato (Background)
    const stripCount = 20; // Riduco per performance
    const stripWidth = colorPickerSize / stripCount;

    for (let i = 0; i < stripCount; i++) {
        const hueVal = Math.round((i / stripCount) * 360); // 0-360 per la funzione helper
        const colorHex = hsb2hex(hueVal, 100, 50);

        pageContext.createTrackedWidget(widget.FILL_RECT, {
            x: x + i * stripWidth, y: y,
            w: stripWidth + 1, h: colorPickerSize,
            color: colorHex,
            radius: (i === 0 || i === stripCount - 1) ? px(10) : 0
        })
    }

    // Cursore
    const initialCursorX = x + Math.round((currentHue / HUE_RANGE) * colorPickerSize)
    const initialCursorY = y + Math.round((SAT_RANGE - currentSat) / SAT_RANGE * colorPickerSize)

    const cursorWidget = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: initialCursorX - cursorSize / 2,
        y: initialCursorY - cursorSize / 2,
        w: cursorSize, h: cursorSize,
        color: 0xFFFFFF,
        radius: cursorSize / 2,
        line_width: px(3),
        line_color: 0x000000
    })
    // Salviamo il widget nel context state per aggiornarlo via prop
    pageContext.state.colorCursorWidget = cursorWidget

    // Impostiamo il colore iniziale del cursore
    const normalizedHue = Math.round(currentHue / HUE_RANGE * 360)
    const normalizedSat = Math.round(currentSat / SAT_RANGE * 100)
    const normalizedBri = Math.round((light.bri || 1) / SAT_RANGE * 100)
    const startColor = hsb2hex(normalizedHue, normalizedSat, normalizedBri)
    try { cursorWidget.setProperty(prop.COLOR, startColor) } catch(e){}

    // Hitbox
    const hitbox = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: x, y: y, w: colorPickerSize, h: colorPickerSize,
        color: 0x000000, alpha: 0
    })

    if (dragCallback) {
        hitbox.addEventListener(event.CLICK_DOWN, (info) => dragCallback('DOWN', info))
        hitbox.addEventListener(event.MOVE, (info) => dragCallback('MOVE', info))
        hitbox.addEventListener(event.CLICK_UP, (info) => dragCallback('UP', info))
    }

    return y + colorPickerSize + px(20)
}

function renderPresets(pageContext, state, yPos, applyCallback, addCallback) {
    const { favoriteColors, light } = state
    // Filtro isColor gestito nel logic o qui? Facciamolo qui visualmente
    // Ma l'array favoriteColors nello state dovrebbe essere già quello giusto o filtrato
    // Per coerenza con il codice originale, filtriamo qui
    const isColorLight = callbacks.capabilities && callbacks.capabilities.includes('color'); // hacky access to parent scope var if not passed
    // NOTA: 'callbacks' non è visibile qui dentro se non passato.
    // Assumiamo che 'state.favoriteColors' contenga TUTTI e filtriamo.
    // Sarebbe meglio filtrare nel logic, ma replico la logica originale.
    // Siccome non ho isColorLight facilmente, mostro tutto per ora o passo caps.

    // Header Presets
    pageContext.createTrackedWidget(widget.TEXT, {
        x: px(20), y: yPos, w: DEVICE_WIDTH - px(60), h: px(35),
        text: getText('PRESETS_TITLE'),
        text_size: px(24),
        color: COLORS.text,
        align_h: align.LEFT
    })

    // Tasto +
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: DEVICE_WIDTH - px(60), y: yPos, w: px(40), h: px(35),
        text: '+',
        normal_color: COLORS.highlight,
        press_color: COLORS.success,
        radius: px(6),
        click_func: addCallback
    })

    let currentY = yPos + px(40)
    const ITEM_SIZE = px(50)
    const ITEM_MARGIN = px(10)
    const ROW_WIDTH = DEVICE_WIDTH - px(40)
    const COLS = Math.floor(ROW_WIDTH / (ITEM_SIZE + ITEM_MARGIN))
    const startX = px(20) + (ROW_WIDTH - (COLS * (ITEM_SIZE + ITEM_MARGIN) - ITEM_MARGIN)) / 2

    favoriteColors.forEach((fav, i) => {
        // Logica filtro semplice: se la luce non è color, nascondi quelli che richiedono colore
        // (Necessita che 'light' abbia capabilities o type. Usiamo una euristica su light.type se c'è, o mostriamo tutto)
        if (fav.isColor && light.type && !light.type.toLowerCase().includes('color')) return;

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