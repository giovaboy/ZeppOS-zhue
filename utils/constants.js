export const COLORS = {
  background: 0x000000,
  text: 0xffffff,
  textSubtitle: 0xaaaaaa,
  highlight: 0x0055ff,
  cardBg: 0x222222,
  activeTab: 0x984ce5, //0x0055ff,
  activeTabText: 0xffffff,
  inactiveTab: 0x1a1a1a,
  inactiveTabText: 0xAAAAAA,
  warningBg: 0x333300,
  highlightText: 0xffffff,
  warning: 0xff6600,
  warningText: 0xffffff,
  success: 0x39935a, //0x2ecd6e,//0x00aa00,
  error: 0xff0000,
  inactive: 0xb3b3b3, //0x666666,
  loading: 0x666666,
  roomIndicator: 0x0000cc,
  zoneIndicator: 0x009900,
  lightBg: 0x333333, //light background, same color as the light icons mask (#FFFFFF opacity 20%) color_sys_item_bg per zeppos doc
  sceneBg: 0x0a2540,
  toggleOn: 0x00aa00,
  toggleOff: 0x444444,
  sectionHeader: 0x0088ff,
  sliderBg: 0x2a2a2a,
  sliderFill: 0xffffff,
  briText: 0xcccccc,
  defaultSwatchColor: 0xFFCC66,
  white: 0xFFFFFF,
  black: 0x000000,

  color_sys_key: 0x0986d4,
  color_sys_warning: 0xad3c23,
  color_sys_item_bg: 0x333333,
  color_sys_empty_status_graphic: 0x666666,

  color_text_warning: 0xd14221,
  color_text_link: 0x059af7,
  color_text_title: 0xffffff,
  color_text_subtitle: 0xb3b3b3,
  color_text_secondary_info: 0x808080,
  color_text_button: 0xffffff

}

// Range API Hue/Sat/Bri
export const HUE_RANGE = 65535; // 0-65535
export const SAT_RANGE = 254;   // 0-254
export const BRI_RANGE = 254;   // 1-254
export const CT_MIN = 153;      // 153 (6500K)
export const CT_MAX = 500;      // 500 (2000K)

export const DEFAULT_USER_SETTINGS = {
  show_global_toggle: true,
  show_scenes: true,
  display_order: 'LIGHTS_FIRST'
}

export const DEMO_DATA = {
  lights: {
    '1': {
      id: '1',
      name: 'Lampada Soggiorno',
      ison: true,
      bri: 200,
      hue: 46920,
      sat: 254,
      ct: 0,
      colormode: 'hs',
      reachable: true,
      capabilities: ['brightness', 'color'],
      modelid: 'LCT015' // A19 Color Gen 3
    },

    '2': {
      id: '2',
      name: 'Striscia Cucina',
      ison: false,
      bri: 100,
      hue: 0,
      sat: 0,
      ct: 350,
      colormode: 'ct',
      reachable: true,
      capabilities: ['brightness', 'ct'],
      modelid: 'LST001' // LightStrip Gen1
    },

    '3': {
      id: '3',
      name: 'Scrivania',
      ison: true,
      bri: 150,
      hue: 13000,
      sat: 254,
      ct: 0,
      colormode: 'hs',
      reachable: true,
      capabilities: ['brightness', 'color'],
      modelid: 'LCT010' // GU10 Color
    },

    '4': {
      id: '4',
      name: 'Giardino (No Segnale)',
      ison: true,
      bri: 254,
      hue: 0,
      sat: 0,
      ct: 0,
      colormode: 'bri',
      reachable: false,
      capabilities: ['brightness'],
      modelid: 'LWA014' // Inara Outdoor Filament
    },

    '5': {
      id: '5',
      name: 'Calla Pathway',
      ison: true,
      bri: 180,
      hue: 50000,
      sat: 200,
      colormode: 'hs',
      reachable: true,
      capabilities: ['brightness', 'color'],
      modelid: 'LCA007' // Calla Outdoor
    },

    '6': {
      id: '6',
      name: 'Econic Porta',
      ison: false,
      bri: 120,
      ct: 400,
      hue: 0,
      sat: 0,
      colormode: 'ct',
      reachable: true,
      capabilities: ['brightness', 'ct'],
      modelid: 'LWL001' // Econic Wall
    }
  },

  groups: {
    '1': {
      id: '1',
      name: 'Soggiorno',
      type: 'Room',
      lights: ['1', '3'],
      state: { all_on: false, any_on: true }
    },

    '2': {
      id: '2',
      name: 'Casa Intera',
      type: 'Zone',
      lights: ['1', '2', '3', '4', '5', '6'],
      state: { all_on: false, any_on: true }
    },

    '3': {
      id: '3',
      name: 'Esterno',
      type: 'Zone',
      lights: ['4', '5', '6'],
      state: { all_on: false, any_on: true }
    }
  },

  scenes: {
    's1': { id: 's1', name: 'Lettura', group: '1', color: '#6A5ACD' },
    's2': { id: 's2', name: 'Relax', group: '1', color: '#ADD8E6' },
    's3': { id: 's3', name: 'Alba', group: '2', color: '#FFD5A1' },
    's4': { id: 's4', name: 'Notte Giardino', group: '3', color: '#0040FF' },
    's5': { id: 's5', name: 'Accoglienza Porta', group: '3', color: '#FFA500' }
  }
}

