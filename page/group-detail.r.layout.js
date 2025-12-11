import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style } from '@zos/ui'
import { getText } from '@zos/i18n'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

export const LAYOUT_CONFIG = {
    headerY: px(20),
    headerH: px(40)
}

// Funzione principale di rendering chiamata da group_detail.js
export function renderGroupDetailPage(pageContext, state, viewData, callbacks, COLORS) {
    const { toggleGroup, retry } = callbacks
    const { groupName, isLoading, error, userSettings } = state

    // Background
    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT, color: COLORS.background
    })

    // Header: Nome del Gruppo
    pageContext.createTrackedWidget(widget.TEXT, {
        x: 0, y: LAYOUT_CONFIG.headerY, w: DEVICE_WIDTH, h: LAYOUT_CONFIG.headerH,
        text: groupName || getText('GROUP_DETAIL'),
        text_size: px(34),
        color: COLORS.text,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
    })

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

    // 3. Pulsante Toggle Globale (condizionale su userSettings)
    let currentY = px(60)

    if (userSettings.show_global_toggle && state.lights.length > 1) {
        const anyOn = state.lights.some(light => !!light.ison)
        const buttonColor = anyOn ? COLORS.toggleOn : COLORS.toggleOff

        pageContext.createTrackedWidget(widget.BUTTON, {
            x: px(80), y: currentY, w: px(320), h: px(60),
            text: anyOn ? getText('GROUP_OFF') : getText('GROUP_ON'),
            text_size: px(28),
            normal_color: buttonColor,
            press_color: 0x333333,
            radius: px(30),
            click_func: toggleGroup
        })

        currentY += px(75) // Spazio dopo toggle
    }

    // 4. Contenuto Scrollabile con VIEW_CONTAINER
    renderGroupContentWithViewContainer(pageContext, viewData, callbacks, COLORS, currentY)
}

// ✅ NUOVO: Rendering con VIEW_CONTAINER
function renderGroupContentWithViewContainer(pageContext, viewData, callbacks, COLORS, startY) {
    const { applyScene, toggleLight, navigateToLightDetail } = callbacks
    const { data } = viewData

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

    // Calcola l'altezza totale del contenuto
    let totalContentHeight = 0
    data.forEach(item => {
        if (item.type === 'header') {
            totalContentHeight += px(50)
        } else if (item.type === 'scene') {
            totalContentHeight += px(80) + px(10) // item + spacing
        } else if (item.type === 'light') {
            totalContentHeight += px(90) + px(10) // item + spacing
        }
    })

    // ✅ VIEW_CONTAINER per scrolling
    const containerHeight = DEVICE_HEIGHT - startY
    const viewContainer = pageContext.createTrackedWidget(widget.VIEW_CONTAINER, {
        x: 0,
        y: startY,
        w: DEVICE_WIDTH,
        h: containerHeight,
        scroll_enable: true,
        scroll_max_height: totalContentHeight + px(20) // Padding bottom
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
    const itemHeight = px(80)

    // Background
    container.createWidget(widget.FILL_RECT, {
        x: px(20),
        y: yPos,
        w: px(440),
        h: itemHeight,
        color: COLORS.sceneBg,
        radius: px(10)
    })

    // Scene icon (optional colored circle)
    if (scene.color) {
        try {
            const colorHex = scene.color.replace('#', '')
            const colorInt = parseInt(colorHex, 16)

            container.createWidget(widget.CIRCLE, {
                center_x: px(50),
                center_y: yPos + itemHeight / 2,
                radius: px(15),
                color: colorInt
            })
        } catch (e) {
            // Fallback to default icon
        }
    }

    // Scene name
    container.createWidget(widget.TEXT, {
        x: px(80),
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
        x: px(20),
        y: yPos,
        w: px(440),
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
    const itemHeight = px(90)
    const isOn = !!light.raw?.ison

    // Background
    container.createWidget(widget.FILL_RECT, {
        x: px(20),
        y: yPos,
        w: px(440),
        h: itemHeight,
        color: COLORS.color_sys_item_bg,
        radius: px(10)
    })

    // Light name
    container.createWidget(widget.TEXT, {
        x: px(45),
        y: yPos + px(15),
        w: px(305),
        h: px(30),
        text: light.name,
        text_size: px(28),
        color: isOn ? COLORS.color_text_title : COLORS.inactive,
        align_h: align.LEFT,
        align_v: align.CENTER_V
    })

    // Status text
    container.createWidget(widget.TEXT, {
        x: px(45),
        y: yPos + px(45),
        w: px(305),
        h: px(25),
        text: light.status_text,
        text_size: px(20),
        color: COLORS.color_text_subtitle,
        align_h: align.LEFT,
        align_v: align.CENTER_V
    })

    // Light icon/toggle button (right side)
    if (light.icon) {
        // light background
        container.createWidget(widget.FILL_RECT, {
            x: px(380),
            y: yPos + px(10),
            w: px(70),
            h: px(70),
            color: light.swatch_bg_color || COLORS.inactive
        })
        // light mask
        container.createWidget(widget.IMG, {
            x: px(380),
            y: yPos + px(10),
            w: px(70),
            h: px(70),
            src: light.icon,
            auto_scale: true
        })

        // Clickable overlay for toggle
        const overlay = container.createWidget(widget.BUTTON, {
            x: px(380),
            y: yPos + px(10),
            w: px(70),
            h: px(70),
            text: '',
            normal_color: 0x00000000,
            press_color: 0x33ffffff,
            radius: px(10),
            click_func: onToggle
        })

        overlay.setAlpha(0)
    }

    // Clickable overlay for navigation (left area)
    const overlay = container.createWidget(widget.BUTTON, {
        x: px(20),
        y: yPos,
        w: px(350),
        h: itemHeight,
        text: '',
        normal_color: 0x00000000,
        press_color: 0x22ffffff,
        radius: px(10),
        click_func: onNavigate
    })

    overlay.setAlpha(0)

    return yPos + itemHeight + px(10) // item + spacing
}