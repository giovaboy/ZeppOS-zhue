
export const COLORS = {
  background: 0x000000,
  text: 0xffffff,
  highlight: 0x0055ff,
  cardBg: 0x222222,
  activeTab: 0x0055ff,
  activeTabText: 0xffffff,
  inactiveTab: 0x1a1a1a,
  inactiveTabText: 0xAAAAAA,
  warningBg: 0x333300,
  highlightText: 0xffffff,
  warning: 0xff6600,
  warningText: 0xffffff,
  success: 0x00aa00,
  error: 0xff0000,
  inactive: 0x666666,
  roomIndicator: 0x0000cc,
  zoneIndicator: 0x009900
}

// Mappatura completa dei Model ID di Philips Hue
// Lo slug icona viene usato per costruire i percorsi: [icon]_on.png, [icon]_off.png, [icon]_color.png
export const LIGHT_MODELS = {
  // A19 / E27 (Lampadine Standard)
  'LCT001': { name: 'Hue Bulb A19', icon: 'a19_color' }, // Colore Gen 1
  'LCT007': { name: 'Hue Bulb A19', icon: 'a19_color' },
  'LCT015': { name: 'Hue Bulb A19', icon: 'a19_color' }, // Colore Gen 3
  'LCT016': { name: 'Hue Bulb A19', icon: 'a19_color' },
  'LCT024': { name: 'Hue Bulb A19', icon: 'a19_color' }, // Colore Gen 4 (Bluetooth)

  // White Ambiance (Bianco caldo/freddo)
  'LTW001': { name: 'White Ambiance', icon: 'a19_white' },
  'LTW004': { name: 'White Ambiance', icon: 'a19_white' },
  'LWA001': { name: 'White Ambiance', icon: 'a19_white' },

  // White Only (Solo Bianco)
  'LWB001': { name: 'Hue White', icon: 'a19_white' },
  'LWB006': { name: 'E27/B22 White', icon: 'a19_white' },
  'LWB007': { name: 'E27 White', icon: 'a19_white' },
  'LWB010': { name: 'E27 White', icon: 'a19_white' },

  // GU10 (Spot/Faretto)
  'LCT003': { name: 'GU10 Color', icon: 'gu10_color' },
  'LCT010': { name: 'GU10 Color', icon: 'gu10_color' },
  'LCT011': { name: 'GU10 White Amb.', icon: 'gu10_white' },
  'LTW013': { name: 'GU10 White Amb.', icon: 'gu10_white' },

  // BR30 (Spot per incasso)
  'LCT002': { name: 'BR30 Color', icon: 'br30_color' },
  'LCT014': { name: 'BR30 Color', icon: 'br30_color' },

  // LightStrip
  'LST001': { name: 'LightStrip', icon: 'lightstrip' },
  'LST002': { name: 'LightStrip Plus', icon: 'lightstrip' },
  'LCS001': { name: 'LightStrip Plus', icon: 'lightstrip' }, // Altro ID striscia

  // Candela / Luster (Attacco E14)
  'LCT012': { name: 'Candle', icon: 'candle_color' },
  'LCT020': { name: 'Candle', icon: 'candle_color' },
  'LCT022': { name: 'Luster', icon: 'candle_color' },
  'LWE001': { name: 'Candle White', icon: 'candle_white_only' },

  // Filamento (Bulbs decorative)
  'LWF001': { name: 'Filament Bulb', icon: 'filament_a19' },
  'LWF002': { name: 'Filament Candle', icon: 'filament_candle' },

  // Prodotti fissi / da tavolo
  'LLC011': { name: 'Bloom', icon: 'bloom' },
  'LLC012': { name: 'Bloom', icon: 'bloom' },
  'LLC007': { name: 'Aura', icon: 'aura' },
  'LLC006': { name: 'Iris', icon: 'iris' },
  'LLC010': { name: 'Iris', icon: 'iris' },
  'LLC013': { name: 'StoryLight', icon: 'storylight' }, // Lavoro con i riflettori fissi

  // Default - per tutti gli ID sconosciuti
  'default': { name: 'Light', icon: 'a19_white' }
}

export const MESSAGE_KEYS = {
  ID: 0,
  NAME: 1,
  MODELID: 2,
  ISON: 3,
  BRI: 4,
  HUE: 5,
  SAT: 6,
  X: 7,
  Y: 8,
  HEX: 9,
  REACHABLE: 10,
  UPDATE: 11,
  ALL: 12,
  ALL_STATE: 13,
  PAIR: 14,
  ERROR: 15,
  SUCCESS: 16
}
