import { gettext } from 'i18n'
import { DEFAULT_PRESETS, PRESET_TYPES, DEFAULT_USER_SETTINGS } from '../utils/constants'
import { LOG_KEY } from '../app-side/log.js'
import { logsEnabled } from '../config.js'
//import { getPackageInfo } from '@zos/app'

//const packageInfo = getPackageInfo()

// Keep in step with app.json version.name (the settings page can't import
// @zos/app to read it)
const APP_VERSION = "1.0.1"
const APP_NAME = "zhue"

// Destructive actions take two taps, as in zeppamp's settings page: the first
// stores a confirm key (the page is built again), then the question in red
// with the action and Cancel side by side. Keys starting with 'ui_' belong to
// this page only (the side service ignores them)
const RESET_PRESETS_CONFIRM_KEY = 'ui_reset_presets_confirm'
const CLEAR_CONFIG_CONFIRM_KEY = 'ui_clear_config_confirm'
const DANGER = '#db2c2c'

// A Button is as wide as its label: alone in a flex column it takes the
// card's width (app-settings-ui-components.md, "Observed rendering")
function actionButton(label, kind, onClick, extra = {}) {
  return Button({
    label,
    onClick,
    style: kind === 'danger'
      ? { fontSize: '15px', fontWeight: '500', borderRadius: '24px', background: DANGER, color: 'white', ...extra }
      : { fontSize: '15px', fontWeight: '500', borderRadius: '24px', background: '#e9ecef', color: '#333', ...extra }
  })
}

function confirmAction(storage, key, { label, question, run }) {
  const column = (children) => View({ style: { display: 'flex', flexDirection: 'column', marginTop: '12px' } }, children)
  if (storage.getItem(key) !== '1') {
    return column([actionButton(label, 'danger', () => storage.setItem(key, '1'))])
  }
  return column([
    Text({ paragraph: true, style: { fontSize: '14px', fontWeight: '600', color: DANGER, marginBottom: '10px' } }, [question]),
    View({ style: { display: 'flex' } }, [
      View({ style: { flex: 1 } }, [actionButton(label, 'danger', () => { storage.removeItem(key); run() }, { width: '100%' })]),
      View({ style: { flex: 1, marginLeft: '12px' } }, [actionButton(gettext('CANCEL'), 'control', () => storage.removeItem(key), { width: '100%' })])
    ])
  ])
}

