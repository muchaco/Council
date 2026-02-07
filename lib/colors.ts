/**
 * Color utility functions for calculating accent colors from persona base colors.
 * 
 * This module follows the Functional Core pattern - all functions are pure,
 * deterministic, and free of side effects. They can be tested without mocks.
 */

/**
 * Represents HSL color components.
 */
export interface HSL {
  h: number; // Hue (0-360)
  s: number; // Saturation (0-100)
  l: number; // Lightness (0-100)
}

/**
 * Represents accent colors for message bubble styling.
 */
export interface AccentColors {
  border: string;      // Solid hex color for border
  background: string;  // RGBA color with 8% opacity for background tint
}

/**
 * Converts a hex color string to HSL components.
 * Accepts formats: #RGB, #RRGGBB, RGB, RRGGBB (with or without #)
 * 
 * @param hex - Hex color string
 * @returns HSL components
 * @throws Error if hex format is invalid
 */
export function hexToHSL(hex: string): HSL {
  // Normalize hex string
  let normalizedHex = hex.trim();
  
  if (normalizedHex.startsWith('#')) {
    normalizedHex = normalizedHex.slice(1);
  }
  
  // Handle shorthand format (e.g., "F00" -> "FF0000")
  if (normalizedHex.length === 3) {
    normalizedHex = normalizedHex
      .split('')
      .map(char => char + char)
      .join('');
  }
  
  if (normalizedHex.length !== 6) {
    throw new Error(`Invalid hex color format: ${hex}`);
  }
  
  // Parse RGB values
  const r = parseInt(normalizedHex.substring(0, 2), 16) / 255;
  const g = parseInt(normalizedHex.substring(2, 4), 16) / 255;
  const b = parseInt(normalizedHex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts HSL components to a hex color string.
 * 
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns Hex color string (format: #RRGGBB)
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = h / 360;
  const saturation = s / 100;
  const lightness = l / 100;
  
  let r: number;
  let g: number;
  let b: number;
  
  if (saturation === 0) {
    r = g = b = lightness;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      let normalizedT = t;
      if (normalizedT < 0) normalizedT += 1;
      if (normalizedT > 1) normalizedT -= 1;
      if (normalizedT < 1 / 6) return p + (q - p) * 6 * normalizedT;
      if (normalizedT < 1 / 2) return q;
      if (normalizedT < 2 / 3) return p + (q - p) * (2 / 3 - normalizedT) * 6;
      return p;
    };
    
    const q = lightness < 0.5 
      ? lightness * (1 + saturation) 
      : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    
    r = hue2rgb(p, q, hue + 1 / 3);
    g = hue2rgb(p, q, hue);
    b = hue2rgb(p, q, hue - 1 / 3);
  }
  
  const toHex = (c: number): string => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Calculates the relative luminance of a color according to WCAG 2.0.
 * Used for determining perceived brightness and contrast ratios.
 * 
 * @param hex - Hex color string
 * @returns Relative luminance (0-1, where 0 is black and 1 is white)
 */
export function getLuminance(hex: string): number {
  const normalizedHex = hex.startsWith('#') ? hex.slice(1) : hex;
  
  const r = parseInt(normalizedHex.substring(0, 2), 16) / 255;
  const g = parseInt(normalizedHex.substring(2, 4), 16) / 255;
  const b = parseInt(normalizedHex.substring(4, 6), 16) / 255;
  
  // Apply gamma correction
  const gammaCorrect = (c: number): number => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  
  const rLinear = gammaCorrect(r);
  const gLinear = gammaCorrect(g);
  const bLinear = gammaCorrect(b);
  
  // Calculate relative luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Blends a color toward a neutral gray (#6B7280) by a given ratio.
 * Used to handle edge cases with very light or very dark colors.
 * 
 * @param hex - Hex color string to blend
 * @param ratio - Blend ratio (0-1, where 0 returns original, 1 returns gray)
 * @returns Blended hex color string
 */
export function blendWithGray(hex: string, ratio: number): string {
  const targetGray = { r: 107, g: 114, b: 128 }; // #6B7280
  
  const normalizedHex = hex.startsWith('#') ? hex.slice(1) : hex;
  
  const r = parseInt(normalizedHex.substring(0, 2), 16);
  const g = parseInt(normalizedHex.substring(2, 4), 16);
  const b = parseInt(normalizedHex.substring(4, 6), 16);
  
  const blendedR = Math.round(r * (1 - ratio) + targetGray.r * ratio);
  const blendedG = Math.round(g * (1 - ratio) + targetGray.g * ratio);
  const blendedB = Math.round(b * (1 - ratio) + targetGray.b * ratio);
  
  const toHex = (c: number): string => {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(blendedR)}${toHex(blendedG)}${toHex(blendedB)}`.toUpperCase();
}

/**
 * Calculates accent colors for message bubble styling from a base persona color.
 * 
 * Algorithm:
 * 1. Check luminance of base color
 * 2. If luminance > 0.9 (very light): Blend base color 50% toward #6B7280
 * 3. If luminance < 0.1 (very dark): Blend base color 50% toward #6B7280
 * 4. Otherwise: Use base color as-is
 * 5. Return border (solid color) and background (same color with 8% opacity)
 * 
 * @param baseColor - Hex color string (persona's assigned color)
 * @returns AccentColors with border and background values
 */
export function calculateAccentColor(baseColor: string): AccentColors {
  // Normalize color
  let normalizedColor = baseColor.trim();
  if (!normalizedColor.startsWith('#')) {
    normalizedColor = '#' + normalizedColor;
  }
  
  // Handle shorthand format
  if (normalizedColor.length === 4) {
    normalizedColor = '#' + normalizedColor
      .slice(1)
      .split('')
      .map(char => char + char)
      .join('');
  }
  
  // Calculate luminance
  const luminance = getLuminance(normalizedColor);
  
  // Blend toward gray for edge cases
  let finalColor = normalizedColor;
  if (luminance > 0.9 || luminance < 0.1) {
    finalColor = blendWithGray(normalizedColor, 0.5);
  }
  
  // Parse RGB values for rgba background
  const hexValue = finalColor.slice(1);
  const r = parseInt(hexValue.substring(0, 2), 16);
  const g = parseInt(hexValue.substring(2, 4), 16);
  const b = parseInt(hexValue.substring(4, 6), 16);
  
  return {
    border: finalColor.toUpperCase(),
    background: `rgba(${r}, ${g}, ${b}, 0.08)`,
  };
}
