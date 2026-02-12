import { describe, expect, it } from 'vitest';
import { blendWithGray, calculateAccentColor, getLuminance, hexToHSL, hslToHex } from './colors';

describe('color_utils_spec', () => {
  describe('hex_to_hsl_conversion', () => {
    it.each([
      { hex: '#FFFFFF', expected: { h: 0, s: 0, l: 100 } },
      { hex: '#000000', expected: { h: 0, s: 0, l: 0 } },
      { hex: '#FF0000', expected: { h: 0, s: 100, l: 50 } },
      { hex: '#00FF00', expected: { h: 120, s: 100, l: 50 } },
      { hex: '#0000FF', expected: { h: 240, s: 100, l: 50 } },
      { hex: '#808080', expected: { h: 0, s: 0, l: 50 } },
      { hex: 'ff0000', expected: { h: 0, s: 100, l: 50 } },
      { hex: 'FF0000', expected: { h: 0, s: 100, l: 50 } },
      { hex: '#F00', expected: { h: 0, s: 100, l: 50 } },
    ])('converts_$hex_into_expected_hsl_components', ({ hex, expected }) => {
      const result = hexToHSL(hex);
      expect(result.h).toBe(expected.h);
      expect(result.s).toBe(expected.s);
      expect(result.l).toBeCloseTo(expected.l, 1);
    });
  });

  describe('hsl_to_hex_conversion', () => {
    it.each([
      { h: 0, s: 0, l: 100, hex: '#FFFFFF' },
      { h: 0, s: 0, l: 0, hex: '#000000' },
      { h: 0, s: 100, l: 50, hex: '#FF0000' },
      { h: 120, s: 100, l: 50, hex: '#00FF00' },
      { h: 240, s: 100, l: 50, hex: '#0000FF' },
      { h: 0, s: 0, l: 50, hex: '#808080' },
    ])('converts_hsl($h,$s,$l)_to_$hex', ({ h, s, l, hex }) => {
      const result = hslToHex(h, s, l);
      expect(result.toUpperCase()).toBe(hex);
    });
  });

  describe('hex_hsl_round_trip', () => {
    it.each([
      { hex: '#FFFFFF' },
      { hex: '#000000' },
      { hex: '#FF0000' },
      { hex: '#00FF00' },
      { hex: '#0000FF' },
      { hex: '#808080' },
      { hex: '#FFFF00' },
      { hex: '#00FFFF' },
      { hex: '#FF00FF' },
    ])('preserves_$hex_when_converted_to_hsl_and_back', ({ hex }) => {
      const hsl = hexToHSL(hex);
      const result = hslToHex(hsl.h, hsl.s, hsl.l);
      expect(result.toUpperCase()).toBe(hex);
    });

    it('preserves_orange_with_expected_rounding_tolerance', () => {
      const hsl = hexToHSL('#FFA500');
      const result = hslToHex(hsl.h, hsl.s, hsl.l);
      expect(result.toUpperCase()).toMatch(/^#FFA[456]00$/i);
    });
  });

  describe('luminance_calculation', () => {
    it.each([
      { hex: '#FFFFFF', luminance: 1 },
      { hex: '#000000', luminance: 0 },
      { hex: '#FF0000', luminance: 0.2126 },
      { hex: '#00FF00', luminance: 0.7152 },
      { hex: '#0000FF', luminance: 0.0722 },
      { hex: '#808080', luminance: 0.21586 },
    ])('calculates_expected_luminance_for_$hex', ({ hex, luminance }) => {
      const result = getLuminance(hex);
      expect(result).toBeCloseTo(luminance, 3);
    });
  });

  describe('gray_blending_behavior', () => {
    it.each([
      { hex: '#FFFFFF', ratio: 0.5, blended: '#B5B9C0' },
      { hex: '#000000', ratio: 0.5, blended: '#363940' },
      { hex: '#FF0000', ratio: 0.5, blended: '#B53940' },
      { hex: '#FF0000', ratio: 0, blended: '#FF0000' },
      { hex: '#FF0000', ratio: 1, blended: '#6B7280' },
      { hex: '#0000FF', ratio: 0.25, blended: '#1B1DDF' },
    ])('blends_$hex_toward_gray_at_ratio_$ratio', ({ hex, ratio, blended }) => {
      const result = blendWithGray(hex, ratio);
      expect(result.toUpperCase()).toBe(blended);
    });
  });

  describe('accent_color_calculation', () => {
    it.each([
      '#3B82F6',
      '#10B981',
      '#EF4444',
      '#8B5CF6',
      '#F97316',
      '#EC4899',
      '#06B6D4',
      '#F59E0B',
      '#6B7280',
    ])('returns_valid_border_and_background_for_%s', (hex) => {
      const result = calculateAccentColor(hex);
      expect(result.border).toMatch(/^#[0-9A-F]{6}$/i);
      expect(result.background).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*0\.08\)$/);
    });

    it('blends_very_light_colors_toward_gray', () => {
      const result = calculateAccentColor('#FFFFFF');
      expect(result.border.toUpperCase()).toBe('#B5B9C0');
      expect(result.background).toBe('rgba(181, 185, 192, 0.08)');
    });

    it('blends_very_dark_colors_toward_gray', () => {
      const result = calculateAccentColor('#000000');
      expect(result.border.toUpperCase()).toBe('#363940');
      expect(result.background).toBe('rgba(54, 57, 64, 0.08)');
    });

    it('keeps_mid_tone_colors_unchanged', () => {
      const result = calculateAccentColor('#3B82F6');
      expect(result.border.toUpperCase()).toBe('#3B82F6');
      expect(result.background).toBe('rgba(59, 130, 246, 0.08)');
    });

    it('is_deterministic_for_the_same_input_color', () => {
      const first = calculateAccentColor('#3B82F6');
      const second = calculateAccentColor('#3B82F6');
      expect(first).toEqual(second);
    });
  });
});
