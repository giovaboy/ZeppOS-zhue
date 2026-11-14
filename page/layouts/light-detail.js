// The light page, for round and square screens alike (light-detail.r/s.layout
// re-export it): one long page that scrolls as a whole, as Zepp lists do.
//
//   name                       title only (it used to be the switch, and
//   ( lamp ) ( palette )       grew into a grey disc the size of the
//   On                         screen when the light was off); the palette
//   [ brightness slider ]      (color and white) while on, for lights with
//                              color or white temperature; brightness for
//                              every light while on
//   Favorites                  shown when off too: applying one turns it on
//   ( ) ( ) ( ) ( ) ( )
//   ( ) ( +)                   "add the current color": the grid's last tile
//   Hold a favorite to delete it
//   Shortcut  ◯                (page/layouts/card-row.js)
//
// The page scrolls (setScrollLock off); the page locks it while the slider is
// dragged. Keys: the items go to callbacks.nav (utils/key-nav.js).
import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { widget, align, event, text_style, prop, getTextLayout } from '@zos/ui'
import { getText } from '@zos/i18n'
import { BRI_RANGE, COLORS, PRESET_TYPES, LIGHT_MODELS, ICON_IMAGE_SIZE, btnPressColor, hexStringToInt, lightDisplayColor } from '../../utils/constants.js'
import { createPageView } from '../../utils/key-nav.js'
import { renderLoading } from '../../utils/loading.js'
import { renderCardRow, CARD_ROW_H } from './card-row.js'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

const CONTENT_W = px(360)
const SLIDER_W = px(300)
const TILE = px(60)
const TILE_GAP = px(12)
const POWER = px(112)
// Controls on a page whose own color is #333333 (zeppamp's controlOnSurface)
const CONTROL_ON_GREY = 0x4a4a4a

export const LAYOUT_CONFIG = {
  headerY: px(28),
  headerH: px(48),
  sliderX: (DEVICE_WIDTH - SLIDER_W) / 2,
  sliderW: SLIDER_W,
  sliderH: px(50)
}

// A widget drawn over a button: taps go through to the button
function passThrough(w) {
  try { w.setEnable(false) } catch (e) {}
  return w
}

export function renderLightDetail(pageContext, state, callbacks) {
  const { light, lightName, isLoading, error } = state
  const { retryFunc } = callbacks

  if (isLoading) return renderMessage(pageContext, lightName, getText('LOADING'), null, callbacks, false, true)
  if (error) return renderMessage(pageContext, lightName, error, retryFunc, callbacks, true)
  if (!light) return renderMessage(pageContext, lightName, getText('NO_DATA'), retryFunc, callbacks)
  return renderNormalState(pageContext, state, callbacks)
}

// Loading, error, no data: the name, a line, an optional retry button
function renderMessage(pageContext, lightName, text, retryFunc, callbacks, isError = false, loading = false) {
  const { nav } = callbacks
  pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT, color: COLORS.background
  })
  renderTitle(pageContext, lightName || getText('LIGHT_DETAIL'))
  // Loading: the pulsing dot and its line, centered on the screen
  if (loading) return renderLoading(pageContext, text)
  pageContext.createTrackedWidget(widget.TEXT, {
    x: px(40), y: DEVICE_HEIGHT / 2 - px(60), w: DEVICE_WIDTH - px(80), h: px(100),
    text: text || getText('ERROR'),
    text_size: px(24),
    color: isError ? COLORS.error : COLORS.loading,
    align_h: align.CENTER_H, align_v: align.CENTER_V,
    text_style: text_style.WRAP
  })
  if (retryFunc) {
    const btn = { x: DEVICE_WIDTH / 2 - px(90), y: DEVICE_HEIGHT / 2 + px(60), w: px(180), h: px(56) }
    pageContext.createTrackedWidget(widget.BUTTON, {
      ...btn,
      text: getText('RETRY'),
      text_size: px(24),
      normal_color: COLORS.highlight,
      press_color: btnPressColor(COLORS.highlight),
      radius: btn.h / 2,
      click_func: retryFunc
    })
    if (nav) nav.items.push({ key: 'retry', ...btn, radius: btn.h / 2, select: retryFunc })
  }
  return { contentHeight: DEVICE_HEIGHT }
}

