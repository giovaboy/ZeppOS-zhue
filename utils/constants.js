export const COLORS = {
  background: 0x000000,
  text: 0xffffff,
  // One grey for every secondary text (subtitles, off, hints): it was
  // #AAAAAA, #B3B3B3 or #999999 depending on the page
  textSubtitle: 0xb3b3b3,
  // The app's one accent (activeTab): what is touched or chosen. Buttons
  // like Retry and the pairing screens used three blues
  highlight: 0x984ce5,
  activeTab: 0x984ce5, //0x0055ff,
  activeTabText: 0xffffff,
  inactiveTab: 0x333333,
  inactiveTabText: 0xb3b3b3,
  warning: 0xff6600,
  warningText: 0xffffff,
  success: 0x39935a, //0x2ecd6e,//0x00aa00,
  error: 0xff0000,
  inactive: 0xb3b3b3, //0x666666,
  // Text on an "off" control filled with `inactive`: white on #B3B3B3 is
  // 2.1:1, under the 3:1 large text needs (design-guidelines.md, "Color");
  // black is 10:1. The group's header read poorly
  onInactive: 0x000000,
  // A "Loading…" text: #666666 on black is 3.7:1, under the 4.5:1 text needs
  loading: 0xb3b3b3,
  lightBg: 0x333333, //light background, same color as the light icons mask (#FFFFFF opacity 20%) color_sys_item_bg per zeppos doc
  sceneBg: 0x333333, // as every row (it was a dark blue): the scene's dot tells it
  toggleOff: 0x444444,
  sectionHeader: 0x984ce5, // section titles ("Lights", "Scenes", "Favorites"): the accent
  sliderBg: 0x333333, // slider track: color_sys_item
  sliderFill: 0xffffff,
  briText: 0xcccccc,
  defaultSwatchColor: 0xFFCC66,
  white: 0xFFFFFF,
  black: 0x000000,
  color_sys_item_bg: 0x333333,
  color_text_title: 0xffffff,
  color_text_subtitle: 0xb3b3b3
}

// Range API Hue/Sat/Bri
export const HUE_RANGE = 65535; // 0-65535
export const SAT_RANGE = 254;   // 0-254
export const BRI_RANGE = 254;   // 1-254
export const CT_MIN = 153;      // 153 (6500K)
export const CT_MAX = 500;      // 500 (2000K)

export const PRESET_TYPES = {
  COLOR: 'COLOR', // Preset che usano HUE e SAT (per luci colorate)
  CT: 'CT', // Preset che usano CT (per luci CT o colorate)
  WHITE: 'WHITE' // Preset che usano solo BRI (per luci bianche)
};

export const DEFAULT_PRESETS = [
  { id: '1', hex: '#C99F2A', bri: 200, hue: 8000, sat: 200, type: PRESET_TYPES.COLOR },
  { id: '2', hex: '#5BDED5', bri: 220, hue: 32000, sat: 150, type: PRESET_TYPES.COLOR },
  { id: '3', hex: '#B50000', bri: 180, hue: 0, sat: 254, type: PRESET_TYPES.COLOR },
  { id: '4', hex: '#CCDDFF', bri: 254, ct: 153, type: PRESET_TYPES.CT },
  { id: '5', hex: '#FFB044', bri: 254, ct: 500, type: PRESET_TYPES.CT },
  { id: '6', hex: '#280063', bri: 100, hue: 48000, sat: 254, type: PRESET_TYPES.COLOR },
  { id: '7', hex: '#FFFFFF', bri: 50, type: PRESET_TYPES.WHITE }
];

export const DEFAULT_USER_SETTINGS = {
  default_tab: 'ROOMS',
  show_scenes: true,
  display_order: 'LIGHTS_FIRST',
  favorite_colors: DEFAULT_PRESETS
}

// Widget shortcuts storage key (device localStorage)
export const WIDGET_SHORTCUTS_KEY = 'widget_shortcuts'
export const MAX_WIDGET_SHORTCUTS = 9
// The shortcut card shows a light on or off only while its state was
// confirmed less than this long ago (utils/shortcuts.js); an older state is
// shown as unknown: the lights may have changed meanwhile (the Hue app, a
// switch), and the card cannot ask the phone
export const CARD_STATE_FRESH_MS = 30 * 60 * 1000

