import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style, event } from '@zos/ui'
import { getText } from '@zos/i18n'
import { getLogger } from '../utils/logger.js'
import { COLORS, btnPressColor, getGroupIconPath } from '../utils/constants.js'

const logger = getLogger('zhue-group-detail-page')

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

export const LAYOUT_CONFIG = {
    tabY: px(20),
    tabH: px(60),
    gapY: px(10),
    tabW: px(180),
    tabXGap: px(5)
}

export function renderGroupsPage(pageContext, state, listData, callbacks) {
    const { switchTab, refresh } = callbacks
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
            press_color: btnPressColor(COLORS.highlight, 0.8),
            radius: px(10),
            click_func: refresh
        })
        return
    }

    // 3. Tabs
    const totalW = (LAYOUT_CONFIG.tabW * 2) + LAYOUT_CONFIG.tabXGap;
    const startX = (DEVICE_WIDTH - totalW) / 2;
    const isRooms = currentTab === 'ROOMS'

    // Tab Rooms
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: startX,
        y: LAYOUT_CONFIG.tabY,
        w: LAYOUT_CONFIG.tabW,
        h: LAYOUT_CONFIG.tabH,
        text: getText('ROOMS'),
        text_size: px(26),
        color: isRooms ? COLORS.activeTabText : COLORS.inactiveTabText,
        normal_color: isRooms ? COLORS.activeTab : COLORS.inactiveTab,
        press_color: btnPressColor(COLORS.activeTab, 0.8),
        radius: LAYOUT_CONFIG.tabH / 2,
        click_func: () => switchTab('ROOMS')
    })

    // Tab Zones
    const isZones = currentTab === 'ZONES'
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: startX + LAYOUT_CONFIG.tabW + LAYOUT_CONFIG.tabXGap,
        y: LAYOUT_CONFIG.tabY,
        w: LAYOUT_CONFIG.tabW,
        h: LAYOUT_CONFIG.tabH,
        text: getText('ZONES'),
        text_size: px(26),
        color: isZones ? COLORS.activeTabText : COLORS.inactiveTabText,
        normal_color: isZones ? COLORS.activeTab : COLORS.inactiveTab,
        press_color: btnPressColor(COLORS.activeTab, 0.8),
        radius: LAYOUT_CONFIG.tabH / 2,
        click_func: () => switchTab('ZONES')
    })

    // 4. Lista con VIEW_CONTAINER
    const listStartY = LAYOUT_CONFIG.tabY + LAYOUT_CONFIG.tabH + LAYOUT_CONFIG.gapY
    const noun = currentTab === 'ROOMS' ? 'ROOM' : 'ZONE';

    if (isLoading || listData.length === 0) {
        pageContext.createTrackedWidget(widget.TEXT, {
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

    renderGroupsList(pageContext, state, listData, listStartY, callbacks)
}

// ✅ Rendering con VIEW_CONTAINER
function renderGroupsList(pageContext, state, listData, startY, callbacks) {
    const { handleListItemClick, onScrollChange } = callbacks
    const { scrollPos_y } = state
    const itemHeight = px(100)
    const itemSpacing = px(10)

    // Crea VIEW_CONTAINER scrollabile
    const containerHeight = DEVICE_HEIGHT - startY
    const viewContainer = pageContext.createTrackedWidget(widget.VIEW_CONTAINER, {
        x: 0,
        y: startY,
        w: DEVICE_WIDTH,
        h: containerHeight,
        scroll_enable: true,
        pos_y: scrollPos_y || 0,
        scroll_frame_func: (FrameParams) => {
            if (FrameParams.yoffset !== undefined) {
                //logger.debug('VIEW_CONTAINER scroll_y:', FrameParams.yoffset)
                onScrollChange(FrameParams.yoffset)
            }
        }
    })

    // Renderizza ogni gruppo
    let currentY = 0
    listData.forEach((item, index) => {
        currentY = renderGroupItem(viewContainer, item, index, currentY, itemHeight, handleListItemClick)
        currentY += itemSpacing
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

// ✅ Render singolo gruppo
function renderGroupItem(container, group, index, yPos, itemHeight, onItemClick) {
    const isOn = group.on_off === 'ON'
    const startX = px(30)
    const itemSpacing = px(15)
    const iconSize = px(70)

    // Background card
    container.createWidget(widget.FILL_RECT, {
        x: startX,
        y: yPos,
        w:  DEVICE_WIDTH - startX * 2,
        h: itemHeight,
        color: COLORS.color_sys_item_bg,
        radius: px(10)
    })

     container.createWidget(widget.FILL_RECT, {
            x: startX + itemSpacing,
            y: yPos + ((itemHeight - iconSize) / 2),
            w: iconSize,
            h:  iconSize,
            color: isOn ? COLORS.white : COLORS.inactive
        })

    const iconClass = group.raw?.class || 'Other'
    container.createWidget(widget.IMG, {
            x: startX + itemSpacing,
            y: yPos + ((itemHeight - iconSize) / 2),
            w:  iconSize,
            h:  iconSize,
            src:  getGroupIconPath(iconClass),
            auto_scale: true
        })


    // Nome gruppo
    container.createWidget(widget.TEXT, {
        x: startX + itemSpacing + iconSize + itemSpacing,
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
        x: startX + itemSpacing + iconSize + itemSpacing,
        y: yPos + px(55),
        w: px(200),
        h: px(25),
        text: group.status,
        text_size: px(20),
        color: COLORS.textSubtitle,
        align_h: align.LEFT,
        align_v: align.CENTER_V
    })

    container.addEventListener(event.CLICK_DOWN, function (info) {
        onItemClick(index, 'navigate')
    })

    // Navigate overlay (left side - nome e status)
    let overlay1 = container.createWidget(widget.BUTTON, {
        x: px(20),
        y: yPos,
        w: px(310),
        h: itemHeight,
        text: '',
        normal_color: 0x000000,
        press_color: 0xffffff,
        radius: px(10),
        click_func: () => onItemClick(index, 'navigate')
    })

    overlay1.setAlpha(0)

    // ON/OFF badge (right side)
    const badgeColor = isOn ? COLORS.success : COLORS.inactive

    container.createWidget(widget.BUTTON, {
        x: px(340),
        y: yPos + px(25),
        w: px(80),
        h: px(50),
        text: group.on_off,
        text_size: px(26),
        radius: px(8),
        normal_color: badgeColor,
        press_color: btnPressColor(badgeColor, 0.8),
        click_func: () => onItemClick(index, 'on_off')
    });

    return yPos + itemHeight
}