// The title's width: what a round screen leaves at that height (a 320 px box
// was cut by the screen's edge: "Lampadina Abat-jour")
const TITLE_W = px(280)

// The name, its size reduced (32 down to 24) until it fits; longer still,
// cut with "…"
function renderTitle(pageContext, text) {
  let size = px(32)
  try {
    while (size > px(24) && getTextLayout(String(text), { text_size: size, text_width: 0, wrapped: 0 }).width > TITLE_W) size -= px(2)
  } catch (e) { /* getTextLayout missing: 32 and "…" */ }
  pageContext.createTrackedWidget(widget.TEXT, {
    x: (DEVICE_WIDTH - TITLE_W) / 2,
    y: LAYOUT_CONFIG.headerY,
    w: TITLE_W,
    h: LAYOUT_CONFIG.headerH,
    text,
    text_size: size,
    color: COLORS.text,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V,
    text_style: text_style.ELLIPSIS
  })
}

// The favorites this light can show: colors on color lights, white
// temperatures on color and white lights, brightness levels on the others
function compatiblePresets(favoriteColors, caps) {
  const isColorLight = caps.includes('color')
  const isCtLight = caps.includes('ct')
  return (favoriteColors || []).filter((fav) => {
    switch (fav.type) {
      case PRESET_TYPES.COLOR: return isColorLight
      case PRESET_TYPES.CT: return isCtLight || isColorLight
      case PRESET_TYPES.WHITE: return !isCtLight && !isColorLight
      default: return false
    }
  })
}