// Default widget shortcuts
export const DEFAULT_WIDGET_SHORTCUTS = Array.from(
  { length: MAX_WIDGET_SHORTCUTS },
  () => ({ lightId: null, lightName: null, modelid: null })
)

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
  'LTW011': { name: 'BR30 White Ambiance', icon: 'br30' },
  'LTB003': { name: 'BR30 White E26', icon: 'br30' },
  'LTB002': { name: 'BR30 White (BT)', icon: 'br30' },
  'LCB001': { name: 'Philips', icon: 'br30' },
  'LCB002': { name: 'Philips Hue White and Color Ambiance BR30 E26', icon: 'br30' },
  'LCT011': { name: 'Philips Hue White and Color Ambiance BR30 Richer Colors', icon: 'br30' },

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
  'LWF004': { name: 'Filament ST64', icon: 'filament_a19' },
  'LWF005': { name: 'Filament ST64', icon: 'filament_a19' },
  'LWF006': { name: 'Filament G93', icon: 'filament_globe' },
  'LWA003': { name: 'Filament A19 White (BT/Matter)', icon: 'filament_a19' },
  'LWA004': { name: 'Filament ST72 Edison White', icon: 'filament_a19' },
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
  'LLC013': { name: 'StoryLight C&W', icon: 'classic' },
  'LLC020': { name: 'Hue Go', icon: 'classic' },
  'LLT026': { name: 'Hue Go (BT)', icon: 'classic' },
  'LLC021': { name: 'Hue Go (BT)', icon: 'classic' },
  'LCX001': { name: 'Iris (Matter)', icon: 'iris' },
  'LTV001': { name: 'Bloom (Matter)', icon: 'bloom' },
  'LTF001': { name: 'Signe Floor (Matter)', icon: 'signe' },
  'LTF002': { name: 'Signe Table (Matter)', icon: 'signe' },

  // play / gradient
  'LJL001': { name: 'Play Bar', icon: 'play_bar' },
  'LCA010': { name: 'Play Gradient Bar (2024)', icon: 'play_bar' },
  'LCA011': { name: 'Play Gradient Compact', icon: 'play_bar' },
  'LCT024': { name: 'Play Gradient Compact', icon: 'play_bar' },

  // Signe
  'LCT020': { name: 'Signe Floor', icon: 'signe' },
  'LSL001': { name: 'Signe Floor', icon: 'signe' },
  'LSL002': { name: 'Signe Table', icon: 'signe' },
  'LSL003': { name: 'Signe Floor Gradient', icon: 'signe' },
  'LSL004': { name: 'Signe Table Gradient', icon: 'signe' },

  // --------------------------------------------------------------------------------
  // 🏡 Lampadari / Plafoniere / Ceiling
  // --------------------------------------------------------------------------------
  'LTC001': { name: 'Ceiling Panel Color', icon: 'ceiling-infuse' },
  'LTC002': { name: 'Ceiling Panel Ambience', icon: 'ceiling-infuse' },

  'LTW018': { name: 'Ceiling Panel Ambience', icon: 'adore' },

  // --------------------------------------------------------------------------------
  // 🌳 Outdoor
  // --------------------------------------------------------------------------------
  'LWO001': { name: 'LightStrip Outdoor', icon: 'lightstrip' },

  'LCC001': { name: 'Impress Wall Lantern', icon: 'classic' },
  'LCC002': { name: 'Impress Pedestal', icon: 'calla' },
  'LCC003': { name: 'Impress Large Wall', icon: 'classic' },
  'LWL001': { name: 'Econic Wall', icon: 'classic' },
  'LWL002': { name: 'Econic Pedestal', icon: 'calla' },
  'LWL003': { name: 'Econic Ceiling', icon: 'ceiling-infuse' },
  'LWW001': { name: 'Resonate Wall', icon: 'classic' },
  'LWW002': { name: 'Appear Wall', icon: 'classic' },
  'LWW003': { name: 'Nyro Wall', icon: 'classic' },
  'LWW004': { name: 'Nyro Pedestal', icon: 'calla' },
  'LWA010': { name: 'Turaco Wall', icon: 'classic' },
  'LWA011': { name: 'Fuzo Wall', icon: 'classic' },
  'LWA012': { name: 'Fuzo Pedestal', icon: 'calla' },
  'LWA013': { name: 'Daylo Wall', icon: 'classic' },
  'LWA014': { name: 'Inara Filament Wall', icon: 'classic' },
  'LLA001': { name: 'Amarant Linear Flood', icon: 'amarant' },
  'LPA001': { name: 'Outdoor Spotlight', icon: 'lily' },

  // --------------------------------------------------------------------------------
  // Default - per tutti gli ID sconosciuti
  // --------------------------------------------------------------------------------
  'default': { name: 'Light', icon: 'classic' }
}

