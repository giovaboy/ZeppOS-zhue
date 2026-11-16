// page/quick-toggle.js
// Opened by a tap on the shortcut card: switches the light or the group
// (room, zone), shows it, and goes back to the card.
//
//        ( icon )        the card's tile, large: the icon in its color, the
//                        ring of its state; the ring breathes while the
//      Soggiorno         command is on its way (1-2.7 s)
//      Turning on…       what it does: from the last state the card knew
//                        ("Toggling…" when unknown); then the new state
//                        ("On" / "Lights on"), shown RESULT_MS, or the error
//
// It used to show two small texts (the name, "Toggling...") and leave 0.2 s
// after the answer, with nothing to see.
import { BasePage } from '@zeppos/zml/base-page'
import { loggedPage, infoLog, warnLog } from '../utils/remote-log.js'
import { errorText } from '../utils/log-text.js'
import { rememberOnOff, rememberLights, rememberGroups, cardLightIds, cardGroupIds, readShortcuts, findCardEntry } from '../utils/shortcuts.js'
import { startBreath, stopPulses } from '../utils/pulse.js'
import { back } from '@zos/router'
import { createWidget, widget, deleteWidget, align, text_style, getTextLayout, setStatusBarVisible } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'
import { getText } from '@zos/i18n'
import { COLORS, lightIconName, ICON_IMAGE_SIZE, CARD_STATE_FRESH_MS, getGroupIconPath } from '../utils/constants'
import { getLogger } from '../utils/logger'
import { connectStatus } from '@zos/ble'

setStatusBarVisible(false)

const logger = getLogger('zhue-quick-toggle')
const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

const TILE = px(150)
const RING_W = px(6)
const NAME_W = px(320)
// How long the new state shows before going back to the card
const RESULT_MS = 700
// An error stays longer: it is read
const ERROR_MS = 2500
// No answer from the phone in this time: said, and back to the card (the
// phone gives up on the bridge after 4 s: CARD_BRIDGE_TIMEOUT_MS)
const NO_ANSWER_MS = 9000

