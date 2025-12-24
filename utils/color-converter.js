export const HUE_RANGE = 65535
export const SAT_RANGE = 254
export const BRI_RANGE = 254
export const CT_MIN = 153
export const CT_MAX = 500

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