function renderNormalState(pageContext, state, callbacks) {
  const { light, lightName, favoriteColors } = state
  const {
    toggleLightFunc, setBrightnessDrag, openColorPickerFunc, applyPresetFunc,
    addFavoriteFunc, deleteFavoriteFunc, getLightBgColor, isInWidgetShortcuts,
    toggleWidgetShortcutFunc, nav
  } = callbacks

  const lightOn = !!light.ison
  const reachable = light.reachable !== false
  const caps = callbacks.capabilities(light) || ['brightness']
  const hasColor = caps.includes('color') || caps.includes('ct')
  const presets = compatiblePresets(favoriteColors, caps)

  // ── Where everything goes (first, to size the background)
  const cols = Math.floor((CONTENT_W + TILE_GAP) / (TILE + TILE_GAP))
  const gridW = cols * (TILE + TILE_GAP) - TILE_GAP
  const gridX = (DEVICE_WIDTH - gridW) / 2
  const rows = Math.ceil((presets.length + 1) / cols) // + the "add" tile

  let y = LAYOUT_CONFIG.headerY + LAYOUT_CONFIG.headerH + px(10)
  const powerY = y
  y += POWER + px(6)
  const statusY = y
  y += px(36) + px(14)
  const sliderY = lightOn ? y : null
  if (lightOn) y += LAYOUT_CONFIG.sliderH + px(22)
  const presetsTitleY = y
  y += px(40) + (presets.length ? 0 : px(56)) + px(6)
  const gridY = y
  y += rows * (TILE + TILE_GAP) - TILE_GAP + px(10)
  const hintY = presets.length ? y : null
  if (hintY !== null) y += px(56)
  const widgetY = toggleWidgetShortcutFunc ? y + px(10) : null
  if (widgetY !== null) y = widgetY + CARD_ROW_H
  const contentHeight = y + px(100) // room at the bottom of a round screen

  const view = nav ? createPageView(contentHeight) : null
  if (nav) nav.view = view

  // ── Background: tinted with the light's color while on
  const bgColor = lightOn ? getLightBgColor(lightDisplayColor(light).toString(16).padStart(6, '0')) : COLORS.background
  pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: 0, y: 0, w: DEVICE_WIDTH, h: contentHeight, color: bgColor
  })
  // Controls on the page: #333333, or a lighter grey where the page itself is
  // #333333 (a white light's tint): they vanished into it
  const control = bgColor === COLORS.lightBg ? CONTROL_ON_GREY : COLORS.lightBg

  renderTitle(pageContext, lightName)

  // ── The switch: the light's icon in its color, a green ring while on
  renderLampButton(pageContext, powerY, light, lightOn, toggleLightFunc, nav, view)
  // ── Beside it, the palette: color and white (the lamp already shows the
  // color; a capsule under the slider repeated it)
  if (lightOn && hasColor) renderPaletteButton(pageContext, powerY, light, openColorPickerFunc, nav, view, control)

  // ── State line (the brightness is on the slider)
  const statusText = !reachable ? getText('UNREACHABLE')
    : getText(lightOn ? 'LIGHT_STATE_ON' : 'LIGHT_STATE_OFF')
  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0, y: statusY, w: DEVICE_WIDTH, h: px(36),
    text: statusText,
    text_size: px(24),
    color: COLORS.textSubtitle,
    align_h: align.CENTER_H, align_v: align.CENTER_V
  })

  // ── Brightness (every light, while on)
  if (sliderY !== null) renderBrightnessSlider(pageContext, state, sliderY, setBrightnessDrag, control)

  // ── Favorites (shown when off too: applying one turns the light on)
  pageContext.createTrackedWidget(widget.TEXT, {
    x: 0, y: presetsTitleY, w: DEVICE_WIDTH, h: px(40),
    text: getText('PRESETS_TITLE'),
    text_size: px(24),
    color: COLORS.sectionHeader,
    align_h: align.CENTER_H, align_v: align.CENTER_V
  })
  if (!presets.length) {
    pageContext.createTrackedWidget(widget.TEXT, {
      x: (DEVICE_WIDTH - CONTENT_W) / 2 + px(20), y: presetsTitleY + px(40), w: CONTENT_W - px(40), h: px(56),
      text: getText('NO_PRESETS'),
      text_size: px(20),
      color: COLORS.textSubtitle,
      align_h: align.CENTER_H, align_v: align.CENTER_V,
      text_style: text_style.WRAP
    })
  }
  presets.forEach((fav, i) => {
    const box = {
      x: gridX + (i % cols) * (TILE + TILE_GAP),
      y: gridY + Math.floor(i / cols) * (TILE + TILE_GAP),
      w: TILE, h: TILE
    }
    const radius = fav.type === PRESET_TYPES.COLOR ? TILE / 2 : px(10)
    const color = hexStringToInt(fav.hex)
    pageContext.createTrackedWidget(widget.BUTTON, {
      ...box,
      text: fav.type === PRESET_TYPES.WHITE ? `${Math.round((fav.bri / BRI_RANGE) * 100)}%` : '',
      text_size: px(18),
      color: 0x000000,
      normal_color: color,
      press_color: btnPressColor(color),
      radius,
      click_func: () => applyPresetFunc(fav),
      longpress_func: () => deleteFavoriteFunc(fav)
    })
    if (nav) nav.items.push({
      key: `preset:${fav.id ?? i}`, ...box, radius, view,
      select: () => applyPresetFunc(fav),
      longSelect: () => deleteFavoriteFunc(fav)
    })
  })
  // The last tile adds the light's current color (it was a small "+" at the
  // edge of the screen)
  const addBox = {
    x: gridX + (presets.length % cols) * (TILE + TILE_GAP),
    y: gridY + Math.floor(presets.length / cols) * (TILE + TILE_GAP),
    w: TILE, h: TILE
  }
  pageContext.createTrackedWidget(widget.BUTTON, {
    ...addBox,
    text: '+',
    text_size: px(40),
    color: COLORS.text,
    normal_color: control,
    press_color: btnPressColor(control),
    radius: TILE / 2,
    click_func: addFavoriteFunc
  })
  if (nav) nav.items.push({ key: 'add', ...addBox, radius: TILE / 2, view, select: addFavoriteFunc })

  if (hintY !== null) {
    pageContext.createTrackedWidget(widget.TEXT, {
      x: (DEVICE_WIDTH - CONTENT_W) / 2 + px(20), y: hintY, w: CONTENT_W - px(40), h: px(56),
      text: getText('PRESET_DELETE_HINT'),
      text_size: px(20),
      color: COLORS.textSubtitle,
      align_h: align.CENTER_H, align_v: align.CENTER_V,
      text_style: text_style.WRAP
    })
  }

  // ── Shortcut: a switch on the page's background (it was a 20 px star at the
  // screen's top edge, or a held SELECT)
  if (widgetY !== null) {
    renderCardRow((t, p) => pageContext.createTrackedWidget(t, p), widgetY, !!isInWidgetShortcuts, toggleWidgetShortcutFunc, { nav, view })
  }

  // Room at the bottom: the page scrolls past the last row
  pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: 0, y: contentHeight - px(2), w: DEVICE_WIDTH, h: px(2), color: bgColor
  })

  return { contentHeight }
}

