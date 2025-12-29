import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, text_style, anim_status, setStatusBarVisible } from '@zos/ui'
import { getText } from '@zos/i18n'
import { COLORS, btnPressColor } from '../utils/constants.js'

const STATES = {
  LOADING: 'LOADING',
  SEARCHING_BRIDGE: 'SEARCHING_BRIDGE',
  WAITING_FOR_PRESS: 'WAITING_FOR_PRESS',
  FETCHING_DATA: 'FETCHING_DATA',
  ERROR: 'ERROR',
  BT_ERROR: 'BT_ERROR',
  SUCCESS: 'SUCCESS'
}

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

setStatusBarVisible(false)

export function renderMainWidgets(pageContext, state, callbacks = {}) {
  const { animateSpinner, animateProgressBar, retryFunc } = callbacks
  const { currentState, error } = state

  // Sfondo universale
  pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: 0,
    y: 0,
    w: DEVICE_WIDTH,
    h: DEVICE_HEIGHT,
    color: COLORS.background
  })

  switch (currentState) {
    case STATES.LOADING:
      renderLoadingState(pageContext)
      break

    case STATES.SEARCHING_BRIDGE:
      renderSearchingBridge(pageContext, animateSpinner, animateProgressBar)
      break

    case STATES.WAITING_FOR_PRESS:
      renderWaitingForPress(pageContext, animateProgressBar)
      break

    case STATES.FETCHING_DATA:
      // ✅ SEMPLIFICATO: Usa stesso layout di LOADING
      renderLoadingState(pageContext, getText('LOADING_HUE_SETUP'))
      break

    case STATES.ERROR:
      renderError(pageContext, error, retryFunc)
      break

    case STATES.BT_ERROR:
      renderBluetoothError(pageContext, error, retryFunc)
      break
  }
}

// ============================================
// RENDER FUNCTIONS (Modularizzate)
// ============================================

function renderLoadingState(pageContext, customText = null) {
  // Testo
  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0,
    y: (DEVICE_HEIGHT / 2) + px(155),
    w: DEVICE_WIDTH,
    h: px(40),
    text_size: px(28),
    color: COLORS.text,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V,
    text_style: text_style.WRAP,
    text: customText || getText('LOADING')
  })

  // Animazione loading nativa
  pageContext.createTrackedWidget(widget.IMG_ANIM, {
    anim_path: 'anim',
    anim_prefix: 'loading',
    anim_ext: 'png',
    anim_fps: 24,
    anim_size: 54,
    repeat_count: 0,
    anim_status: anim_status.START,
    x: (DEVICE_WIDTH / 2) - px(77.5),
    y: DEVICE_HEIGHT / 2
  })
}

function renderSearchingBridge(pageContext, animateSpinner, animateProgressBar) {
  // Titolo
  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0,
    y: px(40),
    w: DEVICE_WIDTH,
    h: px(60),
    text: getText('HUE_BRIDGE'),
    text_size: px(40),
    color: COLORS.text,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  // Animazione spinner
  const spinner = pageContext.createTrackedWidget(widget.CIRCLE, {
    center_x: DEVICE_WIDTH / 2,
    center_y: px(180),
    radius: px(40),
    color: COLORS.highlight,
    alpha: 150
  })
  if (animateSpinner) animateSpinner(spinner)

  // Testo principale
  pageContext.createTrackedWidget(widget.TEXT, {
    x: px(40),
    y: px(260),
    w: DEVICE_WIDTH - px(80),
    h: px(80),
    text: getText('SEARCHING_BRIDGE'),
    text_size: px(26),
    color: COLORS.text,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V,
    text_style: text_style.WRAP
  })

  // Testo informativo
  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0,
    y: px(360),
    w: DEVICE_WIDTH,
    h: px(40),
    text: getText('BRIDGE_POWERED_ON'),
    text_size: px(20),
    color: COLORS.inactive,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  // Barra di progresso
  const progressBar = pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: px(140),
    y: px(420),
    w: px(10),
    h: px(6),
    color: COLORS.highlight,
    radius: px(3)
  })
  if (animateProgressBar) animateProgressBar(progressBar)
}

