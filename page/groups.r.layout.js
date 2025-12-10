import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style } from '@zos/ui'
import { getText } from '@zos/i18n'
import { COLORS, btnPressColor } from '../utils/constants.js'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

export const LAYOUT_CONFIG = {
  headerY: px(20),
  headerH: px(40)
}

export function renderGroupsPage(pageContext, state, listData, callbacks) {
    const { switchTab, refresh, handleListItemClick } = callbacks
    const { currentTab, isLoading, error } = state

    // 1. Sfondo
    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: 0,
        y: 0,
        w: DEVICE_WIDTH,
        h: DEVICE_HEIGHT,
        color: COLORS.background
    })

    // 2. Gestione Errore
    if (error) {
        pageContext.createTrackedWidget(widget.TEXT, {
            x: px(20),
            y: px(200),
            w: px(440),
            h: px(100),
            text: `ERROR: ${error}`,
            text_size: px(24),
            color: COLORS.error,
            align_h: align.CENTER_H,
            align_v: align.CENTER_V,
            text_style: text_style.WRAP
        })
        pageContext.createTrackedWidget(widget.BUTTON, {
            x: px(140),
            y: px(350),
            w: px(200),
            h: px(60),
            text: getText('RETRY'),
            normal_color: COLORS.highlight,
            press_color: 0x333333,
            radius: px(10),
            click_func: refresh
        })
        return
    }

    // 3. Header: Titolo
    pageContext.createTrackedWidget(widget.TEXT, {
        x: 0,
        y: LAYOUT_CONFIG.headerY,
        w: DEVICE_WIDTH,
        h: LAYOUT_CONFIG.headerH,
        text: getText('GROUPS'),
        text_size: px(36),
        color: COLORS.text,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V
    })

    // 4. Tabs
    const tabY = LAYOUT_CONFIG.headerY + LAYOUT_CONFIG.headerH + px(10)
    const tabH = px(40)
    const tabW = px(180)
    const gap = px(10)
    const totalW = (tabW * 2) + gap;
    const startX = (DEVICE_WIDTH - totalW) / 2;
    const isRooms = currentTab === 'ROOMS'

    // Tab Rooms
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: startX,
        y: tabY,
        w: tabW,
        h: tabH,
        text: getText('ROOMS'),
        color: isRooms ? COLORS.activeTabText : COLORS.inactiveTabText,
        normal_color: isRooms ? COLORS.activeTab : COLORS.inactiveTab,
        press_color: btnPressColor(COLORS.activeTab, 0.8),
        radius: 20,
        click_func: () => switchTab('ROOMS')
    })

    // Tab Zones
    const isZones = currentTab === 'ZONES'
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: startX + tabW + gap,
        y: tabY,
        w: tabW,
        h: tabH,
        text: getText('ZONES'),
        color: isZones ? COLORS.activeTabText : COLORS.inactiveTabText,
        normal_color: isZones ? COLORS.activeTab : COLORS.inactiveTab,
        press_color: btnPressColor(COLORS.activeTab, 0.8),
        radius: 20,
        click_func: () => switchTab('ZONES')
    })

    // 5. Lista con VIEW_CONTAINER
    const listStartY = px(120)
    const noun = currentTab === 'ROOMS' ? 'ROOM' : 'ZONE';

    if (isLoading || listData.length === 0) {
        pageContext.createTrackedWidget(widget.TEXT, {
            //x: 0, y: px(200), w: DEVICE_WIDTH, h: px(50),
            x: 0,
            y: DEVICE_HEIGHT / 2 - px(50),
            w: DEVICE_WIDTH,
            h: px(50),
            text: isLoading ? getText('LOADING') : getText(`NO_${noun}_FOUND`),
            text_size: px(28),
            color: COLORS.loading,
            align_h: align.CENTER_H,
            align_v: align.CENTER_V
        })
        return
    }

    renderGroupsList(pageContext, listData, listStartY, handleListItemClick)
}

// ✅ Rendering con VIEW_CONTAINER
function renderGroupsList(pageContext, listData, startY, onItemClick) {
    const itemHeight = px(100)
    const itemSpacing = px(10)

    // Calcola altezza totale contenuto
    const totalContentHeight = listData.length * (itemHeight + itemSpacing) + px(20)

    // Crea VIEW_CONTAINER scrollabile
    const containerHeight = DEVICE_HEIGHT - startY
    const viewContainer = pageContext.createTrackedWidget(widget.VIEW_CONTAINER, {
        x: 0,
        y: startY,
        w: DEVICE_WIDTH,
        h: containerHeight,
        scroll_enable: true,
        scroll_max_height: totalContentHeight
    })

    // Renderizza ogni gruppo
    let currentY = 0
    listData.forEach((item, index) => {
        currentY = renderGroupItem(viewContainer, item, index, currentY, itemHeight, onItemClick)
        currentY += itemSpacing
    })
}

// ✅ Render singolo gruppo
function renderGroupItem(container, group, index, yPos, itemHeight, onItemClick) {
    // Background card
    container.createWidget(widget.FILL_RECT, {
        x: px(20),
        y: yPos,
        w: px(440),
        h: itemHeight,
        color: COLORS.cardBg,
        radius: px(10)
    })

    // Icon/Indicator (colored circle per tipo gruppo)
    const iconColor = group.raw?.type === 'room' ? COLORS.roomIndicator : COLORS.zoneIndicator
    container.createWidget(widget.CIRCLE, {
        center_x: px(50),
        center_y: yPos + itemHeight / 2,
        radius: px(12),
        color: iconColor || COLORS.highlight
    })

    // Nome gruppo
    container.createWidget(widget.TEXT, {
        x: px(75),
        y: yPos + px(20),
        w: px(250),
        h: px(30),
        text: group.name,
        text_size: px(28),
        color: COLORS.text,
        align_h: align.LEFT,
        align_v: align.CENTER_V
    })

    // Status (numero luci)
    container.createWidget(widget.TEXT, {
        x: px(75),
        y: yPos + px(55),
        w: px(200),
        h: px(25),
        text: group.status,
        text_size: px(20),
        color: COLORS.textSubtitle,
        align_h: align.LEFT,
        align_v: align.CENTER_V
    })

    // Navigate overlay (left side - nome e status)
    const overlay1 = container.createWidget(widget.BUTTON, {
        x: px(20),
        y: yPos,
        w: px(310),
        h: itemHeight,
        text: '',
        normal_color: 0x00000000,
        press_color: 0x22ffffff,
        radius: px(10),
        click_func: () => onItemClick(index, 'navigate')
    })

    overlay1.setAlpha(0)

    // ON/OFF badge (right side)
    const isOn = group.on_off === 'ON'
    const badgeColor = isOn ? COLORS.success : COLORS.inactive

    container.createWidget(widget.BUTTON, {
        x: px(340), y: yPos + px(25), w: px(80), h: px(50),
        text: group.on_off,
        text_size: px(26),
        radius: px(8),
        normal_color: badgeColor,
        press_color: btnPressColor(badgeColor, 0.8),
        click_func: () => onItemClick(index, 'on_off')
    });

    return yPos + itemHeight
}