// Mappatura completa dei Model ID di Philips Hue
//https://zigbee.blakadder.com/vendors.html
export const LIGHT_MODELS = {
  // --------------------------------------------------------------------------------
  // 🟢 A19 / E27 (Lampadine Standard)
  // --------------------------------------------------------------------------------
  'LCA001': { name: 'Hue Bulb E27 C&W', icon: 'a19' },
  'LCA002': { name: 'Hue Bulb A19 C&W Gen 1', icon: 'a19' },
  'LCA003': { name: 'Hue Bulb A19 C&W Gen 2', icon: 'a19' },
  'LCA004': { name: 'Hue White and Color 800 E27', icon: 'a19' },
  'LCA005': { name: 'Hue White and Color 800 E26', icon: 'a19' },
  'LCA006': { name: 'Hue White and Color 1100 B22', icon: 'a19' },
  'LCA007': { name: 'Hue White and Color 800 E27', icon: 'a19' },
  'LCA008': { name: 'Hue White and Color 1600 E27', icon: 'a19' },
  'LCA009': { name: 'Hue White and Color 1600 E26', icon: 'a19' },

  'LCT007': { name: 'Hue Bulb A19 E26', icon: 'a19' },
  'LCT010': { name: 'Hue Bulb A19 C&W Gen 3', icon: 'a19' },
  'LCT014': { name: 'Hue Bulb A19 C&W Gen 3', icon: 'a19' },
  'LCT015': { name: 'Hue Bulb A19 C&W Gen 3', icon: 'a19' },
  'LCT016': { name: 'Hue Bulb A19 C&W', icon: 'a19' },
  'LCT017': { name: 'Hue Bulb A19 C&W Gen 2 (BT)', icon: 'a19' },
  /*'LCT026': { name: 'Hue Bulb A19 C&W (Filament Color BT)', icon: 'a19' },
  'LCT027': { name: 'Hue Bulb E27 C&W', icon: 'a19' },
  'LCT029': { name: 'Hue Bulb A19 C&W (Matter)', icon: 'a19' },*/


  // White Ambiance
  'LTW001': { name: 'White Ambiance A19', icon: 'a19' },
  'LTW004': { name: 'White Ambiance A19', icon: 'a19' },
  'LWA001': { name: 'White Ambiance A19 (BT)', icon: 'a19' },
  'LWA002': { name: 'White Ambiance A19 (BT)', icon: 'a19' },
  'LWE002': { name: 'White Ambiance E27', icon: 'a19' },

  // White Only
  'LWB001': { name: 'Hue White A19', icon: 'a19' },
  'LWB006': { name: 'E27/B22 White', icon: 'classic' },
  'LWB007': { name: 'E27 White', icon: 'a19' },
  'LWB010': { name: 'E27 White', icon: 'classic' },
  'LWB014': { name: 'Hue White A19 (BT)', icon: 'a19' },
  'LHB001': { name: 'High Lumen E27 White', icon: 'a19' },

  // --------------------------------------------------------------------------------
  // 🟡 GU10
  // --------------------------------------------------------------------------------
  'LCT003': { name: 'GU10 Color Gen 1', icon: 'gu10' },
  'LCT025': { name: 'GU10 Color Gen 3 (BT)', icon: 'gu10' },
  'LTW013': { name: 'GU10 White Amb.', icon: 'gu10' },
  'LTP001': { name: 'GU10 White Amb. (BT)', icon: 'gu10' },
  'LTP002': { name: 'GU10 Color (BT)', icon: 'gu10' },
  'LTA003': { name: 'GU10 White Ambience (Matter)', icon: 'gu10' },

  // --------------------------------------------------------------------------------
  // 🟣 BR30
  // --------------------------------------------------------------------------------
  'LCT002': { name: 'BR30 Color Gen 1', icon: 'br30' },
  LTW011: { name: 'BR30 White Ambiance', icon: 'br30' },
  LTB003: { name: 'BR30 White E26', icon: 'br30' },
  LTB002: { name: 'BR30 White (BT)', icon: 'br30' },
  LCB001: { name: 'Philips', icon: 'br30' },
  LCB002: { name: 'Philips Hue White and Color Ambiance BR30 E26', icon: 'br30' },
  LCT011: { name: 'Philips Hue White and Color Ambiance BR30 Richer Colors', icon: 'br30' },

  // --------------------------------------------------------------------------------
  // 🟠 E14 / Candela
  // --------------------------------------------------------------------------------
  'LCT012': { name: 'Candle Color Gen 2', icon: 'candle' },
  'LCT022': { name: 'Luster Color', icon: 'candle' },
  'LCT023': { name: 'Candle Color (BT)', icon: 'candle' },
  'LWE001': { name: 'Candle White', icon: 'candle' },
  'LWE004': { name: 'Candle White', icon: 'filament_candle' },
  'LWE005': { name: 'Candle White', icon: 'filament_candle' },
  'LTW012': { name: 'Candle White Amb. E14', icon: 'candle' },
  'LCE001': { name: 'Candle Color Ambience (Matter)', icon: 'candle' },
  'LCE002': { name: 'Candle Filament White', icon: 'filament_candle' },

  // --------------------------------------------------------------------------------
  // ⚪ Filamento
  // --------------------------------------------------------------------------------
  'LWF001': { name: 'Filament Std A19', icon: 'filament_a19' },
  'LWF002': { name: 'white bulb A60 E27', icon: 'classic' },
  'LWF003': { name: 'Filament G93/G125', icon: 'filament_globe' },
  'LWF004': { name: 'Filament ST64', icon: 'filament_st64' },
  'LWF005': { name: 'Filament ST64', icon: 'filament_st64' },
  'LWF006': { name: 'Filament G93', icon: 'filament_globe' },
  'LWA003': { name: 'Filament A19 White (BT/Matter)', icon: 'filament_a19' },
  'LWA004': { name: 'Filament ST72 Edison White', icon: 'filament_st64' },
  'LWA005': { name: 'Filament G125 Globe White', icon: 'filament_globe' },

  // --------------------------------------------------------------------------------
  // 🌈 Strisce LED
  // --------------------------------------------------------------------------------
  'LST001': { name: 'LightStrip Gen 1', icon: 'lightstrip' },
  'LST002': { name: 'LightStrip Plus Gen 2', icon: 'lightstrip' },
  'LCS001': { name: 'LightStrip Plus Gen 3', icon: 'lightstrip' },
  'LCS002': { name: 'LightStrip Plus Gen 4 (BT)', icon: 'lightstrip' },
  'LCG002': { name: 'LightStrip Gradient', icon: 'lightstrip_gradient' },
  'LCG001': { name: 'Gradient LightStrip Indoor (Matter)', icon: 'lightstrip_gradient' },
  'LCL001': { name: 'LightStrip Ambience (BT/Matter)', icon: 'lightstrip' },
  'LCL002': { name: 'LightStrip Ambience Plus', icon: 'lightstrip' },

  // --------------------------------------------------------------------------------
  // 🛋️ Lampade Fisse / Tavolo / Pavimento
  // --------------------------------------------------------------------------------
  'LLC011': { name: 'Bloom C&W Gen 1', icon: 'bloom' },
  'LLC012': { name: 'Bloom C&W Gen 2', icon: 'bloom' },
  'LLC007': { name: 'Aura C&W', icon: 'aura' },
  'LLC006': { name: 'Iris C&W Gen 1', icon: 'iris' },
  'LLC010': { name: 'Iris C&W Gen 2', icon: 'iris' },
  'LLC013': { name: 'StoryLight C&W', icon: 'storylight' },
  'LLC020': { name: 'Hue Go', icon: 'hue_go' },
  'LLT026': { name: 'Hue Go (BT)', icon: 'hue_go' },
  'LLC021': { name: 'Hue Go (BT)', icon: 'hue_go' },
  'LCX001': { name: 'Iris (Matter)', icon: 'iris' },
  'LTV001': { name: 'Bloom (Matter)', icon: 'bloom' },
  'LTF001': { name: 'Signe Floor (Matter)', icon: 'signe_floor' },
  'LTF002': { name: 'Signe Table (Matter)', icon: 'signe_table' },

  // play / gradient
  'LJL001': { name: 'Play Bar', icon: 'play_bar' },
  'LCA010': { name: 'Play Gradient Bar (2024)', icon: 'play_bar' },
  'LCA011': { name: 'Play Gradient Compact', icon: 'play_bar' },
  'LCT024': { name: 'Play Gradient Compact', icon: 'play_bar' },

  // Signe
  'LCT020': { name: 'Signe Floor', icon: 'signe_floor' },
  'LSL001': { name: 'Signe Floor', icon: 'signe_floor' },
  'LSL002': { name: 'Signe Table', icon: 'signe_table' },
  'LSL003': { name: 'Signe Floor Gradient', icon: 'signe_floor' },
  'LSL004': { name: 'Signe Table Gradient', icon: 'signe_table' },

  // --------------------------------------------------------------------------------
  // 🏡 Lampadari / Plafoniere / Ceiling
  // --------------------------------------------------------------------------------
  'LTC001': { name: 'Ceiling Panel Color', icon: 'ceiling_panel' },
  'LTC002': { name: 'Ceiling Panel Ambience', icon: 'ceiling_panel' },

  'LTW018': { name: 'Ceiling Panel Ambience', icon: 'adore' },

  // --------------------------------------------------------------------------------
  // 🌳 Outdoor
  // --------------------------------------------------------------------------------
  'LWO001': { name: 'LightStrip Outdoor', icon: 'lightstrip_outdoor' },

  'LCC001': { name: 'Impress Wall Lantern', icon: 'impress_wall' },
  'LCC002': { name: 'Impress Pedestal', icon: 'impress_pedestal' },
  'LCC003': { name: 'Impress Large Wall', icon: 'impress_wall' },
  'LWL001': { name: 'Econic Wall', icon: 'econic_wall' },
  'LWL002': { name: 'Econic Pedestal', icon: 'econic_pedestal' },
  'LWL003': { name: 'Econic Ceiling', icon: 'econic_ceiling' },
  'LWW001': { name: 'Resonate Wall', icon: 'resonate' },
  'LWW002': { name: 'Appear Wall', icon: 'appear' },
  'LWW003': { name: 'Nyro Wall', icon: 'nyro_wall' },
  'LWW004': { name: 'Nyro Pedestal', icon: 'nyro_pedestal' },
  'LWA010': { name: 'Turaco Wall', icon: 'turaco_wall' },
  'LWA011': { name: 'Fuzo Wall', icon: 'fuzo_wall' },
  'LWA012': { name: 'Fuzo Pedestal', icon: 'fuzo_pedestal' },
  'LWA013': { name: 'Daylo Wall', icon: 'daylo_wall' },
  'LWA014': { name: 'Inara Filament Wall', icon: 'inara' },
  'LLA001': { name: 'Amarant Linear Flood', icon: 'amarant' },
  'LPA001': { name: 'Outdoor Spotlight', icon: 'outdoor_spot' },

  // --------------------------------------------------------------------------------
  // Default - per tutti gli ID sconosciuti
  // --------------------------------------------------------------------------------
  'default': { name: 'Light', icon: 'classic' }
}


