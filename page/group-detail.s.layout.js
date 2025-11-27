import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align } from '@zos/ui'
import { getText } from '@zos/i18n'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

// Funzione principale di rendering chiamata da group_detail.js
export function renderGroupDetailPage(pageContext, state, viewData, callbacks, COLORS) {
    const { toggleGroup, retry } = callbacks
    const { groupName, isLoading, error } = state

    // Background
    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT, color: COLORS.background
    })

    // Header: Nome del Gruppo
    pageContext.createTrackedWidget(widget.TEXT, {
        x: 0, y: 0, w: DEVICE_WIDTH, h: 50,
        text: groupName || getText('GROUP_DETAIL'),
        text_size: 34,
        color: COLORS.text,
        align_h: align.CENTER_H,
        align_v: align.TOP
    })

    // 1. Gestione Errore
    if (error) {
        pageContext.createTrackedWidget(widget.TEXT, {
            x: px(20), y: px(200), w: px(440), h: px(100),
            text: `ERROR: ${error}`, text_size: px(24), color: COLORS.error,
            align_h: align.CENTER_H, align_v: align.CENTER_V
        })
        pageContext.createTrackedWidget(widget.BUTTON, {
            x: px(140), y: px(350), w: px(200), h: px(60),
            text: 'RETRY', normal_color: COLORS.highlight, press_color: 0x333333,
            radius: px(10),
            click_func: retry
        })
        return
    }

    // 2. Loading State
    if (isLoading) {
        pageContext.createTrackedWidget(widget.TEXT, {
            x: 0, y: px(200), w: px(480), h: px(50),
            text: 'Loading...', text_size: px(28), color: COLORS.inactive,
            align_h: align.CENTER_H
        })
        return
    }

    // 3. Pulsante Toggle Globale
    const anyOn = state.lights.some(light => !!light.ison) 
    const buttonColor = anyOn ? COLORS.toggleOn : COLORS.toggleOff

    pageContext.createTrackedWidget(widget.BUTTON, {
        x: px(80), y: px(60), w: px(320), h: px(60),
        text: anyOn ? getText('GROUP_OFF') : getText('GROUP_ON'),
        text_size: px(28),
        normal_color: buttonColor,
        press_color: 0x333333,
        radius: px(30),
        click_func: toggleGroup
    })

    // 4. Contenuto Scrollabile (Scene e Luci)
    renderGroupContentScroll(pageContext, viewData, callbacks, COLORS)
}

// Funzione interna che disegna la scroll list
function renderGroupContentScroll(pageContext, viewData, callbacks, COLORS) {
    const { applyScene, toggleLight, navigateToLightDetail } = callbacks
    
    const { data, dataConfig } = viewData

    if (data.length === 0) {
        pageContext.createTrackedWidget(widget.TEXT, {
            x: 0, y: px(200), w: px(480), h: px(50),
            text: 'Nessuna luce o scena trovata.', text_size: px(24), color: COLORS.inactive,
            align_h: align.CENTER_H
        })
        return
    }

    const itemConfig = [
        // Type 1: Header (Titolo Sezione)
        {
            type_id: 1,
            item_bg_color: COLORS.background,
            item_bg_radius: px(0),
            item_height: px(50),
            text_view: [
                { x: px(20), y: px(10), w: px(440), h: px(40), key: 'name', color: COLORS.sectionHeader, text_size: px(26) },
            ],
            text_view_count: 1,
            image_view: [],
            image_view_count: 0
        },
        // Type 2: Scene (Pulsante di Scena)
        {
            type_id: 2,
            item_bg_color: COLORS.sceneBg,
            item_bg_radius: px(10),
            item_height: px(80),
            text_view: [
                { x: px(20), y: px(25), w: px(440), h: px(50), key: 'name', color: 0xFFFFFF, text_size: px(30) },
            ],
            text_view_count: 1,
            image_view: [],
            image_view_count: 0
        },
        // Type 3: Light item layout (CON CAMPIONE DI COLORE E ICONA)
        {
            type_id: 3,
            item_bg_color: COLORS.lightBg,
            item_bg_radius: px(10),
            item_height: px(90),
            text_view: [
                // RIGA 1: Campione di Colore (Swatch) - CHIAVE CRITICA: usa la stringa 'swatch_bg_color'
                {
                    x: px(20), y: px(20), w: px(16), h: px(16),
                    key: 'swatch_text', // Chiave per il valore fittizio (spazio) nel dato
                    item_bg_color: 'swatch_bg_color', // CRITICO: Usa la chiave del dato che contiene il colore
                    color: 0x00000000, 
                    text_size: 1, 
                    item_bg_radius: px(4)
                },
                // RIGA 2: Nome della luce
                { x: px(45), y: px(15), w: px(330), h: px(30), key: 'name', color: 0xFFFFFF, text_size: px(28), align_h: align.LEFT, action: true },
                // RIGA 3: Status
                { x: px(45), y: px(45), w: px(330), h: px(25), key: 'status_text', color: COLORS.inactive, text_size: px(20), align_h: align.LEFT },
            ],
            text_view_count: 3,

            // Icona/Bottone Toggle
            image_view: [
                { x: px(380), y: px(10), w: px(70), h: px(70), key: 'icon', auto_scale: true, action: true }
            ],
            image_view_count: 1
        },
    ]

    pageContext.createTrackedWidget(widget.SCROLL_LIST, {
        x: 0,
        y: px(140), 
        w: px(480),
        h: px(340), 
        item_space: px(10),

        item_config: itemConfig,
        item_config_count: itemConfig.length,

        // Dati e Configurazione
        data_type_config: dataConfig,
        data_type_config_count: dataConfig.length,
        data_array: data,
        data_count: data.length,

        item_click_func: (list, index, data_key) => {
            const item = data[index]
            if (!item) return;
            
            // Le azioni sono già state incapsulate in callbacks in group_detail.js
            if (item.type === 'scene') {
                applyScene(item)
            } else if (item.type === 'light') {
                if (data_key === 'icon') {
                    // Click sull'icona (toggle)
                    toggleLight(item.raw)
                } else {
                    // Click sul Nome/generico (Naviga al dettaglio)
                    navigateToLightDetail(item.raw)
                }
            }
        }
    })
}