// The switch: a round button with the light's own icon in its color (grey
// while off), as in the group's list, and a ring that says the state (green
// on, grey off).
// The icon is a mask, #333333 with the shape cut out, over a FILL_RECT of the
// color: the button must stay #333333 (COLORS.lightBg) for the mask's square
// not to show, so it doesn't darken when pressed; the ring does (−28.6%,
// Zepp: visual feedback for every press)
function renderLampButton(pageContext, y, light, lightOn, onTap, nav, view) {
  const cx = DEVICE_WIDTH / 2
  const cy = y + POWER / 2
  const box = { x: cx - POWER / 2, y, w: POWER, h: POWER }
  const ringColor = lightOn ? COLORS.success : COLORS.toggleOff
  const reachable = light.reachable !== false
  const swatch = lightOn && reachable ? lightDisplayColor(light) : COLORS.inactive
  const icon = `icons/${(LIGHT_MODELS[light.modelid] || LIGHT_MODELS.default).icon}.png`

  const button = pageContext.createTrackedWidget(widget.BUTTON, {
    ...box,
    text: '',
    normal_color: COLORS.lightBg,
    press_color: COLORS.lightBg,
    radius: POWER / 2,
    click_func: onTap
  })
  // Inset by 1 px under the mask: a mask a pixel off shows the button, not a
  // line of this color (see the groups layout)
  passThrough(pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: cx - ICON_IMAGE_SIZE / 2 + 1, y: cy - ICON_IMAGE_SIZE / 2 + 1,
    w: ICON_IMAGE_SIZE - 2, h: ICON_IMAGE_SIZE - 2,
    color: swatch
  }))
  passThrough(pageContext.createTrackedWidget(widget.IMG, {
    x: cx - ICON_IMAGE_SIZE / 2, y: cy - ICON_IMAGE_SIZE / 2,
    w: ICON_IMAGE_SIZE, h: ICON_IMAGE_SIZE,
    src: icon
  }))
  const ring = passThrough(pageContext.createTrackedWidget(widget.STROKE_RECT, {
    ...box,
    radius: POWER / 2,
    line_width: px(5),
    color: ringColor
  }))
  // The ring darkens while pressed (where the button takes listeners)
  try {
    button.addEventListener(event.CLICK_DOWN, () => { try { ring.setProperty(prop.MORE, { ...box, radius: POWER / 2, line_width: px(5), color: btnPressColor(ringColor) }) } catch (e) {} })
    button.addEventListener(event.CLICK_UP, () => { try { ring.setProperty(prop.MORE, { ...box, radius: POWER / 2, line_width: px(5), color: ringColor }) } catch (e) {} })
  } catch (e) {}
  if (nav) nav.items.push({ key: 'power', ...box, radius: POWER / 2, view, select: onTap })
}

