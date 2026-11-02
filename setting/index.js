import { gettext } from 'i18n'
import { DEFAULT_PRESETS, PRESET_TYPES, DEFAULT_USER_SETTINGS, comparePresets } from '../utils/constants'
import { LOG_KEY } from '../app-side/log.js'
import { logsEnabled } from '../config.js'
import { LOGO_SRC, LOGO_WIDTH, LOGO_HEIGHT } from './logo'

// The wordmark's width on the page; its height follows (tools/gen-settings-logo.cjs)
const LOGO_SHOWN_WIDTH = 200

// Keep in step with app.json version.name (the settings page can't import
// @zos/app to read it)
const APP_VERSION = '1.0.1'
const APP_NAME = 'zhue'

// ── Look ────────────────────────────────────────────────────────────────────
// One light style for every card: white on a light grey page, one accent (the
// watch's purple tab, COLORS.activeTab), one red for what deletes
const C = {
  page: '#f2f3f5',
  card: '#ffffff',
  border: '#e3e5e8',
  text: '#222222',
  textSecondary: '#6c757d',
  control: '#e9ecef',
  accent: '#984ce5',
  onAccent: '#ffffff',
  ok: '#2e9e5b',
  danger: '#db2c2c'
}
const FONT = { title: '17px', label: '14px', button: '15px', body: '14px', caption: '12px', mono: '11px' }

const card = (children, extra = {}) => View({
  style: { marginTop: '16px', padding: '16px', background: C.card, borderRadius: '12px', border: `1px solid ${C.border}`, ...extra }
}, children)
const title = (text) => Text({ style: { fontSize: FONT.title, fontWeight: '600', color: C.text, marginBottom: '6px' } }, [text])
const label = (text, extra = {}) => Text({ style: { fontSize: FONT.label, fontWeight: '600', color: C.text, ...extra } }, [text])
const note = (text, color = C.textSecondary, extra = {}) => Text({ paragraph: true, style: { fontSize: FONT.body, color, ...extra } }, [text])

// kind: 'danger' (deletes something) or 'control' (cancel, clear logs). A
// Button is as wide as its label: alone in a flex column it takes the card's
// width (app-settings-ui-components.md, "Observed rendering")
const button = (text, kind, onClick, extra = {}) => Button({
  label: text,
  onClick,
  style: {
    fontSize: FONT.button, fontWeight: '500', borderRadius: '24px',
    background: kind === 'danger' ? C.danger : C.control,
    color: kind === 'danger' ? 'white' : C.text,
    ...extra
  }
})
const column = (children, extra = {}) => View({ style: { display: 'flex', flexDirection: 'column', ...extra } }, children)
// Two buttons for one choice: side by side, sharing the width
const buttonPair = (first, second) => View({ style: { display: 'flex', marginTop: '12px' } }, [
  View({ style: { flex: 1 } }, [first]),
  View({ style: { flex: 1, marginLeft: '12px' } }, [second])
])

// Destructive actions take two taps, as in zeppamp's settings page: the first
// stores a confirm key (the page is built again), then the question in red
// with the action and Cancel side by side. Keys starting with 'ui_' belong to
// this page only (the side service ignores them)
const RESET_PRESETS_CONFIRM_KEY = 'ui_reset_presets_confirm'
const CLEAR_CONFIG_CONFIRM_KEY = 'ui_clear_config_confirm'

function confirmAction(storage, key, { text, question, run }) {
  if (storage.getItem(key) !== '1') {
    return column([button(text, 'danger', () => storage.setItem(key, '1'))], { marginTop: '16px' })
  }
  return column([
    note(question, C.danger, { fontWeight: '600' }),
    buttonPair(
      button(text, 'danger', () => { storage.removeItem(key); run() }, { width: '100%' }),
      button(gettext('CANCEL'), 'control', () => storage.removeItem(key), { width: '100%' })
    )
  ], { marginTop: '16px' })
}

// A choice among a few options, as in zeppamp's settings page: one button per
// option side by side, the chosen one in the accent. A Select can't be styled
// and doesn't show the choice in its closed state
function choice(text, options, chosen, onPick) {
  return View({ style: { marginTop: '14px' } }, [
    label(text),
    View({ style: { display: 'flex', marginTop: '8px' } }, options.map((o, i) =>
      View({ style: { flex: 1, marginLeft: i ? '8px' : '0' } }, [
        Button({
          label: o.label,
          onClick: () => { if (o.value !== chosen) onPick(o.value) },
          style: {
            width: '100%', fontSize: FONT.label, fontWeight: '500', borderRadius: '24px',
            background: o.value === chosen ? C.accent : C.control,
            color: o.value === chosen ? C.onAccent : C.text
          }
        })
      ])
    ))
  ])
}

