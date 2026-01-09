import { gettext } from 'i18n'
import { DEFAULT_PRESETS, PRESET_TYPES } from '../utils/constants'
import appJson from '../app.json'  // ← Aggiungi questo

const APP_VERSION = appJson.app.version.name  // "1.0.0"
const APP_NAME = appJson.app.appName          // "zhue"

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
            ['🎨 zhue']
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
                ['Username:']
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
                [props.settingsStorage.getItem('hue_username') || 'Not configured yet']
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
              Select({
                title: gettext('DEFAULT_TAB'),
                options: [{ name: 'ROOMS', value: 'ROOMS' },
                { name: 'ZONES', value: 'ZONES' }
                ],
                value: props.settingsStorage.getItem('default_tab'),
                onChange: (value) => {
                  props.settingsStorage.setItem('default_tab', value)
                }
              }),
              // Show scenes
              Toggle({
                label: gettext('SHOW_SCENES'),
                value: props.settingsStorage.getItem('hue_show_scenes') === 'true',
                onChange: (value) => {
                  props.settingsStorage.setItem('hue_show_scenes', value ? 'true' : 'false')
                }
              }),

              // Display Order
              Select({
                title: gettext('DISPLAY_ORDER'),
                options: [{ name: gettext('LIGHTS_FIRST'), value: 'LIGHTS_FIRST' },
                { name: gettext('SCENES_FIRST'), value: 'SCENES_FIRST' }
                ],
                value: props.settingsStorage.getItem('hue_display_order'),
                selectedValue: props.settingsStorage.getItem('hue_display_order'),
                onChange: (value) => {
                  props.settingsStorage.setItem('hue_display_order', value)
                }
              }),

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
            [gettext('FAVORITE_COLORS_DESCRIPTION')]
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

          View({
            style: {
              //fontSize: '12px',
              //fontWeight: '500',
              lineHeight: '35px',
              borderRadius: '8px',
              background: '#db2c2c',
              color: 'white',
              textAlign: 'left',
              padding: '0 15px',
              //margin: '0 5px 0 0',
            }
          },
            [TextInput({
              label: '🔄 ' + gettext('RESET_PRESETS'),
              labelStyle: { textAlign: 'center' },
              subStyle: { display: 'none' },
              disabled: true,
              placeholder: '🔄 ' + gettext('RESET_PRESETS_CONFIRM'),
              value: undefined,
              onChange: () => {
                props.settingsStorage.setItem('hue_favorite_colors', JSON.stringify(DEFAULT_PRESETS))
              }
            })])


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
          View({
            style: {
              //fontSize: '12px',
              //fontWeight: '500',
              lineHeight: '35px',
              borderRadius: '8px',
              background: '#db2c2c',
              color: 'white',
              textAlign: 'left',
              padding: '0 15px',
              //margin: '0 5px 0 0',
            }
          },
            [TextInput({
              label: '🗑️ ' + gettext('CLEAR_ALL_CONFIG'),
              labelStyle: { textAlign: 'center' },
              subStyle: { display: 'none' },
              disabled: true,
              placeholder: '🗑️ ' + gettext('CLEAR_ALL_CONFIG_CONFIRM'),
              value: undefined,
              onChange: () => {
                props.settingsStorage.removeItem('hue_bridge_ip')
                props.settingsStorage.removeItem('hue_username')
                props.settingsStorage.removeItem('hue_api_version')
              }
            })])




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
          Text(
            {
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
                fontSize: '11px',
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