import { gettext } from 'i18n'

AppSettingsPage({
  build(props) {
    return Section({}, [
      View(
        {
          style: {
            marginTop: '50px',
            textAlign: 'center',
          },
        },
        [Text({}, [gettext('WELCOME_TEXT')])],
      ),

      View(
        {
          style: {
            marginTop: '50px',
            textAlign: 'center',
          },
        },
        [
          Button({
            label: gettext('CLEAR_DATA'),
            // color: 'secondary',
            color: 'default',
            onClick: () => {
              props.settingsStorage.clear()
            },
          })])
      , View(
        {
          style: {
            marginTop: '50px',
            textAlign: 'center',
          },
        },
        [

          TextInput({
            label: gettext('BRIDGE_IP'),
            //subStyle: { display: 'none' },
            value: props.settingsStorage.getItem('hue_bridge_ip') || '',
            onChange: (value) => {
              props.settingsStorage.setItem('hue_bridge_ip', value)
            }
          }),
          TextInput({
            label: gettext('API_VERSION'),
            //subStyle: { display: 'none' },
            value: props.settingsStorage.getItem('hue_api_version') || '',
            onChange: (value) => {
              props.settingsStorage.setItem('hue_api_version', value)
            }
          }),

          Text({}, [props.settingsStorage.getItem('hue_username') || ''])





        ],
      ),

    ])
  },
})
