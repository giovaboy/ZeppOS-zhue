import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style } from '@zos/ui'
import { getText } from '@zos/i18n'
import { btnPressColor } from '../utils/constants.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger('zhue-group-detail-page')

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

export const LAYOUT_CONFIG = {
    headerY: px(20),
    headerH: px(60)
}

// Funzione principale di rendering chiamata da group_detail.js
export function renderGroupDetailPage(pageContext, state, viewData, callbacks, COLORS) {
    const { toggleGroup, retry } = callbacks
    const { groupName, isLoading, error } = state
    const userSettings = getApp().globalData.settings
    // Background
    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT, color: COLORS.background
    })

    // Header: Nome del Gruppo togglable
    const anyOn = state.lights.some(light => !!light.ison)
    const badgeColor =  anyOn ? COLORS.success : COLORS.inactive
    pageContext.createTrackedWidget(widget.BUTTON, {
            x: px(10),
            y: LAYOUT_CONFIG.headerY, w: DEVICE_WIDTH - px(20), h: LAYOUT_CONFIG.headerH,
            text:groupName || getText('GROUP_DETAIL'),
            text_size: px(34),
            radius: px(8),
            normal_color: badgeColor,
            press_color: btnPressColor(badgeColor, 0.8),
            click_func: toggleGroup
        });

    // 1. Gestione Errore
    if (error) {
        pageContext.createTrackedWidget(widget.TEXT, {
            x: px(20), y: px(200), w: px(440), h: px(100),
            text: `ERROR: ${error}`,
            text_size: px(24),
            color: COLORS.error,
            align_h: align.CENTER_H,
            align_v: align.CENTER_V,
            text_style: text_style.WRAP
        })
        pageContext.createTrackedWidget(widget.BUTTON, {
            x: px(140), y: px(350), w: px(200), h: px(60),
            text: getText('RETRY'),
            normal_color: COLORS.highlight,
            press_color: 0x333333,
            radius: px(10),
            click_func: retry
        })
        return
    }

    // 2. Loading State
    if (isLoading) {
        pageContext.createTrackedWidget(widget.TEXT, {
            //x: 0, y: px(200), w: DEVICE_WIDTH, h: px(50),
            x: 0, y: DEVICE_HEIGHT / 2 - px(50), w: DEVICE_WIDTH, h: px(50),
            text: getText('LOADING'),
            text_size: px(28),
            color: COLORS.loading,
            align_h: align.CENTER_H,
            align_v: align.CENTER_V
        })
        return
    }

    let currentY = LAYOUT_CONFIG.headerY + LAYOUT_CONFIG.headerH + px(10)

    // 3. Contenuto Scrollabile con VIEW_CONTAINER
    renderGroupContentWithViewContainer(pageContext, state, viewData, callbacks, COLORS, currentY)
}

// ✅ NUOVO: Rendering con VIEW_CONTAINER
function renderGroupContentWithViewContainer(pageContext, state, viewData, callbacks, COLORS, startY) {
    const { applyScene, toggleLight, navigateToLightDetail, onScrollChange } = callbacks
    const { data } = viewData
    const { scrollPos_y } = state

    if (data.length === 0) {
        pageContext.createTrackedWidget(widget.TEXT, {
            x: 0, y: px(200), w: DEVICE_WIDTH, h: px(50),
            text: getText('NO_LIGHTS_OR_SCENES'),
            text_size: px(24),
            color: COLORS.inactive,
            align_h: align.CENTER_H,
            align_v: align.CENTER_V
        })
        return
    }

    // ✅ VIEW_CONTAINER per scrolling
    const containerHeight = DEVICE_HEIGHT - startY
    const viewContainer = pageContext.createTrackedWidget(widget.VIEW_CONTAINER, {
        x: 0,
        y: startY,
        w: DEVICE_WIDTH,
        h: containerHeight,
        scroll_enable: true,
        pos_y: scrollPos_y || 0, // <-- APPLICA IL VALORE SALVATO, altrimenti 0
        // 🔥 NUOVO: Aggiungi il listener per catturare la posizione
        scroll_frame_func: (FrameParams) => {
            if (FrameParams.yoffset !== undefined) {
                //logger.debug('VIEW_CONTAINER scroll_y:', FrameParams.yoffset)
                onScrollChange(FrameParams.yoffset)
            }
        }
    })

    let currentY = 0

    // Renderizza ogni item nel VIEW_CONTAINER
    data.forEach((item, index) => {
        if (item.type === 'header') {
            currentY = renderHeader(viewContainer, item, currentY, COLORS)
        } else if (item.type === 'scene') {
            currentY = renderSceneItem(viewContainer, item, currentY, COLORS, () => applyScene(item))
        } else if (item.type === 'light') {
            currentY = renderLightItem(
                viewContainer,
                item,
                currentY,
                COLORS,
                () => toggleLight(item.raw),
                () => navigateToLightDetail(item.raw)
            )
        }
    })
    // ✅ Fix Padding Bottom
    viewContainer.createWidget(widget.FILL_RECT, {
        x: 0,
        y: currentY,
        w: DEVICE_WIDTH,
        h: px(20),
        color: COLORS.background,
        alpha: 0
    })
}

