import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, event } from '@zos/ui'
import { getText } from '@zos/i18n'
import { HUE_RANGE, SAT_RANGE, BRI_RANGE, CT_MIN, CT_MAX, COLORS, hsb2hex, btnPressColor } from '../utils/constants.js'
import { renderTabs as renderTabs2Up, TAB_Y, TAB_H } from '../utils/tabs.js'
import { renderCTBar, ctBarBox } from './layouts/ct-bar.js'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

// Configurazione Layout
export const LAYOUT_CONFIG = {
    // Under the tabs (utils/tabs.js: y 20, 60 high), 10 below them
    pickerSize: px(280), // Area grande centrale
    pickerX: (DEVICE_WIDTH - px(280)) / 2,
    pickerY: TAB_Y + TAB_H + px(10),
    sliderW: px(300),
    sliderH: px(50),
    sliderX: (DEVICE_WIDTH - px(300)) / 2,
    sliderY: DEVICE_HEIGHT - px(90), // In basso
    // The color temperature bar, between the tabs and the slider
    ctBar: ctBarBox(TAB_Y + TAB_H, DEVICE_HEIGHT - px(90))
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
    // utils/tabs.js: twins of Rooms / Zones
    renderTabs2Up(pageContext, {
        tabs: [['color', getText('COLOR')], ['ct', getText('WHITE')]],
        current: currentMode,
        onSwitch: onTabSwitch,
        bandH: LAYOUT_CONFIG.pickerY - px(4)
    })
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
        src: 'color-picker-grid.png'
    })

    // B. Cursore
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
        color: currentHex,//0xffffff,
        radius: cursorSize / 2
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
    // A horizontal pill, the knob inside it (page/layouts/ct-bar.js)
    renderCTBar(pageContext, LAYOUT_CONFIG.ctBar, state.ct, callbacks.onDragCT)
}


function renderBrightnessSlider(pageContext, state, callbacks) {
    const { sliderX, sliderY, sliderW, sliderH } = LAYOUT_CONFIG;
    const { bri } = state;
    const { onDragBri } = callbacks;
    const brightnessPercent = Math.round(bri / BRI_RANGE * 100)

    // Track
    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX, y: sliderY, w: sliderW, h: sliderH,
        radius: sliderH / 2, color: COLORS.sliderBg
    });

    // Fill
    const fillW = Math.max(px(10), (bri / BRI_RANGE) * sliderW);
    const fill = pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: sliderX, y: sliderY, w: fillW, h: sliderH,
        radius: sliderH / 2, color: COLORS.sliderFill
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

    hitbox.addEventListener(event.CLICK_DOWN, (info) => onDragBri('DOWN', info));
    hitbox.addEventListener(event.MOVE, (info) => onDragBri('MOVE', info));
    hitbox.addEventListener(event.CLICK_UP, (info) => onDragBri('UP', info));
}