import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align } from '@zos/ui'
import { getText } from '@zos/i18n'
import { COLORS } from '../utils/constants.js'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

export function renderGroupsPage(pageContext, state, listData, callbacks) {
    const { switchTab, refresh, handleListItemClick } = callbacks
    const { currentTab, error } = state

    // 1. Sfondo
    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT,
        color: COLORS.background
    })

    // 2. Gestione Errore
    if (error) {
        pageContext.createTrackedWidget(widget.TEXT, {
            x: 20, y: 200, w: 440, h: 100,
            text: `ERROR: ${error}`, text_size: 24, color: COLORS.error,
            align_h: align.CENTER_H, align_v: align.CENTER_V
        })
        pageContext.createTrackedWidget(widget.BUTTON, {
            x: 140, y: 350, w: 200, h: 60,
            text: 'RETRY', normal_color: COLORS.highlight, press_color: 0x333333,
            radius: 10,
            click_func: refresh
        })
        return;
    }

    // 3. UI Standard
    // Titolo
    pageContext.createTrackedWidget(widget.TEXT, {
        x: 0, y: 0, w: 480, h: 50,
        text: getText('GROUPS'), text_size: 36,
        color: COLORS.text, align_h: align.CENTER_H, align_v: align.TOP
    })

    // Tabs
    const tabY = 60
    const tabH = 50
    const tabW = 200
    const isRooms = currentTab === 'ROOMS'

    // Tab Rooms
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: 30, y: tabY, w: tabW, h: tabH,
        text: getText('ROOMS'),
        color: isRooms ? COLORS.activeTabText : COLORS.inactiveTabText,
        normal_color: isRooms ? COLORS.activeTab : COLORS.inactiveTab,
        press_color: COLORS.highlight,
        radius: 10,
        click_func: () => switchTab('ROOMS')
    })

    // Tab Zones
    const isZones = currentTab === 'ZONES'
    pageContext.createTrackedWidget(widget.BUTTON, {
        x: 250, y: tabY, w: tabW, h: tabH,
        text: getText('ZONES'),
        color: isZones ? COLORS.activeTabText : COLORS.inactiveTabText,
        normal_color: isZones ? COLORS.activeTab : COLORS.inactiveTab,
        press_color: COLORS.highlight,
        radius: 10,
        click_func: () => switchTab('ZONES')
    })

    // 4. Lista (o messaggio vuoto)
    if (listData.length === 0) {
        pageContext.createTrackedWidget(widget.TEXT, {
            x: 0, y: 200, w: DEVICE_WIDTH, h: 50,
            text: `Nessuna ${currentTab === 'ROOMS' ? 'stanza' : 'zona'} trovata`,
            text_size: 24, color: COLORS.inactive,
            align_h: align.CENTER_H
        })
        return
    }

    // Configurazione SCROLL_LIST
    const dataConfig = [{ start: 0, end: listData.length - 1, type_id: 1 }]

    pageContext.createTrackedWidget(widget.SCROLL_LIST, {
        x: 0,
        y: 120,
        w: DEVICE_WIDTH,
        h: DEVICE_HEIGHT - 120,
        item_space: 10,
        item_config: [{
            type_id: 1,
            item_bg_color: COLORS.cardBg,
            item_bg_radius: 10,
            text_view: [
                { x: px(45), y: px(20), w: px(280), h: px(30), key: 'name', color: COLORS.text, text_size: px(28), align_h: align.LEFT, action: true },
                { x: px(45), y: px(55), w: px(200), h: px(25), key: 'status', color: 0xAAAAAA, text_size: px(20), align_h: align.LEFT },
                { x: px(340), y: px(30), w: px(100), h: px(40), key: 'on_off', color: COLORS.text, text_size: px(28), action: true }
            ],
            text_view_count: 3,
            item_height: px(100)
        }],
        item_config_count: 1,
        data_type_config: dataConfig,
        data_type_config_count: dataConfig.length,
        data_array: listData,
        data_count: listData.length,

        item_click_func: (list, index, data_key) => {
            handleListItemClick(index, data_key)
        }
    })
}