export const PRESET_TYPES = {
  COLOR: 'COLOR', // Preset che usano HUE e SAT (per luci colorate)
  CT: 'CT', // Preset che usano CT (per luci CT o colorate)
  WHITE: 'WHITE' // Preset che usano solo BRI (per luci bianche)
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
  h /= 60;
  s /= 100;
  v /= 100;
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0,
    g = 0,
    b = 0;
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  const toInt = (c) => Math.round(c * 255);
  return (toInt(r) << 16) + (toInt(g) << 8) + toInt(b);
}

function calculateCtRgb(mireds) {

  // Normalizza la percentuale tra 0 (freddo) e 1 (caldo)
  const pct = Math.max(0, Math.min(1, (mireds - CT_MIN) / (CT_MAX - CT_MIN)));

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

export function xy2hexString(xy, bri = 254) {
  const hex = xy2hex(xy, bri).toString(16).padStart(6, '0').toUpperCase()
  return '#' + hex
}

/**
 * Converti coordinate XY (CIE 1931) a hex color integer
 */
export function xy2hex(xy, bri = BRI_RANGE) {
  if (!xy || !Array.isArray(xy) || xy.length < 2) {
    return 0xFFFFFF // Fallback bianco
  }

  const [x, y] = xy
  const { r, g, b } = xyBriToRgb(x, y, bri)

  return (r << 16) | (g << 8) | b
}

/**
 * Converti coordinate XY + brightness a RGB
 */
function xyBriToRgb(x, y, bri) {
  const brightness = bri / BRI_RANGE
  const z = 1.0 - x - y

  const Y = brightness
  const X = (Y / y) * x
  const Z = (Y / y) * z

  // Matrice XYZ → RGB (sRGB D65)
  let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038
  let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152
  let b = X * 0.051713 - Y * 0.121364 + Z * 1.011530

  // Gamma correction (sRGB)
  r = r <= 0.0031308 ? 12.92 * r : (1.0 + 0.055) * Math.pow(r, (1.0 / 2.4)) - 0.055
  g = g <= 0.0031308 ? 12.92 * g : (1.0 + 0.055) * Math.pow(g, (1.0 / 2.4)) - 0.055
  b = b <= 0.0031308 ? 12.92 * b : (1.0 + 0.055) * Math.pow(b, (1.0 / 2.4)) - 0.055

  // Clamp e scala a 0-255
  r = Math.max(0, Math.min(1, r)) * 255
  g = Math.max(0, Math.min(1, g)) * 255
  b = Math.max(0, Math.min(1, b)) * 255

  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b)
  }
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
}

export function multiplyHexColor(hex_color, multiplier) {
  hex_color = Math.floor(hex_color).toString(16).padStart(6, "0");

  let r = parseInt(hex_color.substring(0, 2), 16);
  let g = parseInt(hex_color.substring(2, 4), 16);
  let b = parseInt(hex_color.substring(4, 6), 16);

  r = Math.min(Math.round(r * multiplier), 255);
  g = Math.min(Math.round(g * multiplier), 255);
  b = Math.min(Math.round(b * multiplier), 255);

  const result = "0x" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  return result;
}

export function btnPressColor(hex_color, multiplier) {
  hex_color = Math.floor(hex_color).toString(16).padStart(6, "0");

  let r = parseInt(hex_color.substring(0, 2), 16);
  let g = parseInt(hex_color.substring(2, 4), 16);
  let b = parseInt(hex_color.substring(4, 6), 16);

  // check if any of the color components are at their maximum value
  if (r === 255 || g === 255 || b === 255) {
    // and if so + the multiplier is greater than 1, divide the color
    if (multiplier > 1) {
      return multiplyHexColor("0x" + hex_color, 1 / multiplier); // inverse
    }
  }
  // otherwise usual multiplication
  return multiplyHexColor("0x" + hex_color, multiplier);
}