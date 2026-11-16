import { getDeviceInfo, SCREEN_SHAPE_SQUARE } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, event } from '@zos/ui'
import { getText } from '@zos/i18n'
import { BRI_RANGE, COLORS } from '../../utils/constants.js'
import { renderTabs as renderTabs2Up, TAB_Y, TAB_H } from '../../utils/tabs.js'
import { renderHsWheel, renderCtWheel, wheelBox } from './wheel.js'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()
// The slider's top from the screen's bottom: round screens keep it clear of
// the narrowing edge
const SLIDER_UP = getDeviceInfo().screenShape === SCREEN_SHAPE_SQUARE ? px(55) : px(90)

// The white temperature in kelvin, under the white wheel (the wheels are a
// little smaller for it, both alike: 244 px on a 480 px screen, were 270)
const KELVIN_H = px(30)

// Mireds → "2700 K", to the nearest 50 K
export function kelvinText(ct) {
    const k = ct > 0 ? Math.round(1000000 / ct / 50) * 50 : 0
    return k ? `${k} K` : ''
}

// Configurazione Layout
export const LAYOUT_CONFIG = {
    sliderW: px(300),
    sliderH: px(50),
    sliderX: (DEVICE_WIDTH - px(300)) / 2,
    sliderY: DEVICE_HEIGHT - SLIDER_UP,
    // The wheels (color, white), between the tabs and the kelvin line above
    // the slider's touch area
    wheel: wheelBox(TAB_Y + TAB_H + px(6), DEVICE_HEIGHT - SLIDER_UP - px(20) - KELVIN_H)
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
        bandH: TAB_Y + TAB_H + px(6)
    })
}

function renderHueSatPicker(pageContext, state, callbacks) {
    // A color wheel, the cursor in a white ring (page/layouts/wheel.js)
    renderHsWheel(pageContext, LAYOUT_CONFIG.wheel, state.hue, state.sat, callbacks.onDragColor)
}

function renderCTPicker(pageContext, state, callbacks) {
    // A wheel, warm at the top, cold at the bottom (page/layouts/wheel.js)
    renderCtWheel(pageContext, LAYOUT_CONFIG.wheel, state.ct, callbacks.onDragCT)
    // Its temperature, under it (updated while dragged: page's updateCTUI)
    const box = LAYOUT_CONFIG.wheel
    const label = pageContext.createTrackedWidget(widget.TEXT, {
        x: 0, y: box.bottom, w: DEVICE_WIDTH, h: KELVIN_H,
        text: kelvinText(state.ct),
        text_size: px(22),
        color: COLORS.textSubtitle,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
    })
    try { label.setEnable(false) } catch (e) {}
    pageContext.state.kelvinLabel = label
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