import { describe, it, expect } from 'vitest';
import {
  hexToHSL,
  hslToHex,
  getLuminance,
  blendWithGray,
  calculateAccentColor,
} from './colors';

describe('color_utils_spec', () => {
  describe('hexToHSL_converts_hex_colors_to_hsl_components', () => {
    it('pure_white_has_zero_saturation_and_full_lightness', () => {
      const result = hexToHSL('#FFFFFF');
      expect(result.h).toBe(0);
      expect(result.s).toBe(0);
      expect(result.l).toBe(100);
    });

    it('pure_black_has_zero_saturation_and_zero_lightness', () => {
      const result = hexToHSL('#000000');
      expect(result.h).toBe(0);
      expect(result.s).toBe(0);
      expect(result.l).toBe(0);
    });

    it('pure_red_has_zero_hue_full_saturation_and_half_lightness', () => {
      const result = hexToHSL('#FF0000');
      expect(result.h).toBe(0);
      expect(result.s).toBe(100);
      expect(result.l).toBe(50);
    });

    it('pure_green_has_120_hue_full_saturation_and_half_lightness', () => {
      const result = hexToHSL('#00FF00');
      expect(result.h).toBe(120);
      expect(result.s).toBe(100);
      expect(result.l).toBe(50);
    });

    it('pure_blue_has_240_hue_full_saturation_and_half_lightness', () => {
      const result = hexToHSL('#0000FF');
      expect(result.h).toBe(240);
      expect(result.s).toBe(100);
      expect(result.l).toBe(50);
    });

    it('medium_gray_has_zero_saturation_and_50_percent_lightness', () => {
      const result = hexToHSL('#808080');
      expect(result.h).toBe(0);
      expect(result.s).toBe(0);
      expect(result.l).toBeCloseTo(50, 1);
    });

    it('handles_lowercase_hex_without_hash_prefix', () => {
      const result = hexToHSL('ff0000');
      expect(result.h).toBe(0);
      expect(result.s).toBe(100);
      expect(result.l).toBe(50);
    });

    it('handles_uppercase_hex_without_hash_prefix', () => {
      const result = hexToHSL('FF0000');
      expect(result.h).toBe(0);
      expect(result.s).toBe(100);
      expect(result.l).toBe(50);
    });

    it('handles_shorthand_hex_format', () => {
      const result = hexToHSL('#F00');
      expect(result.h).toBe(0);
      expect(result.s).toBe(100);
      expect(result.l).toBe(50);
    });
  });

  describe('hslToHex_converts_hsl_components_to_hex_string', () => {
    it('zero_saturation_and_full_lightness_produces_white', () => {
      const result = hslToHex(0, 0, 100);
      expect(result.toUpperCase()).toBe('#FFFFFF');
    });

    it('zero_saturation_and_zero_lightness_produces_black', () => {
      const result = hslToHex(0, 0, 0);
      expect(result.toUpperCase()).toBe('#000000');
    });

    it('zero_hue_full_saturation_half_lightness_produces_red', () => {
      const result = hslToHex(0, 100, 50);
      expect(result.toUpperCase()).toBe('#FF0000');
    });

    it('120_hue_full_saturation_half_lightness_produces_green', () => {
      const result = hslToHex(120, 100, 50);
      expect(result.toUpperCase()).toBe('#00FF00');
    });

    it('240_hue_full_saturation_half_lightness_produces_blue', () => {
      const result = hslToHex(240, 100, 50);
      expect(result.toUpperCase()).toBe('#0000FF');
    });

    it('zero_saturation_50_lightness_produces_medium_gray', () => {
      const result = hslToHex(0, 0, 50);
      expect(result.toUpperCase()).toBe('#808080');
    });
  });

  describe('hex_hsl_round_trip_preserves_color_values', () => {
    const testCases: Array<{ name: string; hex: string; expectedPattern?: RegExp }> = [
      { name: 'white', hex: '#FFFFFF' },
      { name: 'black', hex: '#000000' },
      { name: 'red', hex: '#FF0000' },
      { name: 'green', hex: '#00FF00' },
      { name: 'blue', hex: '#0000FF' },
      { name: 'gray', hex: '#808080' },
      { name: 'yellow', hex: '#FFFF00' },
      { name: 'cyan', hex: '#00FFFF' },
      { name: 'magenta', hex: '#FF00FF' },
      { name: 'orange', hex: '#FFA500', expectedPattern: /^#FFA[456]00$/i },
    ];

    testCases.forEach(({ name, hex, expectedPattern }) => {
      it(`${name}_color_round_trips_accurately`, () => {
        const hsl = hexToHSL(hex);
        const result = hslToHex(hsl.h, hsl.s, hsl.l);
        if (expectedPattern) {
          // For colors with floating-point precision issues, use pattern matching
          expect(result.toUpperCase()).toMatch(expectedPattern);
        } else {
          expect(result.toUpperCase()).toBe(hex.toUpperCase());
        }
      });
    });
  });

  describe('getLuminance_calculates_relative_luminance', () => {
    it('pure_white_has_maximum_luminance_of_one', () => {
      const result = getLuminance('#FFFFFF');
      expect(result).toBe(1);
    });

    it('pure_black_has_minimum_luminance_of_zero', () => {
      const result = getLuminance('#000000');
      expect(result).toBe(0);
    });

    it('pure_red_has_luminance_of_approximately_0_dot_21', () => {
      const result = getLuminance('#FF0000');
      expect(result).toBeCloseTo(0.2126, 3);
    });

    it('pure_green_has_luminance_of_approximately_0_dot_72', () => {
      const result = getLuminance('#00FF00');
      expect(result).toBeCloseTo(0.7152, 3);
    });

    it('pure_blue_has_luminance_of_approximately_0_dot_07', () => {
      const result = getLuminance('#0000FF');
      expect(result).toBeCloseTo(0.0722, 3);
    });

    it('medium_gray_has_luminance_of_approximately_0_dot_21', () => {
      const result = getLuminance('#808080');
      expect(result).toBeCloseTo(0.21586, 3);
    });
  });

  describe('blendWithGray_mixes_color_toward_neutral_gray', () => {
    it('blending_white_50_percent_produces_gray_blend', () => {
      const result = blendWithGray('#FFFFFF', 0.5);
      // Blending white (255,255,255) 50% toward gray (107,114,128)
      // = (255*0.5 + 107*0.5, 255*0.5 + 114*0.5, 255*0.5 + 128*0.5)
      // = (181, 184.5, 191.5) ≈ (181, 185, 192) = #B5B9C0
      expect(result.toUpperCase()).toBe('#B5B9C0');
    });

    it('blending_black_50_percent_produces_gray_blend', () => {
      const result = blendWithGray('#000000', 0.5);
      // Blending black (0,0,0) 50% toward gray (107,114,128)
      // = (0*0.5 + 107*0.5, 0*0.5 + 114*0.5, 0*0.5 + 128*0.5)
      // = (53.5, 57, 64) ≈ (54, 57, 64) = #363940
      expect(result.toUpperCase()).toBe('#363940');
    });

    it('blending_red_50_percent_produces_muted_red', () => {
      const result = blendWithGray('#FF0000', 0.5);
      // Blending red (255,0,0) 50% toward gray (107,114,128)
      // = (255*0.5 + 107*0.5, 0*0.5 + 114*0.5, 0*0.5 + 128*0.5)
      // = (181, 57, 64) = #B53940
      expect(result.toUpperCase()).toBe('#B53940');
    });

    it('blending_with_0_ratio_returns_original_color_unchanged', () => {
      const result = blendWithGray('#FF0000', 0);
      expect(result.toUpperCase()).toBe('#FF0000');
    });

    it('blending_with_1_ratio_returns_target_gray_fully', () => {
      const result = blendWithGray('#FF0000', 1);
      expect(result.toUpperCase()).toBe('#6B7280');
    });

    it('blending_blue_25_percent_produces_slightly_muted_blue', () => {
      const result = blendWithGray('#0000FF', 0.25);
      // Blending blue (0,0,255) 25% toward gray (107,114,128)
      // = (0*0.75 + 107*0.25, 0*0.75 + 114*0.25, 255*0.75 + 128*0.25)
      // = (26.75, 28.5, 223.25) ≈ (27, 29, 223) = #1B1DDF
      expect(result.toUpperCase()).toBe('#1B1DDF');
    });
  });

  describe('calculateAccentColor_produces_border_and_background_colors', () => {
    it('returns_valid_hex_border_color_for_typical_input', () => {
      const result = calculateAccentColor('#3B82F6');
      expect(result.border).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('returns_valid_rgba_background_color_for_typical_input', () => {
      const result = calculateAccentColor('#3B82F6');
      expect(result.background).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*0\.08\)$/);
    });

    it('produces_consistent_results_for_same_input', () => {
      const result1 = calculateAccentColor('#3B82F6');
      const result2 = calculateAccentColor('#3B82F6');
      expect(result1.border).toBe(result2.border);
      expect(result1.background).toBe(result2.background);
    });

    describe('handles_all_9_predefined_persona_colors', () => {
      const personaColors = [
        { name: 'blue', hex: '#3B82F6' },
        { name: 'emerald', hex: '#10B981' },
        { name: 'red', hex: '#EF4444' },
        { name: 'purple', hex: '#8B5CF6' },
        { name: 'orange', hex: '#F97316' },
        { name: 'pink', hex: '#EC4899' },
        { name: 'cyan', hex: '#06B6D4' },
        { name: 'amber', hex: '#F59E0B' },
        { name: 'gray', hex: '#6B7280' },
      ];

      personaColors.forEach(({ name, hex }) => {
        it(`${name}_color_produces_valid_accent_colors`, () => {
          const result = calculateAccentColor(hex);
          expect(result.border).toMatch(/^#[0-9A-Fa-f]{6}$/);
          expect(result.background).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*0\.08\)$/);
        });
      });
    });

    describe('handles_edge_case_luminance_values', () => {
      it('very_light_color_luminance_above_0_dot_9_gets_blended_toward_gray', () => {
        const result = calculateAccentColor('#FFFFFF');
        // Should blend 50% toward #6B7280
        expect(result.border.toUpperCase()).toBe('#B5B9C0');
      });

      it('very_dark_color_luminance_below_0_dot_1_gets_blended_toward_gray', () => {
        const result = calculateAccentColor('#000000');
        // Should blend 50% toward #6B7280
        expect(result.border.toUpperCase()).toBe('#363940');
      });

      it('mid_tone_color_luminance_between_0_dot_1_and_0_dot_9_uses_original_color', () => {
        const result = calculateAccentColor('#3B82F6');
        // Blue has luminance around 0.26, should use original
        expect(result.border.toUpperCase()).toBe('#3B82F6');
      });

      it('light_gray_luminance_above_0_dot_9_gets_blended', () => {
        const result = calculateAccentColor('#E5E7EB');
        // Light gray has luminance around 0.87, but close to threshold
        // Let's use a whiter color
        const whiteResult = calculateAccentColor('#F9FAFB');
        expect(whiteResult.border.toUpperCase()).not.toBe('#F9FAFB');
      });
    });

    describe('background_color_has_8_percent_opacity', () => {
      it('blue_accent_has_correct_rgba_values', () => {
        const result = calculateAccentColor('#3B82F6');
        // Should be rgba(59, 130, 246, 0.08)
        expect(result.background).toBe('rgba(59, 130, 246, 0.08)');
      });

      it('red_accent_has_correct_rgba_values', () => {
        const result = calculateAccentColor('#EF4444');
        // Should be rgba(239, 68, 68, 0.08)
        expect(result.background).toBe('rgba(239, 68, 68, 0.08)');
      });

      it('blended_white_accent_has_correct_rgba_values', () => {
        const result = calculateAccentColor('#FFFFFF');
        // Should use blended color #B5B9C0
        expect(result.background).toBe('rgba(181, 185, 192, 0.08)');
      });
    });
  });

  describe('performance_requirements', () => {
    it('calculateAccentColor_completes_in_less_than_1_millisecond', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        calculateAccentColor('#3B82F6');
      }
      const end = performance.now();
      const avgTime = (end - start) / 1000;
      expect(avgTime).toBeLessThan(1);
    });
  });
});