// ✅ Render Header Section
function renderHeader(container, item, yPos, COLORS) {
    container.createWidget(widget.TEXT, {
        x: px(20),
        y: yPos,
        w: px(440),
        h: px(50),
        text: item.name,
        text_size: px(26),
        color: COLORS.sectionHeader,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
    })

    return yPos + px(50)
}

// ✅ Render Scene Item
function renderSceneItem(container, scene, yPos, COLORS, onTap) {
    const startX = px(30)
    const itemHeight = px(80)

    // Background
    container.createWidget(widget.FILL_RECT, {
        x: startX,
        y: yPos,
        w: DEVICE_WIDTH - startX * 2,
        h: itemHeight,
        color: COLORS.sceneBg,
        radius: px(10)
    })

    // Scene icon (optional colored circle)
    const circleRadius = px(15)
    if (scene.color) {
        try {
            const colorHex = scene.color.replace('#', '')
            const colorInt = parseInt(colorHex, 16)

            container.createWidget(widget.CIRCLE, {
                center_x: startX + circleRadius + px(15),
                center_y: yPos + itemHeight / 2,
                radius: circleRadius,
                color: colorInt
            })
        } catch (e) {
            // Fallback to default icon
        }
    }

    // Scene name
    container.createWidget(widget.TEXT, {
        x: startX + px(15) + circleRadius * 2 + px(15),
        y: yPos,
        w: px(360),
        h: itemHeight,
        text: scene.name,
        text_size: px(30),
        color: 0xFFFFFF,
        align_h: align.LEFT,
        align_v: align.CENTER_V
    })

    // Clickable overlay
    const overlay = container.createWidget(widget.BUTTON, {
        x: startX,
        y: yPos,
        w: DEVICE_WIDTH - startX * 2,
        h: itemHeight,
        text: '',
        normal_color: 0x00000000,
        press_color: 0x44ffffff,
        radius: px(10),
        click_func: onTap
    })

    overlay.setAlpha(0)

    return yPos + itemHeight + px(10) // item + spacing
}

// ✅ Render Light Item
function renderLightItem(container, light, yPos, COLORS, onToggle, onNavigate) {
    const startX = px(30)
    const itemHeight = px(100)
    const isOn = !!light.raw?.ison
    const reachable = light.raw?.reachable !== false

    // Background
    container.createWidget(widget.FILL_RECT, {
        x: startX,
        y: yPos,
        w: DEVICE_WIDTH - startX * 2,
        h: itemHeight,
        color: COLORS.color_sys_item_bg,
        radius: px(10)
    })

    // Light name
    container.createWidget(widget.TEXT, {
        x: startX + px(15),
        y: yPos + px(20),
        w: px(305),
        h: px(30),
        text: light.name,
        text_size: px(28),
        color: isOn && reachable ? COLORS.color_text_title : COLORS.inactive,
        align_h: align.LEFT,
        align_v: align.CENTER_V
    })

    // Status text
    container.createWidget(widget.TEXT, {
        x: startX + px(15),
        y: yPos + px(55),
        w: px(305),
        h: px(25),
        text: light.status_text,
        text_size: px(20),
        color: COLORS.color_text_subtitle,
        align_h: align.LEFT,
        align_v: align.CENTER_V
    })
    let iconSize = 0
    // Light icon/toggle button (right side)
    if (light.icon) {
        // light background
        iconSize = px(70)
        const iconX = DEVICE_WIDTH - startX - iconSize - px(15)
        container.createWidget(widget.FILL_RECT, {
            x: iconX,
            y: yPos + px(15),
            w: iconSize,
            h: iconSize,
            color: light.swatch_bg_color || COLORS.inactive
        })
        // light mask
        container.createWidget(widget.IMG, {
            x: iconX,
            y: yPos + px(15),
            w: iconSize,
            h: iconSize,
            src: light.icon,
            auto_scale: true
        })

        // Clickable overlay for toggle
        const toggleOverlay = container.createWidget(widget.BUTTON, {
            x: iconX - px(5),
            y: yPos,
            w: iconSize + px(10),
            h: itemHeight,
            text: '',
            normal_color: COLORS.black,
            press_color: COLORS.white,
            //radius: px(10),
            click_func: reachable ? onToggle : null
        })

        toggleOverlay.setAlpha(0)
    }

    // Clickable overlay for navigation (left area)
    const navigationOverlay = container.createWidget(widget.BUTTON, {
        x: startX,
        y: yPos,
        w: DEVICE_WIDTH - (startX * 2) - iconSize - px(20),
        h: itemHeight,
        text: '',
        normal_color: COLORS.black,
        press_color: COLORS.white,
        //radius: px(10),
        click_func: reachable ? onNavigate : null
    })

    navigationOverlay.setAlpha(0)

    return yPos + itemHeight + px(10) // item + spacing
}