
export const COLORS = {
  background: 0x000000,
  text: 0xffffff,
  textSubtitle: 0xaaaaaa,
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
  loading: 0x666666,
  roomIndicator: 0x0000cc,
  zoneIndicator: 0x009900,
  lightBg: 0x1a1a1a,
  sceneBg: 0x0a2540,
  toggleOn: 0x00aa00,
  toggleOff: 0x444444,
  sectionHeader: 0x0088ff,
  sliderBg: 0x2a2a2a,
  sliderFill: 0xffffff,
  briText: 0xcccccc,
  defaultSwatchColor: 0xFFCC66
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

export const PRESET_TYPES = {
  COLOR: 'COLOR',    // Preset che usano HUE e SAT (per luci colorate)
  CT: 'CT',          // Preset che usano CT (per luci CT o colorate)
  WHITE: 'WHITE'     // Preset che usano solo BRI (compatibili con tutte)
};

export const DEFAULT_PRESETS = [
  { id: '1', hex: '#FFA500', bri: 200, hue: 8000, sat: 200, type: PRESET_TYPES.COLOR },
  { id: '2', hex: '#87CEEB', bri: 220, hue: 32000, sat: 150, type: PRESET_TYPES.COLOR },
  { id: '3', hex: '#FF6B6B', bri: 180, hue: 0, sat: 254, type: PRESET_TYPES.COLOR },
  { id: '4', hex: '#CCDDFF', bri: 254, ct: 153, type: PRESET_TYPES.CT },
  { id: '5', hex: '#FFB044', bri: 254, ct: 500, type: PRESET_TYPES.CT },
  { id: '6', hex: '#4A148C', bri: 100, hue: 48000, sat: 254, type: PRESET_TYPES.COLOR },
  { id: '7', hex: '#FFFFFF', bri: 50, type: PRESET_TYPES.WHITE }
];

// Utility HSB to Hex (Visuale)
export function hsb2hex(h, s, v) {
  if (s === 0) {
    const val = Math.round(v * 2.55)
    return val << 16 | val << 8 | val;
  }
  h /= 60; s /= 100; v /= 100;
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  const toInt = (c) => Math.round(c * 255);
  return (toInt(r) << 16) + (toInt(g) << 8) + toInt(b);
}

function calculateCtRgb(mireds) {
  // 153 (Freddo) -> 500 (Caldo)
  const MIN_CT = 153;
  const MAX_CT = 500;

  // Normalizza la percentuale tra 0 (freddo) e 1 (caldo)
  const pct = Math.max(0, Math.min(1, (mireds - MIN_CT) / (MAX_CT - MIN_CT)));

  // Cold: 0xCCDDFF (RGB 204, 221, 255), Warm: 0xFFB044 (RGB 255, 176, 68)
  // Interpolazione:
  // R: 204 -> 255
  const r = 204 + (255 - 204) * pct;
  // G: 221 -> 176
  const g = 221 + (176 - 221) * pct;
  // B: 255 -> 68
  const b = 255 + (68 - 255) * pct;

  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b)
  };
}


// Utility CT (Mireds) to Hex approssimativo per visualizzazione
export function ct2hex(mireds) {
  const { r, g, b } = calculateCtRgb(mireds);
  // Costruisce l'intero: (R << 16) + (G << 8) + B
  return (r << 16) + (g << 8) + b;
}



export function ct2hexString(mireds) {
  const { r, g, b } = calculateCtRgb(mireds);

  // Funzione helper per convertire un componente in HEX a due cifre
  const componentToHex = (c) => {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
}


// Funzione per normalizzare HEX: aggiunge # se manca
export const normalizeHex = (hex) => {
  if (!hex) return '#FFFFFF'; // Fallback se è nullo
  if (hex.startsWith('#')) return hex;
  return `#${hex}`;
};