Page(
  loggedPage('quick-toggle', BasePage({
    state: {
      lightId: null,
      lightName: '',
      status: 'working' // 'working' | 'done' | 'error'
    },
    widgets: [],

    onInit(p) {
      let params = {}
      try {
        params = typeof p === 'string' ? JSON.parse(p) : (p || {})
      } catch (e) {
        logger.error('Failed to parse params:', e)
      }
      // BasePage shares `state` between instances of this page: reset all
      this.widgets = []
      this.state.status = 'working'
      this.state.error = null
      // A light, or a group (room, zone) from the card: kind 'group'
      this.state.kind = params.kind === 'group' ? 'group' : 'light'
      this.state.lightId = this.state.kind === 'group' ? params.groupId : params.lightId
      this.state.lightName = params.name || params.lightName || 'Light'
      // What the card knew of it: its icon, color and state
      this.state.entry = this.state.lightId ? findCardEntry(readShortcuts(), this.state.kind, this.state.lightId) || {} : {}

      if (!this.state.lightId) {
        this.state.status = 'error'
        this.state.error = getText('ERROR')
      } else if (!connectStatus()) {
        this.state.status = 'error'
        this.state.error = getText('BT_NOT_CONNECTED')
      }
    },

    build() {
      this.renderUI()
      if (this.state.status === 'working') this.doToggle()
      else this.goBackAfterDelay(ERROR_MS)
    },

    clearAllWidgets() {
      stopPulses(this)
      this.widgets.forEach(w => {
        try { deleteWidget(w) } catch (e) {}
      })
      this.widgets = []
    },

    createTrackedWidget(type, props) {
      const w = createWidget(type, props)
      this.widgets.push(w)
      return w
    },

    // The card's tile, large. ison: true / false, or null for unknown
    renderTile(ison, color) {
      const cx = DEVICE_WIDTH / 2
      const top = DEVICE_HEIGHT / 2 - px(120)
      const box = { x: cx - TILE / 2, y: top, w: TILE, h: TILE, radius: TILE / 2 }
      // #333333 under the icon's mask (it is a #333333 square with the shape cut out)
      this.createTrackedWidget(widget.FILL_RECT, { ...box, color: COLORS.lightBg })
      const ix = cx - ICON_IMAGE_SIZE / 2
      const iy = top + (TILE - ICON_IMAGE_SIZE) / 2
      this.createTrackedWidget(widget.FILL_RECT, {
        x: ix + 1, y: iy + 1, w: ICON_IMAGE_SIZE - 2, h: ICON_IMAGE_SIZE - 2,
        color: ison === true && color !== undefined ? color : COLORS.lightOff
      })
      const entry = this.state.entry || {}
      this.createTrackedWidget(widget.IMG, {
        x: ix, y: iy, w: ICON_IMAGE_SIZE, h: ICON_IMAGE_SIZE,
        src: this.state.kind === 'group'
          ? getGroupIconPath(entry.groupClass || 'Other')
          : `icons/${lightIconName(entry)}.png`
      })
      if (ison !== null) {
        this.createTrackedWidget(widget.STROKE_RECT, {
          ...box, line_width: RING_W, color: ison ? COLORS.success : 0x777777
        })
      }
      return box
    },

    renderUI() {
      this.clearAllWidgets()
      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: DEVICE_WIDTH, h: DEVICE_HEIGHT, color: COLORS.background
      })

      const { status, kind, entry = {} } = this.state
      const known = typeof entry.at === 'number' && Date.now() - entry.at < CARD_STATE_FRESH_MS
      let ison = known ? entry.ison === true : null
      if (status === 'done') ison = this.state.newState
      const box = this.renderTile(ison, status === 'done' ? this.state.newColor : entry.color)
      // The command on its way: the tile's border breathes
      if (status === 'working') startBreath(this, { ...box, label: 'quick-toggle' }, COLORS.white)

      // The name, its size reduced until it fits (then "…")
      const name = this.state.lightName
      let size = px(34)
      try {
        while (size > px(26) && getTextLayout(String(name), { text_size: size, text_width: 0, wrapped: 0 }).width > NAME_W) size -= px(2)
      } catch (e) {}
      const nameY = box.y + TILE + px(20)
      this.createTrackedWidget(widget.TEXT, {
        x: (DEVICE_WIDTH - NAME_W) / 2, y: nameY, w: NAME_W, h: px(46),
        text: name,
        text_size: size,
        color: COLORS.text,
        align_h: align.CENTER_H, align_v: align.CENTER_V,
        text_style: text_style.ELLIPSIS
      })

      // What it does, then what it did
      const group = kind === 'group'
      let line
      let color = COLORS.textSubtitle
      if (status === 'error') {
        line = this.state.error || getText('ERROR')
        color = COLORS.error
      } else if (status === 'done') {
        line = getText(group
          ? (this.state.newState ? 'GROUP_STATE_ON' : 'GROUP_STATE_OFF')
          : (this.state.newState ? 'LIGHT_STATE_ON' : 'LIGHT_STATE_OFF'))
        color = this.state.newState ? COLORS.text : COLORS.textSubtitle
      } else {
        // The direction from the last state the card knew
        line = ison === null ? getText('TOGGLING') : getText(ison ? 'QT_TURNING_OFF' : 'QT_TURNING_ON')
      }
      this.createTrackedWidget(widget.TEXT, {
        x: px(40), y: nameY + px(48), w: DEVICE_WIDTH - px(80), h: px(64),
        text: line,
        text_size: px(24),
        color,
        align_h: align.CENTER_H, align_v: align.TOP,
        text_style: text_style.WRAP
      })
    },

    doToggle() {
      const t0 = Date.now()
      const isGroup = this.state.kind === 'group'
      // The page used to breathe until left (13.9 s), with nothing said
      this._noAnswer = setTimeout(() => {
        this._noAnswer = null
        if (this.state.status !== 'working') return
        warnLog(`[quick-toggle] ${this.state.kind} ${this.state.lightId}: no answer from the phone in ${Date.now() - t0}ms`)
        this.state.status = 'error'
        this.state.error = getText('QT_NO_ANSWER')
        this.renderUI()
        this.goBackAfterDelay(ERROR_MS)
      }, NO_ANSWER_MS)
      this.request({
        method: isGroup ? 'WIDGET_TOGGLE_GROUP' : 'WIDGET_TOGGLE_LIGHT',
        params: {
          ...(isGroup ? { groupId: this.state.lightId } : { lightId: this.state.lightId }),
          // The opposite of what the card showed (and this page says:
          // "Turning off…"), while its state was fresh; else the phone
          // toggles the bridge's (app-side cardWanted)
          ...this.wantedState(),
          // Names this tap: a request delivered twice toggles once (app-side tapReply)
          tapId: `${t0.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
          // The phone answers with the states of all the card's entries
          cardLightIds: cardLightIds(),
          cardGroupIds: cardGroupIds()
        }
      })
        .then(result => {
          if (this.state.status !== 'working') return // said "no answer" already
          if (!result.success) throw result
          infoLog(`[quick-toggle] ${this.state.kind} ${this.state.lightId} now ${result.newState ? 'on' : 'off'}, ${Date.now() - t0}ms from the tap`)
          // The card shows every entry as it is now when it comes back
          if (result.cardLights) rememberLights(result.cardLights.map((l) => [l.id, l]))
          if (result.cardGroups) rememberGroups(result.cardGroups.map((g) => [g.id, g]))
          if (!result.cardLights && !result.cardGroups) rememberOnOff(this.state.kind, this.state.lightId, result.newState)
          // The new state, with the color the card now keeps
          const kept = findCardEntry(readShortcuts(), this.state.kind, this.state.lightId)
          this.state.newState = !!result.newState
          this.state.newColor = kept && kept.color !== undefined ? kept.color : this.state.entry.color
          this.state.status = 'done'
          this.renderUI()
          this.goBackAfterDelay(RESULT_MS)
        })
        .catch(err => {
          if (this.state.status !== 'working') return
          logger.error('Toggle error:', err)
          // The phone couldn't reach the bridge (app-side cardFirstRead)
          const unreachable = !!err && (err.code === 'UNREACHABLE' || (err.error && err.error.code === 'UNREACHABLE') ||
            /bridge unreachable/.test(String((err && (err.error && err.error.message || err.error || err.message)) || '')))
          warnLog(`[quick-toggle] ${this.state.kind} ${this.state.lightId}: failed after ${Date.now() - t0}ms${unreachable ? ', bridge unreachable' : `: ${errorText(err)}`}`)
          this.state.status = 'error'
          this.state.error = getText(unreachable ? 'QT_BRIDGE_UNREACHABLE' : 'ERROR')
          this.renderUI()
          this.goBackAfterDelay(ERROR_MS)
        })
    },

    wantedState() {
      const entry = this.state.entry || {}
      const known = typeof entry.at === 'number' && Date.now() - entry.at < CARD_STATE_FRESH_MS
      return known && typeof entry.ison === 'boolean' ? { state: !entry.ison } : {}
    },

    goBackAfterDelay(ms) {
      try {
        setTimeout(() => back(), ms)
      } catch (e) {
        back()
      }
    },

    onDestroy() {
      if (this._noAnswer) { clearTimeout(this._noAnswer); this._noAnswer = null }
      this.clearAllWidgets()
    }
  }))
)
