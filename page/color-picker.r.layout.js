import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style, prop, event } from '@zos/ui'
import { getText } from '@zos/i18n'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

// Range API Hue/Sat/Bri
const HUE_RANGE = 65535;
const SAT_RANGE = 254;
const BRI_RANGE = 254;

// Configurazione Layout
export const LAYOUT_CONFIG = {
  pickerSize: px(300), // Area grande centrale
  pickerX: (DEVICE_WIDTH - px(300)) / 2,
  pickerY: px(80),     // Spazio per i tab sopra
  sliderW: px(320),
  sliderH: px(50),
  sliderX: (DEVICE_WIDTH - px(320)) / 2,
  sliderY: DEVICE_HEIGHT - px(90) // In basso
}

const COLORS = {
  text: 0xffffff,
  activeTab: 0x0055ff,
  inactiveTab: 0x333333,
  sliderBg: 0x2a2a2a,
  sliderFill: 0xffffff, // Bianco per la luminosità qui
}

// Utility HSB to Hex (Visuale)
export function hsb2hex(h, s, v) {
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

// Utility CT (Mireds) to Hex approssimativo per visualizzazione
function ct2hex(mireds) {
    // 153 (6500K - Freddo) -> 500 (2000K - Caldo)
    // Semplificazione visiva: interpoliamo tra Bluino e Giallino
    const pct = (mireds - 153) / (500 - 153);
    // Cold: 0xCCDDFF, Warm: 0xFFB044
    // R: CC->FF, G: DD->B0, B: FF->44
    const r = 0xCC + (0xFF - 0xCC) * pct;
    const g = 0xDD + (0xB0 - 0xDD) * pct;
    const b = 0xFF + (0x44 - 0xFF) * pct;
    return (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b);
}

export function renderColorPickerPage(pageContext, state, callbacks) {
    const { mode, supportsColor, supportsCT } = state;
    const { onTabSwitch } = callbacks;

    // 1. Sfondo nero totale per far risaltare i colori
    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT, color: 0x000000
    })

    // 2. Tabs (Solo se supporta entrambi)
    if (supportsColor && supportsCT) {
        renderTabs(pageContext, mode, onTabSwitch);
    }

    // 3. Main Picker Area (Switch in base al modo)
    if (mode === 'color') {
        renderHueSatPicker(pageContext, state, callbacks);
    } else {
        renderCTPicker(pageContext, state, callbacks);
    }

    // 4. Brightness Slider (Comune a entrambi)
    renderBrightnessSlider(pageContext, state, callbacks);
}

function renderTabs(pageContext, currentMode, onTabSwitch) {
    const btnW = px(120);
    const btnH = px(40);
    const y = px(30);
    const gap = px(20);
    const totalW = (btnW * 2) + gap;
    const startX = (DEVICE_WIDTH - totalW) / 2;

    // Tab Color
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: startX, y: y, w: btnW, h: btnH,
        text: 'Color',
        radius: 20,
        normal_color: currentMode === 'color' ? COLORS.activeTab : COLORS.inactiveTab,
        press_color: COLORS.activeTab,
        click_func: () => onTabSwitch('color')
    });

    // Tab White
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: startX + btnW + gap, y: y, w: btnW, h: btnH,
        text: 'White',
        radius: 20,
        normal_color: currentMode === 'ct' ? COLORS.activeTab : COLORS.inactiveTab,
        press_color: COLORS.activeTab,
        click_func: () => onTabSwitch('ct')
    });
}

function renderHueSatPicker(pageContext, state, callbacks) {
    const { pickerX, pickerY, pickerSize } = LAYOUT_CONFIG;
    const { hue, sat, bri } = state;
    const { onDragColor } = callbacks;

    // --- Selettore Colore (Matrice Hue/Saturation) ---
    const H_RESOLUTION = 18; // Numero di colonne (Hue)
    const S_RESOLUTION = 18; // Numero di righe (Saturation)

    const cellW = pickerSize / H_RESOLUTION; // Larghezza di ogni quadratino
    const cellH = pickerSize / S_RESOLUTION; // Altezza di ogni quadratino

    // Ciclo esterno: Tonalità (Hue) sull'asse X
    for(let i = 0; i < H_RESOLUTION; i++) {
        // Calcolo della Tonalità per questa colonna
        const hueVal = (i / H_RESOLUTION) * 360;

        // Ciclo interno: Saturazione (Saturation) sull'asse Y
        for(let j = 0; j < S_RESOLUTION; j++) {

            // Calcolo della Saturazione per questa riga
            // La Saturazione è massima (100) in fondo (j=S_RESOLUTION-1) e minima (0) in cima (j=0).
            const satVal = (1 - (j / S_RESOLUTION)) * 100; // 100% in cima, 0% in fondo

            // Colore da disegnare: Hue della colonna, Saturation della riga, Luminosità massima (100)
            const hexColor = hsb2hex(hueVal, satVal, 100);

            // Disegna il quadratino
            pageContext.createTrackedWidget(widget.FILL_RECT, {
                x: pickerX + (i * cellW),
                //y: pickerY + (pickerSize - cellH) - (j * cellH), // <--- ATTENZIONE: Disegno dal basso
                // Disegno dall'alto (j=0) verso il basso (j=max)
                y: pickerY + (j * cellH),
                w: cellW + 1,
                h: cellH + 1,
                color: hexColor,
                radius: 0
            });
        }
    }

    // B. Cursore
    //const cursorSize = px(20);//36
    // Hue mappa su X, Sat mappa su Y (Sat 254 = Alto, 0 = Basso? No, solitamente Y basso è bianco)
    // Hue API: 0-65535. Sat API: 0-254.
    //const posX = pickerX + (hue / 65535) * pickerSize;
    //const posY = pickerY + ((254 - sat) / 254) * pickerSize; // 254 (Vivido) in alto
    const cursorSize = px(28); 
    // Mappa Hue API (0-65535) su X (0-pickerSize)
    const posX = pickerX + Math.max(0, Math.min(pickerSize, (hue / HUE_RANGE) * pickerSize));

    // Mappa Sat API (0-254) su Y (0-pickerSize)
    // 0 SAT (bianco) -> Basso (pickerY + pickerSize)
    // 254 SAT (vivido) -> Alto (pickerY)
    const posY = pickerY + Math.max(0, Math.min(pickerSize, (SAT_RANGE - sat) / SAT_RANGE * pickerSize));

    // Il cursore mostra il colore ATTUALE della luce (H, S, B)
    const currentHex = hsb2hex(
      (hue / HUE_RANGE) * 360,
      (sat / SAT_RANGE) * 100,
      (bri / BRI_RANGE) * 100
    );

    const cursor = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: posX - cursorSize/2, y: posY - cursorSize/2,
        w: cursorSize, h: cursorSize,
        color:  currentHex,//0xffffff,
        radius: cursorSize/2,
        line_width: 4, line_color: 0x000000
    });
    pageContext.state.cursorWidget = cursor;

    // C. Hitbox
    const hitbox = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: pickerX, y: pickerY, w: pickerSize, h: pickerSize,
        color: 0, alpha: 0
    });

    hitbox.addEventListener(event.CLICK_DOWN, (info) => onDragColor('DOWN', info));
    hitbox.addEventListener(event.MOVE, (info) => onDragColor('MOVE', info));
    hitbox.addEventListener(event.CLICK_UP, (info) => onDragColor('UP', info));
}

