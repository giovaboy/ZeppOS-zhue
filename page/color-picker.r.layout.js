import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style, prop, event } from '@zos/ui'
import { getText } from '@zos/i18n'
import { COLORS, hsb2hex, ct2hex } from '../utils/constants.js'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

// Range API Hue/Sat/Bri
const HUE_RANGE = 65535;
const SAT_RANGE = 254;
const BRI_RANGE = 254;

// Configurazione Layout
export const LAYOUT_CONFIG = {
  pickerSize: px(300), // Area grande centrale
  pickerX: (DEVICE_WIDTH - px(300)) / 2,
  pickerY: px(70),     // Spazio per i tab sopra
  sliderW: px(300),
  sliderH: px(50),
  //sliderX: px(40),
  //sliderW: DEVICE_WIDTH - px(80),
  sliderX: (DEVICE_WIDTH - px(300)) / 2,
  sliderY: DEVICE_HEIGHT - px(90) // In basso
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
    const btnW = px(100);
    const btnH = px(40);
    const y = px(20);
    const gap = px(10);
    const totalW = (btnW * 2) + gap;
    const startX = (DEVICE_WIDTH - totalW) / 2;

    // Tab Color
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: startX, y: y, w: btnW, h: btnH,
        text: getText('COLOR'),
        radius: 20,
        normal_color: currentMode === 'color' ? COLORS.activeTab : COLORS.inactiveTab,
        press_color: COLORS.activeTab,
        click_func: () => onTabSwitch('color')
    });

    // Tab White
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: startX + btnW + gap, y: y, w: btnW, h: btnH,
        text: getText('WHITE'),
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

    pageContext.createTrackedWidget(widget.IMG, {
      x: pickerX,
      y: pickerY,
      w: pickerSize,
      h: pickerSize,
      auto_scale: true,
      src: 'color-picker.png'
    })

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
      90//(bri / BRI_RANGE) * 100
    );

    const cursor = pageContext.createTrackedWidget(widget.CIRCLE, {
        center_x: posX,
        center_y: posY,
        color:  currentHex,//0xffffff,
        radius: cursorSize/2
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
    const brightnessPercent = Math.round(bri / 254 * 100)
    
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
        y: sliderY + sliderH/2 - px(24/2),
        src: 'bri-low.png'//24*24
    })
    
    pageContext.createTrackedWidget(widget.IMG, {
        x: sliderX + sliderW - px(20 + 32),
        y: sliderY + sliderH/2 - px(32/2),
        src: 'bri-hi.png'//32*32
    })

    // Hitbox
    const hitbox = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX - 20, y: sliderY - 20, w: sliderW + 40, h: sliderH + 40, // Area touch estesa
        color: 0, alpha: 0
    });
    hitbox.addEventListener(event.CLICK_DOWN, (info) => onDragBri('DOWN', info));
    hitbox.addEventListener(event.MOVE, (info) => onDragBri('MOVE', info));
    hitbox.addEventListener(event.CLICK_UP, (info) => onDragBri('UP', info));
}