// The bridge key, shortened: enough to tell two keys apart, not enough to
// use one from a screenshot of this page
function maskKey(key) {
  if (!key) return ''
  return key.length > 12 ? `${key.slice(0, 4)}…${key.slice(-4)}` : '…'
}

AppSettingsPage({
  build(props) {
    const storage = props.settingsStorage
    const bridgeIp = storage.getItem('hue_bridge_ip') || ''
    const key = storage.getItem('hue_username')
    const paired = !!key

    let presets = DEFAULT_PRESETS
    try {
      const stored = storage.getItem('hue_favorite_colors')
      if (stored) presets = JSON.parse(stored)
    } catch (e) { /* the defaults */ }
    const sortedPresets = [...presets].sort(comparePresets)

    let logLines = []
    try { logLines = JSON.parse(storage.getItem(LOG_KEY) || '[]') } catch (e) { logLines = [] }

    return View({ style: { background: C.page, padding: '4px 12px 12px', minHeight: '100vh' } }, [Section({}, [

      // ── Header: the app's wordmark (the icon without its disc) and what the
      // page is for
      View({ style: { marginTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' } }, [
        Image({ src: LOGO_SRC, width: LOGO_SHOWN_WIDTH, height: Math.round(LOGO_SHOWN_WIDTH * LOGO_HEIGHT / LOGO_WIDTH), alt: APP_NAME }),
        note(gettext('SETTINGS_SUBTITLE'), C.textSecondary, { marginTop: '12px' })
      ]),

      // ── Bridge: state, address, key; how to pair while it isn't; clearing
      card([
        title(gettext('BRIDGE_CONFIGURATION')),
        View({ style: { display: 'flex', alignItems: 'center', marginTop: '4px' } }, [
          View({ style: { width: '10px', height: '10px', borderRadius: '5px', background: paired ? C.ok : C.danger, marginRight: '8px' } }, []),
          note(gettext(paired ? 'BRIDGE_CONFIGURED' : 'BRIDGE_NOT_CONFIGURED'), paired ? C.ok : C.danger, { fontWeight: '500' })
        ]),
        TextInput({
          label: gettext('BRIDGE_IP'),
          placeholder: gettext('BRIDGE_IP_PLACEHOLDER'),
          value: bridgeIp,
          onChange: (value) => storage.setItem('hue_bridge_ip', value),
          labelStyle: { fontSize: FONT.label, fontWeight: '600', color: C.text, marginTop: '14px' },
          subStyle: { fontSize: FONT.body, color: C.text }
        }),
        ...(paired ? [
          // A column: in a plain View the two texts ran together on one line
          column([
            label(gettext('BRIDGE_KEY_LABEL')),
            Text({ style: { fontSize: FONT.body, color: C.textSecondary, fontFamily: 'monospace', marginTop: '4px' } }, [maskKey(key)])
          ], { marginTop: '14px' })
        ] : [
          // What a new user needs first: how pairing goes
          View({ style: { marginTop: '14px', padding: '12px', background: C.page, borderRadius: '8px' } }, [
            label(gettext('HELP_TITLE'), { marginBottom: '6px' }),
            note([1, 2, 3, 4, 5].map((n) => gettext(`HELP_STEP_${n}`)).join('\n'), C.textSecondary, { lineHeight: '1.6' })
          ])
        ]),
        confirmAction(storage, CLEAR_CONFIG_CONFIRM_KEY, {
          text: gettext('CLEAR_ALL_CONFIG'),
          question: gettext('CLEAR_ALL_CONFIG_CONFIRM'),
          run: () => {
            storage.removeItem('hue_bridge_ip')
            storage.removeItem('hue_username')
            storage.removeItem('hue_api_version')
            storage.setItem('default_tab', 'ROOMS')
            storage.setItem('hue_show_scenes', 'true')
            storage.setItem('hue_display_order', 'LIGHTS_FIRST')
            storage.setItem('hue_demo_mode', 'false')
            storage.setItem('hue_favorite_colors', JSON.stringify(DEFAULT_PRESETS))
          }
        })
      ]),

      // ── What the watch shows
      card([
        title(gettext('WATCH_DISPLAY')),
        choice(gettext('DEFAULT_TAB'), [
          { label: gettext('ROOMS'), value: 'ROOMS' },
          { label: gettext('ZONES'), value: 'ZONES' }
        ], storage.getItem('default_tab') || DEFAULT_USER_SETTINGS.default_tab,
        (value) => storage.setItem('default_tab', value)),
        choice(gettext('DISPLAY_ORDER'), [
          { label: gettext('LIGHTS_FIRST'), value: 'LIGHTS_FIRST' },
          { label: gettext('SCENES_FIRST'), value: 'SCENES_FIRST' }
        ], storage.getItem('hue_display_order') || DEFAULT_USER_SETTINGS.display_order,
        (value) => storage.setItem('hue_display_order', value)),
        View({ style: { marginTop: '10px' } }, [
          // Unset means shown, as the watch reads it
          Toggle({
            label: gettext('SHOW_SCENES'),
            value: storage.getItem('hue_show_scenes') !== 'false',
            onChange: (value) => storage.setItem('hue_show_scenes', value ? 'true' : 'false')
          })
        ])
      ]),

      // ── Favorite colors: the presets as swatches, and going back to the defaults
      card([
        title(gettext('FAVORITE_COLORS')),
        note(gettext('FAVORITE_COLORS_DESC')),
        View({ style: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px', padding: '12px', background: C.page, borderRadius: '8px' } },
          sortedPresets.map((preset) => View({
            style: {
              width: '44px', height: '44px',
              background: preset.hex,
              borderRadius: preset.type === PRESET_TYPES.COLOR ? '22px' : '8px',
              border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: FONT.caption, color: '#555'
            }
          }, [preset.type === PRESET_TYPES.WHITE ? `${Math.round((preset.bri / 254) * 100)}%` : '']))
        ),
        note(`${gettext('CURRENT_PRESETS')} ${presets.length}`, C.textSecondary, { fontSize: FONT.caption, marginTop: '8px' }),
        confirmAction(storage, RESET_PRESETS_CONFIRM_KEY, {
          text: gettext('RESET_PRESETS'),
          question: gettext('RESET_PRESETS_CONFIRM'),
          run: () => storage.setItem('hue_favorite_colors', JSON.stringify(DEFAULT_PRESETS))
        })
      ]),

      // ── Demo mode: the app without a bridge
      // (the switch's own label is the card's title: a title above repeated it)
      card([
        Toggle({
          label: gettext('DEMO_MODE'),
          value: storage.getItem('hue_demo_mode') === 'true',
          onChange: (value) => storage.setItem('hue_demo_mode', value ? 'true' : 'false')
        }),
        note(gettext('DEMO_MODE_DESC'), C.textSecondary, { marginTop: '4px' })
      ]),

      // ── Logs (shared rule, ../_shared/zeppos-ai-doc/logging.md): the latest
      // watch ([w]) and phone lines, already scrubbed by the side service. A
      // multi-line TextInput because a Text can't be selected; its changes
      // are ignored. Each log write rebuilds this page while it is open. Not
      // built in public releases (config.js LOG_LEVEL 'off')
      ...(logsEnabled() ? [card([
        title(`${gettext('LOGS_TITLE')} (${logLines.length})`),
        note(gettext(logLines.length ? 'LOGS_HINT' : 'LOGS_EMPTY')),
        ...(logLines.length ? [
          TextInput({
            label: gettext('LOGS_COPY'),
            value: logLines.join('\n'),
            multiline: true,
            rows: 8,
            labelStyle: { fontSize: FONT.caption, color: C.textSecondary, marginTop: '12px' },
            subStyle: { fontSize: FONT.mono, fontFamily: 'monospace', color: '#000', whiteSpace: 'pre-wrap', maxHeight: '240px', overflow: 'hidden' },
            onChange: () => {} // read-only: the box is there to be copied
          }),
          column([button(gettext('LOGS_CLEAR'), 'control', () => storage.removeItem(LOG_KEY))], { marginTop: '12px' })
        ] : [])
      ])] : []),

      // ── Footer
      View({ style: { marginTop: '24px', marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' } }, [
        Link({ source: 'https://github.com/giovaboy/ZeppOS-zhue' }, [
          Text({ style: { fontSize: FONT.caption, color: C.textSecondary } }, [`${APP_NAME} v${APP_VERSION}`])
        ]),
        Text({ style: { fontSize: FONT.caption, color: C.textSecondary, marginTop: '4px' } }, [gettext('MADE_WITH_LOVE')])
      ])
    ])])
  }
})