// A choice among a few options, as in zeppamp's settings page: one button per
// option side by side, the chosen one in the app's purple. A Select can't be
// styled and doesn't show the choice in its closed state
// (app-settings-ui-components.md, "Observed rendering")
const ACCENT = '#984ce5' // the watch's active tab (COLORS.activeTab)
function choice(title, options, chosen, onPick) {
  return View({ style: { marginTop: '16px', marginBottom: '8px' } }, [
    Text({ style: { fontSize: '14px', fontWeight: '600', color: '#333' } }, [title]),
    View({ style: { display: 'flex', marginTop: '8px' } }, options.map((o, i) =>
      View({ style: { flex: 1, marginLeft: i ? '8px' : '0' } }, [
        Button({
          label: o.label,
          onClick: () => { if (o.value !== chosen) onPick(o.value) },
          style: {
            width: '100%', fontSize: '14px', fontWeight: '500', borderRadius: '24px',
            background: o.value === chosen ? ACCENT : '#e9ecef',
            color: o.value === chosen ? 'white' : '#333'
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

// Logs box (shared rule, ../_shared/zeppos-ai-doc/logging.md): the latest
// watch ([w]) and phone lines, already scrubbed by the side service. A
// multi-line TextInput because a Text can't be selected; its changes are
// ignored. Each log write rebuilds this page while it is open. Not built in
// public releases (config.js LOG_LEVEL 'off').
function buildLogsCard(settingsStorage) {
  let lines = []
  try { lines = JSON.parse(settingsStorage.getItem(LOG_KEY) || '[]') } catch (e) { lines = [] }
  return View(
    {
      style: {
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }
    },
    [
      Text(
        { style: { fontSize: '18px', fontWeight: '600', color: '#333', marginBottom: '10px' } },
        [`${gettext('LOGS_TITLE')} (${lines.length})`]
      ),
      Text(
        { paragraph: true, style: { fontSize: '13px', color: '#6c757d', marginBottom: '10px' } },
        [gettext(lines.length ? 'LOGS_HINT' : 'LOGS_EMPTY')]
      ),
      ...(lines.length ? [
        TextInput({
          label: gettext('LOGS_COPY'),
          value: lines.join('\n'),
          multiline: true,
          rows: 8,
          labelStyle: { fontSize: '12px', color: '#6c757d' },
          subStyle: { fontSize: '11px', fontFamily: 'monospace', color: '#000', whiteSpace: 'pre-wrap', maxHeight: '240px', overflow: 'hidden' },
          onChange: () => {}   // read-only: the box is there to be copied
        }),
        View({ style: { display: 'flex', justifyContent: 'center', marginTop: '10px' } }, [
          Button({
            label: gettext('LOGS_CLEAR'),
            style: { fontSize: '13px', fontWeight: '500', borderRadius: '30px', background: '#6c757d', color: 'white', padding: '4px 22px' },
            onClick: () => settingsStorage.removeItem(LOG_KEY)
          })
        ])
      ] : [])
    ]
  )
}

function getPresetTypePriority(type) {
  switch (type) {
    case PRESET_TYPES.WHITE:
      return 1
    case PRESET_TYPES.CT:
      return 2
    case PRESET_TYPES.COLOR:
      return 3
    default:
      return 99
  }
}

function comparePresets(a, b) {
  const priorityA = getPresetTypePriority(a.type)
  const priorityB = getPresetTypePriority(b.type)
  if (priorityA !== priorityB) return priorityA - priorityB
  if (a.type === PRESET_TYPES.WHITE) return a.bri - b.bri
  if (a.type === PRESET_TYPES.CT) return a.ct - b.ct
  if (a.type === PRESET_TYPES.COLOR) return a.hue - b.hue
  return 0
}

AppSettingsPage({
  build(props) {
    return Section({}, [
      // ===== HEADER =====
      View(
        {
          style: {
            marginTop: '20px',
            //marginBottom: '30px',
            textAlign: 'center',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          },
        },
        [
          Text(
            {
              style: {
                fontSize: '36px',
                fontWeight: 'bold',
                color: '#333',
                marginBottom: '10px'
              }
            },
            ['🎨 ' + `${APP_NAME}`]
          )
        ]),

      // ===== SUBTITLE =====
      View(
        {
          style: {
            //marginTop: '20px',
            //marginBottom: '30px',
            textAlign: 'center',
            //padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          },
        },
        [
          Text(
            {
              style: {
                fontSize: '14px',
                color: '#666'
              }
            },
            [gettext('SETTINGS_SUBTITLE')]
          )
        ]
      ),

      // ===== BRIDGE CONFIGURATION SECTION =====
      View(
        {
          style: {
            marginTop: '20px',
            padding: '20px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          },
        },
        [
          Text(
            {
              style: {
                fontSize: '18px',
                fontWeight: '600',
                color: '#333',
                marginBottom: '15px'
              }
            },
            [gettext('BRIDGE_CONFIGURATION')]
          ),

          // Bridge IP Input
          TextInput({
            label: gettext('BRIDGE_IP'),
            placeholder: gettext('BRIDGE_IP_PLACEHOLDER'),
            value: props.settingsStorage.getItem('hue_bridge_ip') || '',
            onChange: (value) => {
              props.settingsStorage.setItem('hue_bridge_ip', value)
            },
            labelStyle: {
              marginTop: '20px',
              marginBottom: '5px',
              marginLeft: '5px'
            },
            subStyle: {
              marginLeft: '5px',
              marginRight: '5px'
            }
          }),

          // Username (Read-only display)
          View(
            {
              style: {
                marginTop: '15px',
                marginLeft: '5px',
                marginRight: '5px',
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                border: '1px solid #dee2e6'
              }
            },
            [
              Text(
                {
                  style: {
                    fontSize: '12px',
                    color: '#6c757d',
                    marginBottom: '5px'
                  }
                },
                [gettext('USERNAME_LABEL')]
              ),
              Text(
                {
                  paragraph: true,
                  style: {
                    fontSize: '14px',
                    color: '#495057',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all'
                  }
                },
                [maskKey(props.settingsStorage.getItem('hue_username')) || gettext('NOT_CONFIGURED')]
              )
            ]
          ),

          // API Version Display
          View(
            {
              style: {
                marginTop: '15px',
                marginLeft: '5px',
                marginRight: '5px',
                padding: '12px',
                backgroundColor: '#e7f3ff',
                borderRadius: '6px',
                border: '1px solid #bee5eb'
              }
            },
            [
              Text(
                {
                  style: {
                    fontSize: '12px',
                    color: '#0c5460',
                    marginBottom: '5px'
                  }
                },
                [gettext('API_VERSION_LABEL')]
              ),
              Text(
                {
                  style: {
                    fontSize: '14px',
                    color: '#004085',
                    fontWeight: '600'
                  }
                },
                [props.settingsStorage.getItem('hue_api_version') || 'v1']
              )
            ]
          )
        ]
      ),

      // ===== CONNECTION STATUS SECTION =====
      View(
        {
          style: {
            marginTop: '20px',
            padding: '20px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          },
        },
        [
          Text(
            {
              style: {
                fontSize: '18px',
                fontWeight: '600',
                color: '#333',
                marginBottom: '15px'
              }
            },
            [gettext('CONNECTION_STATUS')]
          ),

          View(
            {
              style: {
                display: 'flex',
                marginTop: '20px',
                marginLeft: '5px',
                marginRight: '5px',
                alignItems: 'center',
                padding: '12px',
                backgroundColor: props.settingsStorage.getItem('hue_username') ? '#d4edda' : '#f8d7da',
                borderRadius: '6px',
                border: props.settingsStorage.getItem('hue_username') ? '1px solid #c3e6cb' : '1px solid #f5c6cb'
              }
            },
            [
              Text(
                {
                  style: {
                    fontSize: '20px',
                    marginRight: '10px'
                  }
                },
                [props.settingsStorage.getItem('hue_username') ? '✅' : '❌']
              ),
              Text(
                {
                  style: {
                    fontSize: '14px',
                    color: props.settingsStorage.getItem('hue_username') ? '#155724' : '#721c24',
                    fontWeight: '500'
                  }
                },
                [
                  props.settingsStorage.getItem('hue_username') ?
                    gettext('BRIDGE_CONFIGURED') :
                    gettext('BRIDGE_NOT_CONFIGURED')
                ]
              )
            ]
          )
        ]
      ),

      // ===== ADVANCED SETTINGS SECTION =====
      View(
        {
          style: {
            marginTop: '20px',
            padding: '20px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          },
        },
        [
          Text(
            {
              style: {
                fontSize: '18px',
                fontWeight: '600',
                color: '#333',
                marginBottom: '15px'
              }
            },
            [gettext('ADVANCED_SETTINGS')]
          ),

          // Manual API Version Override
          /*View(
            {
              style: {
                marginBottom: '15px'
              }
            },
            [
              Text(
                {
                  style: {
                    fontSize: '14px',
                    color: '#6c757d',
                    marginBottom: '8px'
                  }
                },
                ['Force API Version (leave empty for auto):']
              ),
              TextInput({
                label: 'API Version',
                placeholder: 'v1 or v2',
                value: props.settingsStorage.getItem('hue_api_version_override') || '',
                onChange: (value) => {
                  props.settingsStorage.setItem('hue_api_version_override', value)
                }
              })
            ]
          ),*/
          // Show global toggle
          View(
            {
              style: {
                //marginBottom: '15px',
                marginTop: '20px',
                marginLeft: '5px',
                marginRight: '5px',
              }
            },
            [
              /*Toggle({
                label: 'Show global toggle',
                value: props.settingsStorage.getItem('hue_show_global_toggle') === 'true',
                onChange: (value) => {
                  props.settingsStorage.setItem('hue_show_global_toggle', value ? 'true' : 'false')
                }
              }),*/
              // Default tab
              choice(gettext('DEFAULT_TAB'), [
                { label: gettext('ROOMS'), value: 'ROOMS' },
                { label: gettext('ZONES'), value: 'ZONES' }
              ], props.settingsStorage.getItem('default_tab') || DEFAULT_USER_SETTINGS.default_tab,
              (value) => props.settingsStorage.setItem('default_tab', value)),

              // Show scenes (unset means shown, as the watch reads it)
              Toggle({
                label: gettext('SHOW_SCENES'),
                value: props.settingsStorage.getItem('hue_show_scenes') !== 'false',
                onChange: (value) => {
                  props.settingsStorage.setItem('hue_show_scenes', value ? 'true' : 'false')
                }
              }),

              // Display Order
              choice(gettext('DISPLAY_ORDER'), [
                { label: gettext('LIGHTS_FIRST'), value: 'LIGHTS_FIRST' },
                { label: gettext('SCENES_FIRST'), value: 'SCENES_FIRST' }
              ], props.settingsStorage.getItem('hue_display_order') || DEFAULT_USER_SETTINGS.display_order,
              (value) => props.settingsStorage.setItem('hue_display_order', value)),

              // Debug Mode Toggle
              Toggle({
                label: '🐛 ' + gettext('DEMO_MODE'),
                //settingsKey: 'hue_demo_mode',
                value: props.settingsStorage.getItem('hue_demo_mode') === 'true',
                onChange: (value) => {
                  props.settingsStorage.setItem('hue_demo_mode', value ? 'true' : 'false')
                }
              })
            ])
        ]
      ),

      // ===== FAVORITE COLORS SECTION =====
      View(
        {
          style: {
            marginTop: '20px',
            padding: '20px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          },
        },
        [
          Text(
            {
              style: {
                fontSize: '18px',
                fontWeight: '600',
                color: '#333',
                marginBottom: '15px'
              }
            },
            ['🎨 ' + gettext('FAVORITE_COLORS')]
          ),

          Text(
            {
              paragraph: true,
              style: {
                fontSize: '14px',
                color: '#6c757d',
                marginBottom: '15px'
              }
            },
            [gettext('FAVORITE_COLORS_DESC')]
          ),

          // Display current presets
          View(
            {
              style: {
                display: 'flex',
                marginTop: '20px',
                marginLeft: '5px',
                marginRight: '5px',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '15px',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px'
              }
            },
            (() => {
              const favColorsStr = props.settingsStorage.getItem('hue_favorite_colors')
              let colors = DEFAULT_PRESETS

              if (favColorsStr) {
                try {
                  colors = [...JSON.parse(favColorsStr)].sort(comparePresets)
                } catch (e) {
                  console.error('Failed to parse favorite colors')
                }
              }

              return colors.map((color, i) =>
                View(
                  {
                    style: {
                      width: '50px',
                      height: '50px',
                      backgroundColor: color.hex,
                      borderRadius: color.type === PRESET_TYPES.COLOR ? '25px' : '8px',
                      border: '2px solid #dee2e6',
                      cursor: 'pointer',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    },
                    title: color.name || color.hex
                  },
                  [color.type === PRESET_TYPES.WHITE ? `${Math.round((color.bri / 254) * 100)}%` : '']
                )
              )
            })()
          ),

          Text(
            {
              style: {
                fontSize: '12px',
                color: '#6c757d',
                marginBottom: '10px'
              }
            },
            [gettext('CURRENT_PRESETS') + ` ${(() => {
              const favColorsStr = props.settingsStorage.getItem('hue_favorite_colors')
              if (favColorsStr) {
                try {
                  return JSON.parse(favColorsStr).length
                } catch (e) {
                  return DEFAULT_PRESETS.length
                }
              }
              return DEFAULT_PRESETS.length
            })()}`]
          ),

          confirmAction(props.settingsStorage, RESET_PRESETS_CONFIRM_KEY, {
            label: '🔄 ' + gettext('RESET_PRESETS'),
            question: gettext('RESET_PRESETS_CONFIRM'),
            run: () => {
              props.settingsStorage.setItem('hue_favorite_colors', JSON.stringify(DEFAULT_PRESETS))
            }
          })


        ]
      ),

      // ===== ACTIONS SECTION =====
      View(
        {
          style: {
            marginTop: '20px',
            padding: '20px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          },
        },
        [
          Text(
            {
              style: {
                fontSize: '18px',
                fontWeight: '600',
                color: '#333',
                marginBottom: '15px'
              }
            },
            [gettext('ACTIONS')]
          ),

          // Clear Configuration Button
          confirmAction(props.settingsStorage, CLEAR_CONFIG_CONFIRM_KEY, {
            label: '🗑️ ' + gettext('CLEAR_ALL_CONFIG'),
            question: gettext('CLEAR_ALL_CONFIG_CONFIRM'),
            run: () => {
              props.settingsStorage.removeItem('hue_bridge_ip')
              props.settingsStorage.removeItem('hue_username')
              props.settingsStorage.removeItem('hue_api_version')
              props.settingsStorage.setItem('default_tab', 'ROOMS')
              props.settingsStorage.setItem('hue_show_scenes', 'true')
              props.settingsStorage.setItem('hue_display_order', 'LIGHTS_FIRST')
              props.settingsStorage.setItem('hue_demo_mode', 'false')
              props.settingsStorage.setItem('hue_favorite_colors', JSON.stringify(DEFAULT_PRESETS))
            }
          })




        ]
      ),


      // ===== HELP SECTION =====
      View(
        {
          style: {
            marginTop: '20px',
            marginBottom: '40px',
            padding: '20px',
            backgroundColor: '#fff3cd',
            borderRadius: '8px',
            border: '1px solid #ffeaa7'
          },
        },
        [
          Text(
            {
              style: {
                fontSize: '16px',
                fontWeight: '600',
                color: '#856404',
                marginBottom: '10px'
              }
            },
            ['💡 ' + gettext('HELP_TITLE')]
          ),
          Text(
            {
              paragraph: true,
              style: {
                fontSize: '14px',
                color: '#856404',
                lineHeight: '1.6'
              }
            },
            [
              gettext('HELP_STEP_1') + '\n' +
              gettext('HELP_STEP_2') + '\n' +
              gettext('HELP_STEP_3') + '\n' +
              gettext('HELP_STEP_4') + '\n' +
              gettext('HELP_STEP_5')
            ]
          )
        ]
      ),

      // ===== LOGS (test builds only) =====
      ...(logsEnabled() ? [buildLogsCard(props.settingsStorage)] : []),

      // ===== FOOTER =====
      View(
        {
          style: {
            marginTop: '30px',
            marginBottom: '20px',
            textAlign: 'center',
            padding: '15px',
            borderTop: '1px solid #dee2e6'
          },
        },
        [
          Link(
            {
              source: 'https://github.com/giovaboy/ZeppOS-zhue',
              style: {
                fontSize: '12px',
                color: '#6c757d'
              }
            },
            [`${APP_NAME} v${APP_VERSION}`]
          ),
          Text(
            {
              style: {
                fontSize: '16px',
                color: '#adb5bd',
                marginTop: '5px'
              }
            },
            [' | ' + gettext('MADE_WITH_LOVE')]
          )
        ]
      )
    ])
  },
})