function renderBrightnessSlider(pageContext, state, sliderY, dragCallback, control) {
  const { light, isDraggingBrightness, tempBrightness } = state
  const brightness = isDraggingBrightness ? tempBrightness : light.bri
  const brightnessPercent = Math.round(brightness / BRI_RANGE * 100)
  const { sliderX, sliderW, sliderH } = LAYOUT_CONFIG

  pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: sliderX, y: sliderY, w: sliderW, h: sliderH,
    radius: sliderH / 2,
    color: control
  })
  const fillWidth = Math.max(px(10), (brightness / BRI_RANGE) * sliderW)
  pageContext.state.brightnessSliderFillWidget = pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: sliderX, y: sliderY, w: fillWidth, h: sliderH,
    radius: sliderH / 2,
    color: COLORS.sliderFill
  })
  pageContext.state.brightnessLabel = pageContext.createTrackedWidget(widget.TEXT, {
    x: sliderX, y: sliderY, w: sliderW, h: sliderH,
    text: `${brightnessPercent}%`,
    text_size: px(28),
    color: COLORS.briText || COLORS.text,
    align_h: align.CENTER_H, align_v: align.CENTER_V
  })
  pageContext.createTrackedWidget(widget.IMG, {
    x: sliderX + px(20), y: sliderY + sliderH / 2 - px(16), src: 'bri-low.png'
  })
  pageContext.createTrackedWidget(widget.IMG, {
    x: sliderX + sliderW - px(52), y: sliderY + sliderH / 2 - px(16), src: 'bri-hi.png'
  })
  // The touch area, a little larger than the track
  const pad = px(20)
  const hitbox = pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: sliderX - pad, y: sliderY - pad, w: sliderW + pad * 2, h: sliderH + pad * 2,
    color: 0, alpha: 0
  })
  if (dragCallback) {
    hitbox.addEventListener(event.CLICK_DOWN, (info) => dragCallback('DOWN', info))
    hitbox.addEventListener(event.MOVE, (info) => dragCallback('MOVE', info))
    hitbox.addEventListener(event.CLICK_UP, (info) => dragCallback('UP', info))
  }
}

// Color and white: a round button with the palette icon beside the lamp. The
// icon is white with its dots cut out, over a rect of the light's color: the
// dots show it (no mask square here, so the button may darken when pressed)
const PALETTE = px(76)
function renderPaletteButton(pageContext, lampY, light, onTap, nav, view, control) {
  const cx = DEVICE_WIDTH / 2 + POWER / 2 + px(16) + PALETTE / 2
  const cy = lampY + POWER / 2
  const box = { x: cx - PALETTE / 2, y: cy - PALETTE / 2, w: PALETTE, h: PALETTE }
  pageContext.createTrackedWidget(widget.BUTTON, {
    ...box,
    text: '',
    normal_color: control,
    press_color: btnPressColor(control),
    radius: PALETTE / 2,
    click_func: onTap
  })
  const ix = cx - ICON_IMAGE_SIZE / 2
  const iy = cy - ICON_IMAGE_SIZE / 2
  passThrough(pageContext.createTrackedWidget(widget.FILL_RECT, {
    x: ix + px(10), y: iy + px(12), w: ICON_IMAGE_SIZE - px(26), h: ICON_IMAGE_SIZE - px(22),
    radius: px(8),
    color: lightDisplayColor(light)
  }))
  passThrough(pageContext.createTrackedWidget(widget.IMG, {
    x: ix, y: iy, w: ICON_IMAGE_SIZE, h: ICON_IMAGE_SIZE,
    src: 'color-picker2.png'
  }))
  if (nav) nav.items.push({ key: 'color', ...box, radius: PALETTE / 2, view, select: onTap })
}
