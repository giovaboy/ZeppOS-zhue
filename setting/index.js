import { gettext } from 'i18n'

// Definiamo le opzioni per il selettore di ordine di visualizzazione
const DISPLAY_ORDER_OPTIONS = [
  { value: 'LIGHTS_FIRST', name: gettext('ORDER_LIGHTS_FIRST') },
  { value: 'GROUPS_FIRST', name: gettext('ORDER_GROUPS_FIRST') },
  { value: 'ALPHABETICAL', name: gettext('ORDER_ALPHABETICAL') },
]

// Funzione di utilità per leggere un toggle (da 'true'/'false' stringa a booleano)
const getToggleValue = (storage, key, defaultValue) => {
  const value = storage.getItem(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}

// Funzione di utilità per leggere un Select
const getSelectValue = (storage, key, defaultValue) => {
    return storage.getItem(key) || defaultValue;
}

AppSettingsPage({
  build(props) {
    const settingsStorage = props.settingsStorage;
    
    // --- 1. Configurazione del bridge ---
    const bridgeConfigSection = Section({ title: gettext('BRIDGE_CONFIG_TITLE') }, [
      
      // Input IP
      TextInput({
        label: gettext('BRIDGE_IP'),
        value: settingsStorage.getItem('hue_bridge_ip') || '',
        onChange: (value) => settingsStorage.setItem('hue_bridge_ip', value),
        placeholder: '192.168.x.x',
      }),
      
      // Input API Version
      TextInput({
        label: gettext('API_VERSION'),
        value: settingsStorage.getItem('hue_api_version') || 'v2',
        onChange: (value) => settingsStorage.setItem('hue_api_version', value),
        placeholder: 'v2',
      }),

      // Mostra Username (API Key)
      Text({
        label: gettext('USERNAME_LABEL'),
        subStyle: { color: '#666666', wordBreak: 'break-all', marginTop: '10px' }
      }, [settingsStorage.getItem('hue_username') || gettext('USERNAME_NOT_SET')]),

      // Bottone per l'accoppiamento (ipotetico)
      /*Button({
        label: gettext('PAIR_BRIDGE'),
        color: 'primary',
        subStyle: { marginTop: '10px' },
        onClick: () => {
          // L'accoppiamento è un processo complesso, qui mostriamo solo il concetto
          alert(gettext('PAIRING_INSTRUCTIONS'));
        }
      })*/
    ]);

    // --- 2. Preferenze Utente (I settings che volevi) ---
    const userPreferencesSection = Section({ title: gettext('USER_PREFERENCES_TITLE') }, [
      
      // show_global_toggle (Default: true)
      Toggle({
        label: gettext('SHOW_GLOBAL_TOGGLE_LABEL'),
        value: getToggleValue(settingsStorage, 'show_global_toggle', true),
        onChange: (value) => settingsStorage.setItem('show_global_toggle', value ? 'true' : 'false')
      }),

      // show_scenes (Default: false)
      Toggle({
        label: gettext('SHOW_SCENES_LABEL'),
        value: getToggleValue(settingsStorage, 'show_scenes', false),
        onChange: (value) => settingsStorage.setItem('show_scenes', value ? 'true' : 'false')
      }),

      // display_order (Default: 'LIGHTS_FIRST')
      Select({
        label: gettext('DISPLAY_ORDER_LABEL'),
        options: DISPLAY_ORDER_OPTIONS,
        value: getSelectValue(settingsStorage, 'display_order', 'LIGHTS_FIRST'),
        onChange: (value) => settingsStorage.setItem('display_order', value)
      })
    ]);
    
    // --- 3. Colori Preferiti (Sezione Placeholder) ---
    const favoriteColorsSection = Section({ title: gettext('FAVORITE_COLORS_TITLE') }, [
      Text({ subStyle: { textAlign: 'center' } }, [gettext('FAVORITE_COLORS_INSTRUCTIONS')]),
      // Qui in un'app completa si implementerebbe un modo per aggiungere/modificare colori
    ]);

    // --- 4. Manutenzione ---
    const maintenanceSection = Section({ title: gettext('MAINTENANCE_TITLE') }, [
      // Clear Data Button
      Button({
        label: gettext('CLEAR_DATA'),
        color: 'danger',
        subStyle: { marginTop: '5px' },
        onClick: () => {
          // Si dovrebbe usare un Dialog di conferma in produzione
          if (confirm(gettext('CONFIRM_CLEAR_DATA'))) {
            settingsStorage.clear();
            alert(gettext('DATA_CLEARED'));
          }
        },
      }),

      // Welcome Text (come nota a piè di pagina)
      Text({
        subStyle: { marginTop: '15px', textAlign: 'center' }
      }, [gettext('WELCOME_TEXT')])
    ]);


    // Ritorna tutte le sezioni avvolte in un'unica Section radice (implicita)
    return Section({}, [
        bridgeConfigSection,
        userPreferencesSection,
        favoriteColorsSection,
        maintenanceSection
    ])
  },
})