function renderWaitingForPress(pageContext, animateProgressBar) {
  // Sfondo warning
  pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: 0,
    y: 0,
    w: DEVICE_WIDTH,
    h: DEVICE_HEIGHT,
    color: COLORS.warning
  })

  // Titolo
  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0,
    y: px(50),
    w: DEVICE_WIDTH,
    h: px(50),
    text: getText('BRIDGE_FOUND'),
    text_size: px(38),
    color: COLORS.warningText,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  // Icona bridge
  pageContext.createTrackedWidget(widget.IMG, {
    x: DEVICE_WIDTH / 2 - px(50),
    y: DEVICE_HEIGHT / 2 - px(100),
    src: 'push-linkv2.png'
  })

  // Istruzioni
  pageContext.createTrackedWidget(widget.TEXT, {
    x: px(40),
    y: px(270),
    w: DEVICE_WIDTH - px(80),
    h: px(100),
    text: getText('PRESS_BUTTON_TO_PAIR'),
    text_size: px(28),
    color: COLORS.warningText,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V,
    text_style: text_style.WRAP
  })

  // Sottotitolo
  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0,
    y: px(390),
    w: DEVICE_WIDTH,
    h: px(30),
    text: getText('WAIT_PRESS'),
    text_size: px(20),
    color: COLORS.warningText,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  // Progress bar animata
  const progressBar = pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: px(140),
    y: px(440),
    w: px(10),
    h: px(6),
    color: COLORS.warningText,
    radius: px(3)
  })
  if (animateProgressBar) animateProgressBar(progressBar)
}

function renderError(pageContext, error, retryFunc) {
  // Titolo errore
  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0,
    y: px(60),
    w: DEVICE_WIDTH,
    h: px(50),
    text: getText('CONNECTION_ERROR') || 'Connection Error',
    text_size: px(36),
    color: COLORS.error,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  // Icona errore
  pageContext.createTrackedWidget(widget.CIRCLE, {
    center_x: DEVICE_WIDTH / 2,
    center_y: px(160),
    radius: px(45),
    color: COLORS.error
  })

  // Messaggio di errore
  pageContext.createTrackedWidget(widget.TEXT, {
    x: px(40),
    y: px(240),
    w: DEVICE_WIDTH - px(80),
    h: px(100),
    text: error || getText('BRIDGE_CONNECTION_FAILED') || 'Could not connect to Hue Bridge',
    text_size: px(24),
    color: COLORS.text,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V,
    text_style: text_style.WRAP
  })

  // Bottone RETRY
  pageContext.createTrackedWidget(widget.BUTTON, {
    x: px(90),
    y: px(360),
    w: px(300),
    h: px(60),
    text: getText('RETRY'),
    text_size: px(28),
    normal_color: COLORS.highlight,
    press_color: btnPressColor(COLORS.highlight, 0.8),
    radius: px(10),
    click_func: retryFunc
  })
}

function renderBluetoothError(pageContext, error, retryFunc) {
  // Icona errore Bluetooth
  pageContext.createTrackedWidget(widget.CIRCLE, {
    center_x: DEVICE_WIDTH / 2,
    center_y: DEVICE_HEIGHT / 2 - px(100),
    radius: px(50),
    color: COLORS.error,
    alpha: 100
  })

  // Simbolo Bluetooth
  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0,
    y: DEVICE_HEIGHT / 2 - px(130),
    w: DEVICE_WIDTH,
    h: px(60),
    text: '🔵✕',
    text_size: px(48),
    color: COLORS.error,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  // Titolo errore
  pageContext.createTrackedWidget(widget.TEXT, {
    x: px(20),
    y: DEVICE_HEIGHT / 2 - px(40),
    w: DEVICE_WIDTH - px(40),
    h: px(60),
    text: getText('BT_NOT_CONNECTED'),
    text_size: px(26),
    color: COLORS.error,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  // Istruzioni
  pageContext.createTrackedWidget(widget.TEXT, {
    x: px(30),
    y: DEVICE_HEIGHT / 2 + px(30),
    w: DEVICE_WIDTH - px(60),
    h: px(100),
    text: getText('BT_CONNECT_INSTRUCTIONS'),
    text_size: px(20),
    color: COLORS.textSubtitle,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V,
    text_style: text_style.WRAP
  })

  // Info auto-retry
  pageContext.createTrackedWidget(widget.TEXT, {
    x: px(30),
    y: DEVICE_HEIGHT / 2 + px(140),
    w: DEVICE_WIDTH - px(60),
    h: px(60),
    text: getText('BT_AUTO_RETRY'),
    text_size: px(16),
    color: COLORS.textSubtitle,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  })

  // Bottone Retry manuale
  pageContext.createTrackedWidget(widget.BUTTON, {
    x: DEVICE_WIDTH / 2 - px(80),
    y: DEVICE_HEIGHT - px(120),
    w: px(160),
    h: px(50),
    text: getText('RETRY'),
    text_size: px(24),
    normal_color: COLORS.highlight,
    press_color: btnPressColor(COLORS.highlight, 0.8),
    radius: px(25),
    click_func: retryFunc
  })
}