import { gettext } from 'i18n'
import { DEFAULT_PRESETS, PRESET_TYPES } from '../utils/constants' 

AppSettingsPage({
  build(props) {
    return Section({}, [
      // ===== HEADER =====
      View(
        {
          style: {
            marginTop: '20px',
            marginBottom: '30px',
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
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#333',
                marginBottom: '10px'
              }
            },
            ['🏠 Hue Bridge Settings']
          ),
          Text(
            {
              style: {
                fontSize: '14px',
                color: '#666'
              }
            },
            [gettext('SETTINGS_SUBTITLE') || 'Configure your Philips Hue Bridge connection']
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
            ['Bridge Configuration']
          ),

          // Bridge IP Input
          TextInput({
            label: gettext('BRIDGE_IP') || 'Bridge IP Address',
            placeholder: 'e.g. 192.168.1.132',
            value: props.settingsStorage.getItem('hue_bridge_ip') || '',
            onChange: (value) => {
              props.settingsStorage.setItem('hue_bridge_ip', value)
            },
            style: {
              marginBottom: '15px'
            }
          }),

          // Username (Read-only display)
          View(
            {
              style: {
                marginTop: '15px',
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
                ['Username (Auto-generated):']
              ),
              Text(
                {
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
                ['API Version: ']
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
            ['Connection Status']
          ),

          View(
            {
              style: {
                display: 'flex',
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
                  props.settingsStorage.getItem('hue_username')
                    ? 'Bridge is configured and paired'
                    : 'Bridge not configured. Use the app to pair.'
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
            ['Advanced Settings']
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
          Toggle({
            label: 'Show global toggle',
            value: props.settingsStorage.getItem('hue_show_global_toggle') === 'true',
            onChange: (value) => {
              props.settingsStorage.setItem('hue_show_global_toggle', value ? 'true' : 'false')
            }
          }),
          // Show scenes
          Toggle({
            label: 'Show Scenes',
            value: props.settingsStorage.getItem('hue_show_scenes') === 'true',
            onChange: (value) => {
              props.settingsStorage.setItem('hue_show_scenes', value ? 'true' : 'false')
            }
          }),

          // Display Order
          Select({
            title: 'Display Order',
            options: [{ name: 'Light first', value: 'LIGHTS_FIRST' },
                      { name: 'Scenes first', value: 'SCENES_FIRST' }],
            value: props.settingsStorage.getItem('hue_display_order'),
            onChange: (value) => {
              props.settingsStorage.setItem('hue_display_order', value )
            }
          }),

          // Debug Mode Toggle
          Toggle({
            label: '🐛 DEMO Mode',
            //settingsKey: 'hue_demo_mode',
            value: props.settingsStorage.getItem('hue_demo_mode') === 'true',
            onChange: (value) => {
              props.settingsStorage.setItem('hue_demo_mode', value ? 'true' : 'false')
            }
          })
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
            ['🎨 Favorite Colors']
          ),

          Text(
            {
              style: {
                fontSize: '14px',
                color: '#6c757d',
                marginBottom: '15px'
              }
            },
            ['Manage your favorite color presets. You can add colors from the light detail page on your watch.']
          ),

          // Display current presets
          View(
            {
              style: {
                display: 'flex',
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
                  colors = JSON.parse(favColorsStr)
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
            [`Current presets: ${(() => {
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

          Button({
            label: '🔄 Reset to Default Presets',
            color: 'secondary',
            style: {
              width: '100%'
            },
            onClick: () => {
              //if (confirm('Reset favorite colors to default presets?')) {
                props.settingsStorage.setItem('hue_favorite_colors', JSON.stringify(DEFAULT_PRESETS))
                //alert('✅ Favorite colors reset to defaults!')
                //window.location.reload()
              //}
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
            ['Actions']
          ),

          // Test Connection Button
          /*Button({
            label: '🔄 Test Connection',
            color: 'primary',
            style: {
              marginBottom: '10px',
              width: '100%'
            },
            onClick: () => {
              const bridgeIp = props.settingsStorage.getItem('hue_bridge_ip')
              const username = props.settingsStorage.getItem('hue_username')

              if (!bridgeIp || !username) {
                alert('⚠️ Bridge not configured. Please pair using the watch app first.')
                return
              }

              alert('Testing connection to ' + bridgeIp + '...\n\n(Feature coming soon)')
            },
          }),*/

          // Clear Configuration Button
          Button({
            label: '🗑️ Clear All Configuration',
            color: 'secondary',
            style: {
              width: '100%'
            },
            onClick: () => {
              if (confirm('Are you sure you want to clear all Hue Bridge configuration?\n\nYou will need to pair again.')) {
                props.settingsStorage.removeItem('hue_bridge_ip')
                props.settingsStorage.removeItem('hue_username')
                props.settingsStorage.removeItem('hue_api_version')
                alert('✅ Configuration cleared successfully!')
                window.location.reload()
              }
            },
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
            ['💡 How to Pair Your Bridge']
          ),
          Text(
            {
              style: {
                fontSize: '14px',
                color: '#856404',
                lineHeight: '1.6'
              }
            },
            [
              '1. Open the Hue app on your watch\n' +
              '2. The app will automatically search for your bridge\n' +
              '3. Press the physical button on your Hue Bridge\n' +
              '4. Wait for the pairing to complete\n' +
              '5. Your configuration will be saved automatically'
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
            ['Hue On-Off App v1.0']
          ),
          Text(
            {
              style: {
                fontSize: '11px',
                color: '#adb5bd',
                marginTop: '5px'
              }
            },
            ['Made with ❤️ for Zepp OS']
          )
        ]
      )
    ])
  },
})