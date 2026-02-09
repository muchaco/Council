import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagDisplay, TagDisplayProps } from './TagDisplay';

describe('tag_display_spec', () => {
  const baseProps: TagDisplayProps = {
    tags: [],
    variant: 'editable',
  };

  describe('empty_state', () => {
    it('renders_nothing_when_tags_array_is_empty', () => {
      const { container } = render(<TagDisplay {...baseProps} tags={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns_null_when_tags_is_undefined', () => {
      const { container } = render(<TagDisplay {...baseProps} tags={undefined as unknown as string[]} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('single_tag_rendering', () => {
    it('renders_a_single_tag_as_a_badge', () => {
      render(<TagDisplay {...baseProps} tags={['single']} />);
      expect(screen.getByText('single')).toBeInTheDocument();
    });

    it('uses_badge_component_for_tag_styling', () => {
      render(<TagDisplay {...baseProps} tags={['styled']} />);
      const tagBadge = screen.getByTestId('tag-badge-styled');
      expect(tagBadge.getAttribute('data-slot')).toBe('badge');
    });
  });

  describe('multiple_tags_rendering', () => {
    it('renders_all_tags_in_the_array', () => {
      render(<TagDisplay {...baseProps} tags={['one', 'two', 'three']} />);
      expect(screen.getByText('one')).toBeInTheDocument();
      expect(screen.getByText('two')).toBeInTheDocument();
      expect(screen.getByText('three')).toBeInTheDocument();
    });

    it('preserves_tag_order_from_input_array', () => {
      const { container } = render(<TagDisplay {...baseProps} tags={['first', 'second', 'third']} />);
      const badges = container.querySelectorAll('[data-slot="badge"]');
      expect(badges[0].textContent).toContain('first');
      expect(badges[1].textContent).toContain('second');
      expect(badges[2].textContent).toContain('third');
    });
  });

  describe('horizontal_layout', () => {
    it('renders_tags_in_a_single_horizontal_row', () => {
      render(<TagDisplay {...baseProps} tags={['one', 'two', 'three']} />);
      const container = screen.getByTestId('tag-display-container');
      expect(container.classList.contains('flex-row')).toBe(true);
    });

    it('uses_flexbox_layout', () => {
      render(<TagDisplay {...baseProps} tags={['test']} />);
      const container = screen.getByTestId('tag-display-container');
      expect(container.classList.contains('flex')).toBe(true);
    });

    it('does_not_wrap_tags_to_new_lines', () => {
      render(<TagDisplay {...baseProps} tags={['one', 'two', 'three']} />);
      const container = screen.getByTestId('tag-display-container');
      expect(container.classList.contains('flex-nowrap')).toBe(true);
    });
  });

  describe('editable_variant', () => {
    it('displays_X_icon_on_each_tag_when_variant_is_editable', () => {
      render(<TagDisplay {...baseProps} tags={['removable']} variant="editable" />);
      expect(screen.getByTestId('remove-tag-removable')).toBeInTheDocument();
    });

    it('calls_onRemoveTag_when_X_icon_is_clicked', async () => {
      const onRemoveTag = vi.fn();
      render(
        <TagDisplay 
          {...baseProps} 
          tags={['removable']} 
          variant="editable" 
          onRemoveTag={onRemoveTag} 
        />
      );
      
      const removeButton = screen.getByTestId('remove-tag-removable');
      await userEvent.click(removeButton);
      
      expect(onRemoveTag).toHaveBeenCalledWith('removable');
    });

    it('each_editable_tag_has_its_own_remove_button', async () => {
      const onRemoveTag = vi.fn();
      render(
        <TagDisplay 
          {...baseProps} 
          tags={['one', 'two']} 
          variant="editable" 
          onRemoveTag={onRemoveTag} 
        />
      );
      
      const removeOne = screen.getByTestId('remove-tag-one');
      const removeTwo = screen.getByTestId('remove-tag-two');
      
      expect(removeOne).toBeInTheDocument();
      expect(removeTwo).toBeInTheDocument();
      
      await userEvent.click(removeOne);
      expect(onRemoveTag).toHaveBeenCalledWith('one');
      
      await userEvent.click(removeTwo);
      expect(onRemoveTag).toHaveBeenCalledWith('two');
    });

    it('remove_buttons_have_accessible_labels', () => {
      render(<TagDisplay {...baseProps} tags={['tag1']} variant="editable" />);
      const removeButton = screen.getByTestId('remove-tag-tag1');
      expect(removeButton.getAttribute('aria-label')).toContain('tag1');
    });

    it('does_not_call_onRemoveTag_if_callback_not_provided', async () => {
      render(<TagDisplay {...baseProps} tags={['tag1']} variant="editable" />);
      const removeButton = screen.getByTestId('remove-tag-tag1');
      
      // Should not throw when clicked without onRemoveTag
      await expect(userEvent.click(removeButton)).resolves.not.toThrow();
    });
  });

  describe('readonly_variant', () => {
    it('does_not_display_X_icon_when_variant_is_readonly', () => {
      render(<TagDisplay {...baseProps} tags={['static']} variant="readonly" />);
      expect(screen.queryByTestId('remove-tag-static')).not.toBeInTheDocument();
    });

    it('still_renders_all_tags_in_readonly_mode', () => {
      render(<TagDisplay {...baseProps} tags={['one', 'two']} variant="readonly" />);
      expect(screen.getByText('one')).toBeInTheDocument();
      expect(screen.getByText('two')).toBeInTheDocument();
    });

    it('uses_same_badge_styling_in_readonly_mode', () => {
      render(<TagDisplay {...baseProps} tags={['styled']} variant="readonly" />);
      const tagBadge = screen.getByTestId('tag-badge-styled');
      expect(tagBadge.getAttribute('data-slot')).toBe('badge');
    });

    it('ignores_onRemoveTag_callback_in_readonly_mode', () => {
      const onRemoveTag = vi.fn();
      render(
        <TagDisplay 
          {...baseProps} 
          tags={['static']} 
          variant="readonly" 
          onRemoveTag={onRemoveTag} 
        />
      );
      
      // No remove button should exist to click
      expect(screen.queryByTestId('remove-tag-static')).not.toBeInTheDocument();
    });
  });

  describe('tag_content_handling', () => {
    it('handles_tags_with_special_characters', () => {
      render(<TagDisplay {...baseProps} tags={['bug-fix', 'v1.0_test', 'space here']} />);
      expect(screen.getByText('bug-fix')).toBeInTheDocument();
      expect(screen.getByText('v1.0_test')).toBeInTheDocument();
      expect(screen.getByText('space here')).toBeInTheDocument();
    });

    it('handles_tags_with_emojis', () => {
      render(<TagDisplay {...baseProps} tags={['🚀 launch', '🐛 bug']} />);
      expect(screen.getByText('🚀 launch')).toBeInTheDocument();
      expect(screen.getByText('🐛 bug')).toBeInTheDocument();
    });

    it('handles_tags_with_numbers', () => {
      render(<TagDisplay {...baseProps} tags={['v2.0', '2024', 'item-123']} />);
      expect(screen.getByText('v2.0')).toBeInTheDocument();
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('item-123')).toBeInTheDocument();
    });

    it('handles_long_tags_up_to_20_characters', () => {
      const longTag = 'a'.repeat(20);
      render(<TagDisplay {...baseProps} tags={[longTag]} />);
      expect(screen.getByText(longTag)).toBeInTheDocument();
    });
  });

  describe('styling_consistency', () => {
    it('uses_secondary_variant_for_badges', () => {
      render(<TagDisplay {...baseProps} tags={['styled']} />);
      const tagBadge = screen.getByTestId('tag-badge-styled');
      // Check for secondary variant class
      expect(tagBadge.className).toContain('secondary');
    });

    it('maintains_consistent_gap_between_tags', () => {
      render(<TagDisplay {...baseProps} tags={['one', 'two']} />);
      const container = screen.getByTestId('tag-display-container');
      expect(container.classList.contains('gap-2')).toBe(true);
    });

    it('tags_are_not_clickable_except_for_remove_button', () => {
      render(<TagDisplay {...baseProps} tags={['static']} variant="readonly" />);
      const tagBadge = screen.getByTestId('tag-badge-static');
      expect(tagBadge.getAttribute('role')).not.toBe('button');
    });
  });

  describe('edge_cases', () => {
    it('handles_single_character_tags', () => {
      render(<TagDisplay {...baseProps} tags={['a', 'b', 'c']} />);
      expect(screen.getByText('a')).toBeInTheDocument();
      expect(screen.getByText('b')).toBeInTheDocument();
      expect(screen.getByText('c')).toBeInTheDocument();
    });

    it('handles_duplicate_tags_in_input_array', () => {
      // Though this shouldn't happen in practice, component should handle it gracefully
      render(<TagDisplay {...baseProps} tags={['dup', 'dup', 'dup']} />);
      const badges = screen.getAllByText('dup');
      expect(badges).toHaveLength(3);
    });

    it('handles_empty_string_tags', () => {
      render(<TagDisplay {...baseProps} tags={['']} />);
      expect(screen.getByTestId('tag-badge-')).toBeInTheDocument();
    });

    it('handles_maximum_of_3_tags', () => {
      render(<TagDisplay {...baseProps} tags={['one', 'two', 'three']} />);
      expect(screen.getByText('one')).toBeInTheDocument();
      expect(screen.getByText('two')).toBeInTheDocument();
      expect(screen.getByText('three')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('container_has_proper_semantic_structure', () => {
      render(<TagDisplay {...baseProps} tags={['accessible']} />);
      const container = screen.getByTestId('tag-display-container');
      expect(container.tagName.toLowerCase()).toBe('div');
    });

    it('editable_remove_buttons_are_focusable', () => {
      render(<TagDisplay {...baseProps} tags={['focusable']} variant="editable" />);
      const removeButton = screen.getByTestId('remove-tag-focusable');
      expect(removeButton.tagName.toLowerCase()).toBe('button');
    });
  });
});