function renderCTPicker(pageContext, state, callbacks) {
    const { pickerX, pickerY, pickerSize } = LAYOUT_CONFIG;
    // CT range: 153 (Freddo) - 500 (Caldo)
    const { ct } = state;
    const { onDragCT } = callbacks;

    // Per CT usiamo un gradiente verticale o orizzontale?
    // Usiamo verticale per coerenza con il layout quadrato,
    // In alto FREDDO (bianco), in basso CALDO (giallo).

    const stripCount = 20;
    const stripH = pickerSize / stripCount;

    for(let i=0; i<stripCount; i++) {
        // i=0 -> Freddo (153), i=max -> Caldo (500)
        const mired = 153 + (i / stripCount) * (500 - 153);
        pageContext.createTrackedWidget(widget.FILL_RECT, {
            x: pickerX, y: pickerY + (i * stripH),
            w: pickerSize,
            h: stripH + 1,
            color: ct2hex(mired),
            radius: 0//(i===0 || i===stripCount-1) ? 12 : 0
        });
    }

    // Cursore (Barra orizzontale o pallino?) Pallino
    const cursorSize = px(36);
    // Mappa CT su Y
    const validCt = Math.max(153, Math.min(500, ct));
    const normalizedY = (validCt - 153) / (500 - 153);
    const posY = pickerY + (normalizedY * pickerSize);
    const posX = pickerX + (pickerSize / 2); // Centrato orizzontalmente

    const cursor = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: posX - cursorSize/2, y: posY - cursorSize/2,
        w: cursorSize, h: cursorSize,
        color: 0xffffff, radius: cursorSize/2,
        line_width: 4, line_color: 0x000000
    });
    pageContext.state.ctCursorWidget = cursor;

    // Hitbox
    const hitbox = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: pickerX, y: pickerY, w: pickerSize, h: pickerSize,
        color: 0, alpha: 0
    });
    hitbox.addEventListener(event.CLICK_DOWN, (info) => onDragCT('DOWN', info));
    hitbox.addEventListener(event.MOVE, (info) => onDragCT('MOVE', info));
    hitbox.addEventListener(event.CLICK_UP, (info) => onDragCT('UP', info));
}


function renderBrightnessSlider(pageContext, state, callbacks) {
    const { sliderX, sliderY, sliderW, sliderH } = LAYOUT_CONFIG;
    const { bri } = state;
    const { onDragBri } = callbacks;

    // Label
    /*pageContext.createTrackedWidget(widget.TEXT, {
        x: sliderX, y: sliderY - px(30), w: sliderW, h: px(30),
        text: 'Brightness', color: 0xaaaaaa, align_h: align.CENTER_H
    })*/

    // Track
    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX, y: sliderY, w: sliderW, h: sliderH,
        radius: sliderH/2, color: COLORS.sliderBg
    });

    // Fill
    const fillW = Math.max(px(20), (bri / 254) * sliderW);
    const fill = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX, y: sliderY, w: fillW, h: sliderH,
        radius: sliderH/2, color: COLORS.sliderFill
    });
    pageContext.state.briFillWidget = fill;

    // Icona Sole (Opzionale, dentro lo slider a sx)
    // ...

    // Hitbox
    const hitbox = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX - 20, y: sliderY - 20, w: sliderW + 40, h: sliderH + 40, // Area touch estesa
        color: 0, alpha: 0
    });
    hitbox.addEventListener(event.CLICK_DOWN, (info) => onDragBri('DOWN', info));
    hitbox.addEventListener(event.MOVE, (info) => onDragBri('MOVE', info));
    hitbox.addEventListener(event.CLICK_UP, (info) => onDragBri('UP', info));
}