// The icon for each lamp type the Hue app lets one pick for a light (its
// "archetype", which the bridge sends with every light: config.archetype,
// v1 "classicbulb", v2 "classic_bulb"). A model in LIGHT_MODELS keeps its own
// icon; the type gives one to the models never mapped there (their model
// ids were hard to match), each to the closest icon. Types without one
// (hue go, plug...) get LIGHT_MODELS.default
const ARCHETYPE_ICONS = {
  classicbulb: 'a19', sultanbulb: 'a19', ellipsebulb: 'a19', trianglebulb: 'a19',
  vintagebulb: 'filament_a19', edisonbulb: 'filament_a19',
  smallglobebulb: 'filament_globe', largeglobebulb: 'filament_globe',
  candlebulb: 'candle', vintagecandlebulb: 'filament_candle', lusterbulb: 'bulb-golfball-e14',
  spotbulb: 'gu10', floodbulb: 'bulb-flood',
  ceilinground: 'ceiling-fair', ceilingsquare: 'aurelle',
  ceilinghorizontal: 'aurelle', ceilingtube: 'aurelle',
  recessedceiling: 'amaze',
  pendantround: 'ceiling-beyond', pendantlong: 'ensis', pendantspot: 'ceiling-explore',
  singlespot: 'ceiling-buratto', doublespot: 'ceiling-buratto', wallspot: 'ceiling-buratto',
  huecentris: 'ceiling-buckram',
  tableshade: 'beyond', flexiblelamp: 'beyond', floorshade: 'signe',
  floorlantern: 'pillar-turaco-tall', walllantern: 'pillar-turaco-short',
  wallshade: 'sana', wallwasher: 'amarant',
  bollard: 'pillar-tuar', groundspot: 'pillar-tuar', recessedfloor: 'pillar-tuar',
  huelightstrip: 'lightstrip', huelightstriptv: 'lightstrip_gradient', huelightstrippc: 'lightstrip_gradient',
  hueplay: 'play_bar', huetube: 'play_tube',
  hueiris: 'iris', huebloom: 'bloom', huesigne: 'signe',
  christmastree: 'festavia', stringlight: 'festavia'
}

// The icon file's name (icons/<name>.png) for a light: its model's, else
// its type's, else the default
export function lightIconName(light) {
  const model = light && LIGHT_MODELS[light.modelid]
  if (model) return model.icon
  const type = light && typeof light.archetype === 'string' ? light.archetype.replace(/_/g, '') : ''
  return ARCHETYPE_ICONS[type] || LIGHT_MODELS.default.icon
}

// Size of the icon PNGs (assets/default.*/icons and icons/groups): 70×70
// masks, #333333 with the shape cut out, drawn over a FILL_RECT of the
// light's or group's color
export const ICON_IMAGE_SIZE = 70

