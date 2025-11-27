import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style, anim_status, setStatusBarVisible } from '@zos/ui'
import { getText } from '@zos/i18n'
import { COLORS } from '../utils/constants.js'

// Costanti Globali del Dispositivo (Round)
export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()
export const TEXT_SIZE = px(30); // DEVICE_WIDTH / 16;

const STATES = {
    LOADING: 'LOADING',
    SEARCHING_BRIDGE: 'SEARCHING_BRIDGE',
    WAITING_FOR_PRESS: 'WAITING_FOR_PRESS',
    FETCHING_DATA: 'FETCHING_DATA',
    ERROR: 'ERROR',
    SUCCESS: 'SUCCESS'
}

setStatusBarVisible(false)

export function renderMainWidgets(pageContext, state, callbacks = {}) {
    const { animateSpinner, animateProgressBar, retryFunc } = callbacks
    const { currentState, error, progress } = state

    // Sfondo universale
    pageContext.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT,
        color: COLORS.background
    })

    switch (currentState) {
        case STATES.LOADING:
            // --- GESTIONE STATO LOADING ---
            // 1. Testo
            pageContext.createTrackedWidget(widget.TEXT, {
                x: 0,
                y: (DEVICE_HEIGHT / 2) + 60,
                w: DEVICE_WIDTH, h: 40,
                text_size: 28,
                color: COLORS.text,
                align_h: align.CENTER_H,
                align_v: align.CENTER_V,
                text_style: text_style.WRAP,
                text: getText('loading')
            });

            // 2. Animazione (IMG_ANIM è nativa, parte da sola con anim_status.START)
            pageContext.createTrackedWidget(widget.IMG_ANIM, {
                anim_path: 'anim',
                anim_prefix: 'loading',
                anim_ext: 'png',
                anim_fps: 24,
                anim_size: 54,
                repeat_count: 0, // Infinito
                anim_status: anim_status.START, // Parte subito
                x: (DEVICE_WIDTH / 2) - 54,
                y: (DEVICE_HEIGHT / 2) - 100
            });
            break;

        case STATES.SEARCHING_BRIDGE: {
            // Titolo
            pageContext.createTrackedWidget(widget.TEXT, {
                x: 0, y: px(40), w: DEVICE_WIDTH, h: px(60),
                text: 'Hue Bridge', text_size: px(40),
                color: COLORS.text, align_h: align.CENTER_H, align_v: align.CENTER_V
            })
            // Animazione/Icona placeholder
            const spinner = pageContext.createTrackedWidget(widget.CIRCLE, {
                center_x: DEVICE_WIDTH / 2, center_y: px(180), radius: 40,
                color: COLORS.highlight, alpha: 150
            })
            if (animateSpinner) animateSpinner(spinner) // Chiamata al metodo di index.js

            // Testo principale
            pageContext.createTrackedWidget(widget.TEXT, {
                x: px(40), y: px(260), w: DEVICE_WIDTH - px(80), h: px(80),
                text: getText('SEARCHING_BRIDGE'), text_size: px(26),
                color: COLORS.text, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.WRAP
            })
            // Testo informativo
            pageContext.createTrackedWidget(widget.TEXT, {
                x: 0, y: px(360), w: DEVICE_WIDTH, h: px(40),
                text: 'Make sure your bridge is powered on', text_size: px(20),
                color: COLORS.inactive, align_h: align.CENTER_H, align_v: align.CENTER_V
            })
            // Barra di progresso
            const progressBar = pageContext.createTrackedWidget(widget.FILL_RECT, {
                x: px(140), y: px(420), w: px(10), h: px(6), color: COLORS.highlight, radius: px(3)
            })
            if (animateProgressBar) animateProgressBar(progressBar)
            break
        }

        case STATES.WAITING_FOR_PRESS:{
            // Sfondo diventa warning
            pageContext.createTrackedWidget(widget.FILL_RECT, {
                x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT, color: COLORS.warning
            })
            pageContext.createTrackedWidget(widget.TEXT, {
                x: 0, y: px(50), w: DEVICE_WIDTH, h: px(50),
                text: 'Bridge Found!', text_size: px(38),
                color: COLORS.warningText, align_h: align.CENTER_H, align_v: align.CENTER_V
            })
            // Icona bridge
            pageContext.createTrackedWidget(widget.IMG, {
                x: DEVICE_WIDTH/2 - px(50), y: DEVICE_HEIGHT/2 - px(100),
                //center_x: DEVICE_WIDTH / 2, center_y: px(180),
                src: 'icons/push-linkv2.png'//100*96
            })

            pageContext.createTrackedWidget(widget.TEXT, {
                x: px(40), y: px(270), w: DEVICE_WIDTH - px(80), h: px(100),
                text: getText('PRESS_BUTTON_TO_PAIR'),
                text_size: px(28), color: COLORS.warningText, align_h: align.CENTER_H,
                align_v: align.CENTER_V, text_style: text_style.WRAP
            })

            pageContext.createTrackedWidget(widget.TEXT, {
                x: 0, y: px(390), w: DEVICE_WIDTH, h: px(30),
                text: 'Waiting for button press...', text_size: px(20),
                color: COLORS.warningText, align_h: align.CENTER_H, align_v: align.CENTER_V
            })

            const waitProgressBar = pageContext.createTrackedWidget(widget.FILL_RECT, {
                x: px(140), y: px(440), w: px(10), h: px(6),
                color: COLORS.warningText, radius: px(3)
            })
            if (animateProgressBar) animateProgressBar(waitProgressBar)
            break
        }

        case STATES.FETCHING_DATA:
            // Sfondo successo
            pageContext.createTrackedWidget(widget.FILL_RECT, {
                x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT, color: COLORS.background
            })
            pageContext.createTrackedWidget(widget.TEXT, {
                x: 0, y: px(60), w: DEVICE_WIDTH, h: px(50),
                text: 'Paired Successfully!', text_size: px(36),
                color: COLORS.text, align_h: align.CENTER_H, align_v: align.CENTER_V
            })

            pageContext.createTrackedWidget(widget.TEXT, {
                x: 0, y: px(210), w: DEVICE_WIDTH, h: px(40),
                text: 'Loading your Hue setup...', text_size: px(26),
                color: COLORS.text, align_h: align.CENTER_H, align_v: align.CENTER_V
            })

            // Indicatori di progresso
            pageContext.createTrackedWidget(widget.TEXT, {
                x: px(60), y: px(280), w: px(360), h: px(40),
                text: `Lights Fetched: ${progress.lights}`, text_size: px(28),
                color: COLORS.text, align_h: align.CENTER_H, align_v: align.CENTER_V
            })
            break

        case STATES.ERROR:
            // Titolo errore
            pageContext.createTrackedWidget(widget.TEXT, {
                x: 0, y: px(60), w: px(480), h: px(50),
                text: 'Connection Error', text_size: px(36),
                color: COLORS.error, align_h: align.CENTER_H, align_v: align.CENTER_V
            })
            // Icona errore
            pageContext.createTrackedWidget(widget.CIRCLE, {
                center_x: px(240), center_y: px(160), radius: px(45),
                color: COLORS.error
            })
            // Messaggio di errore
            pageContext.createTrackedWidget(widget.TEXT, {
                x: px(40), y: px(240), w: px(400), h: px(100),
                text: error || 'Could not connect to Hue Bridge', text_size: px(24),
                color: COLORS.text, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.WRAP
            })
            // Bottone RETRY
            pageContext.createTrackedWidget(widget.BUTTON, {
                x: px(90), y: px(360), w: px(300), h: px(60),
                text: 'RETRY', text_size: px(28),
                normal_color: COLORS.highlight, press_color: COLORS.success, radius: px(10),
                click_func: retryFunc // Usa la funzione passata da index.js
            })
            break
    }
}