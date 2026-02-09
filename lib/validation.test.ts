import { describe, it, expect } from 'vitest';
import { validateTagInput, canAddTag, sanitizeTag } from './validation';

describe('tag_validation_spec', () => {
  describe('a_tag_is_valid_when', () => {
    it('input_is_alphanumeric', () => {
      const result = validateTagInput('feature', []);
      expect(result.valid).toBe(true);
      expect(result.normalizedTag).toBe('feature');
    });

    it('input_contains_hyphens', () => {
      const result = validateTagInput('bug-fix', []);
      expect(result.valid).toBe(true);
      expect(result.normalizedTag).toBe('bug-fix');
    });

    it('input_contains_underscores', () => {
      const result = validateTagInput('ai_research', []);
      expect(result.valid).toBe(true);
      expect(result.normalizedTag).toBe('ai_research');
    });

    it('input_contains_spaces', () => {
      const result = validateTagInput('machine learning', []);
      expect(result.valid).toBe(true);
      expect(result.normalizedTag).toBe('machine learning');
    });

    it('input_contains_emojis', () => {
      const result = validateTagInput('🚀 launch', []);
      expect(result.valid).toBe(true);
      expect(result.normalizedTag).toBe('🚀 launch');
    });

    it('input_is_exactly_20_characters', () => {
      const result = validateTagInput('a'.repeat(20), []);
      expect(result.valid).toBe(true);
      expect(result.normalizedTag).toBe('a'.repeat(20));
    });

    it('input_has_leading_and_trailing_whitespace', () => {
      const result = validateTagInput('  feature  ', []);
      expect(result.valid).toBe(true);
      expect(result.normalizedTag).toBe('feature');
    });

    it('input_is_uppercase', () => {
      const result = validateTagInput('FEATURE', []);
      expect(result.valid).toBe(true);
      expect(result.normalizedTag).toBe('feature');
    });

    it('input_is_mixed_case', () => {
      const result = validateTagInput('FeatureTag', []);
      expect(result.valid).toBe(true);
      expect(result.normalizedTag).toBe('featuretag');
    });
  });

  describe('a_tag_is_invalid_when', () => {
    it('input_is_empty_string', () => {
      const result = validateTagInput('', []);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Tag cannot be empty');
    });

    it('input_is_only_whitespace', () => {
      const result = validateTagInput('   ', []);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Tag cannot be empty');
    });

    it('input_exceeds_20_characters', () => {
      const result = validateTagInput('a'.repeat(21), []);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Tag must be 20 characters or less');
    });

    it('input_is_duplicate_of_existing_tag', () => {
      const result = validateTagInput('feature', ['feature']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Tag already exists');
    });

    it('input_is_duplicate_case_insensitive', () => {
      const result = validateTagInput('FEATURE', ['feature']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Tag already exists');
    });

    it('input_is_duplicate_after_normalization', () => {
      const result = validateTagInput('  Feature  ', ['feature']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Tag already exists');
    });
  });
});

describe('can_add_tag_spec', () => {
  describe('a_tag_can_be_added_when', () => {
    it('session_has_zero_tags', () => {
      expect(canAddTag([])).toBe(true);
    });

    it('session_has_one_tag', () => {
      expect(canAddTag(['feature'])).toBe(true);
    });

    it('session_has_two_tags', () => {
      expect(canAddTag(['feature', 'bug'])).toBe(true);
    });
  });

  describe('a_tag_cannot_be_added_when', () => {
    it('session_has_three_tags', () => {
      expect(canAddTag(['feature', 'bug', 'urgent'])).toBe(false);
    });

    it('session_has_more_than_three_tags', () => {
      expect(canAddTag(['a', 'b', 'c', 'd'])).toBe(false);
    });
  });
});

describe('sanitize_tag_spec', () => {
  describe('tag_is_sanitized_to_lowercase', () => {
    it('uppercase_input', () => {
      expect(sanitizeTag('FEATURE')).toBe('feature');
    });

    it('mixed_case_input', () => {
      expect(sanitizeTag('FeatureTag')).toBe('featuretag');
    });
  });

  describe('tag_is_trimmed_of_whitespace', () => {
    it('leading_whitespace', () => {
      expect(sanitizeTag('  feature')).toBe('feature');
    });

    it('trailing_whitespace', () => {
      expect(sanitizeTag('feature  ')).toBe('feature');
    });

    it('both_leading_and_trailing_whitespace', () => {
      expect(sanitizeTag('  feature  ')).toBe('feature');
    });
  });

  describe('special_characters_are_preserved', () => {
    it('hyphens', () => {
      expect(sanitizeTag('bug-fix')).toBe('bug-fix');
    });

    it('underscores', () => {
      expect(sanitizeTag('ai_research')).toBe('ai_research');
    });

    it('spaces', () => {
      expect(sanitizeTag('machine learning')).toBe('machine learning');
    });

    it('emojis', () => {
      expect(sanitizeTag('🚀 launch')).toBe('🚀 launch');
    });
  });
});