// A Hue room/zone class → its file in icons/groups/. Every value must be a
// file there: a missing one showed an empty grey square (the FILL_RECT under
// the mask). 'Music' and 'Reading' have no icon yet: 'other'
export const GROUP_ICONS = {
  'Attic': 'attic',
  'Bathroom': 'bathroom',
  'Balcony': 'balcony',
  'Barbecue': 'bbq',
  'Bedroom': 'bedroom',
  'Carport': 'carport',
  'Closet': 'closet',
  'Computer': 'computer',
  'Dining': 'dining',
  'Downstairs': 'downstairs',
  'Driveway': 'driveway',
  'Front door': 'front-door',
  'Garage': 'garage',
  'Garden': 'outdoors',
  'Guest room': 'guestroom',
  'Gym': 'gym',
  'Hallway': 'hallway',
  'Home': 'home',
  'Kids bedroom': 'kids_bedroom',
  'Kitchen': 'kitchen',
  'Laundry room': 'laundry',
  'Living room': 'living',
  'Lounge': 'lounge',
  'Man cave': 'games',
  'Music': 'other',
  'Nursery': 'nursery',
  'Office': 'office',
  'Other': 'other',
  'Pool': 'pool',
  'Porch': 'porch',
  'Reading': 'other',
  'Recreation': 'recreation',
  'Staircase': 'stairs',
  'Storage': 'storage',
  'Studio': 'studio',
  'Toilet': 'toilet',
  'Top floor': 'upstairs',
  'Terrace': 'terrace',
  'TV': 'games',
  'Upstairs': 'upstairs'
}

// Helper per ottenere il path
export function getGroupIconPath(className) {
  const filename = GROUP_ICONS[className] || 'other'
  return `icons/groups/${filename}.png`
}

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

// XY (CIE 1931) + brightness to RGB 0-255; the phone uses it too
// (app-side stateToHex), it had its own copy
export function xyBriToRgb(x, y, bri) {
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

/**
 * Converte una stringa hex (#RRGGBB) a intero esadecimale
 */
export function hexStringToInt(hexString) {
  if (!hexString) return 0xFFFFFF
  return parseInt(hexString.replace('#', '0x'), 16)
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

// Zepp OS design: a pressed control's brightness drops by 28.6%
// (design-guidelines.md, "Color")
export const PRESSED_BRIGHTNESS = 0.714

// The pressed color of a control (a number, as widgets take it)
export function btnPressColor(hex_color, multiplier = PRESSED_BRIGHTNESS) {
  return Number(pressColorText(hex_color, multiplier))
}

function pressColorText(hex_color, multiplier) {
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
// Presets in the order the watch and the settings page show them: whites by
// brightness, then color temperatures, then colors by hue
function presetTypePriority(type) {
  switch (type) {
    case PRESET_TYPES.WHITE: return 1
    case PRESET_TYPES.CT: return 2
    case PRESET_TYPES.COLOR: return 3
    default: return 99
  }
}

export function comparePresets(a, b) {
  const priorityA = presetTypePriority(a.type)
  const priorityB = presetTypePriority(b.type)
  if (priorityA !== priorityB) return priorityA - priorityB
  if (a.type === PRESET_TYPES.WHITE) return a.bri - b.bri
  if (a.type === PRESET_TYPES.CT) return a.ct - b.ct
  if (a.type === PRESET_TYPES.COLOR) return a.hue - b.hue
  return 0
}

// The color a light shows, as an int (the light page's tint and swatches, the
// shortcut card): its hue / saturation, white temperature or xy, else white
//
// Always at full brightness: the color says the hue, the brightness has its
// own slider. The phone's hex is scaled by the brightness (stateToHex): a
// white light at 20% came as #333333, the very grey of the icons' masks, and
// the lamp vanished; a color at low brightness came near black.
export function lightDisplayColor(light) {
  if (!light) return COLORS.white
  let c
  if (light.colormode === 'hs' && light.hex) c = hexStringToInt(light.hex)
  else if (light.colormode === 'ct' && light.ct) c = ct2hex(light.ct)
  else if (light.colormode === 'xy' && light.xy) c = xy2hex(light.xy, BRI_RANGE)
  else if (light.hex) c = hexStringToInt(light.hex)
  else return COLORS.white
  return fullBrightness(c)
}

// The color scaled so its brightest channel is 255 (black: white, a light
// with no color)
export function fullBrightness(c) {
  const n = Number(c) || 0
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff
  const m = Math.max(r, g, b)
  if (!m) return COLORS.white
  const k = 255 / m
  return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k)
}
