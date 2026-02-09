import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagInput, TagInputProps } from './TagInput';

describe('tag_input_spec', () => {
  const baseProps: TagInputProps = {
    tags: [],
    allTags: [],
    onAddTag: vi.fn(),
    onRemoveTag: vi.fn(),
    disabled: false,
  };

  describe('tag_display_behavior', () => {
    it('renders_no_tags_when_tags_array_is_empty', () => {
      render(<TagInput {...baseProps} tags={[]} />);
      const tagElements = screen.queryAllByTestId('tag-pill');
      expect(tagElements).toHaveLength(0);
    });

    it('renders_a_single_tag_as_a_pill_with_remove_button', () => {
      render(<TagInput {...baseProps} tags={['feature']} />);
      expect(screen.getByText('feature')).toBeInTheDocument();
      expect(screen.getByTestId('remove-tag-feature')).toBeInTheDocument();
    });

    it('renders_multiple_tags_as_pills_in_order', () => {
      render(<TagInput {...baseProps} tags={['bug', 'urgent', 'backend']} />);
      expect(screen.getByText('bug')).toBeInTheDocument();
      expect(screen.getByText('urgent')).toBeInTheDocument();
      expect(screen.getByText('backend')).toBeInTheDocument();
    });

    it('renders_tags_in_a_single_horizontal_row', () => {
      render(<TagInput {...baseProps} tags={['one', 'two', 'three']} />);
      const container = screen.getByTestId('tag-input-container');
      expect(container.classList.contains('flex-row')).toBe(true);
    });
  });

  describe('add_button_behavior', () => {
    it('displays_a_plus_icon_button_for_adding_tags', () => {
      render(<TagInput {...baseProps} />);
      expect(screen.getByTestId('add-tag-button')).toBeInTheDocument();
    });

    it('add_button_is_enabled_when_less_than_3_tags_exist', () => {
      render(<TagInput {...baseProps} tags={['tag1', 'tag2']} />);
      const addButton = screen.getByTestId('add-tag-button');
      expect(addButton).not.toBeDisabled();
    });

    it('add_button_is_disabled_when_exactly_3_tags_exist', () => {
      render(<TagInput {...baseProps} tags={['tag1', 'tag2', 'tag3']} />);
      const addButton = screen.getByTestId('add-tag-button');
      expect(addButton).toBeDisabled();
    });

    it('add_button_is_disabled_when_more_than_3_tags_exist', () => {
      render(<TagInput {...baseProps} tags={['t1', 't2', 't3', 't4']} />);
      const addButton = screen.getByTestId('add-tag-button');
      expect(addButton).toBeDisabled();
    });

    it('add_button_is_disabled_when_disabled_prop_is_true', () => {
      render(<TagInput {...baseProps} disabled={true} />);
      const addButton = screen.getByTestId('add-tag-button');
      expect(addButton).toBeDisabled();
    });
  });

  describe('popover_interaction', () => {
    it('popover_opens_when_add_button_is_clicked', async () => {
      render(<TagInput {...baseProps} />);
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      expect(screen.getByTestId('tag-popover-content')).toBeInTheDocument();
    });

    it('popover_contains_a_single_text_input_field', async () => {
      render(<TagInput {...baseProps} />);
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      const input = screen.getByTestId('tag-input-field');
      expect(input.tagName.toLowerCase()).toBe('input');
      expect(input.getAttribute('type')).toBe('text');
    });

    it('input_field_has_placeholder_text', async () => {
      render(<TagInput {...baseProps} />);
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      const input = screen.getByTestId('tag-input-field');
      expect(input.getAttribute('placeholder')).toBeTruthy();
    });
  });

  describe('tag_submission_via_enter_key', () => {
    it('calls_onAddTag_when_enter_is_pressed_with_valid_input', async () => {
      const onAddTag = vi.fn();
      render(<TagInput {...baseProps} onAddTag={onAddTag} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field');
      await userEvent.type(input, 'newtag');
      await userEvent.keyboard('{Enter}');
      
      expect(onAddTag).toHaveBeenCalledWith('newtag');
    });

    it('closes_popover_after_successful_tag_addition', async () => {
      const onAddTag = vi.fn();
      render(<TagInput {...baseProps} onAddTag={onAddTag} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field');
      await userEvent.type(input, 'newtag');
      await userEvent.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.queryByTestId('tag-popover-content')).not.toBeInTheDocument();
      });
    });

    it('input_is_cleared_after_successful_submission', async () => {
      const onAddTag = vi.fn();
      render(<TagInput {...baseProps} onAddTag={onAddTag} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field') as HTMLInputElement;
      await userEvent.type(input, 'newtag');
      await userEvent.keyboard('{Enter}');
      
      // Reopen popover to check input is cleared
      await userEvent.click(addButton);
      const newInput = screen.getByTestId('tag-input-field') as HTMLInputElement;
      expect(newInput.value).toBe('');
    });
  });

  describe('validation_error_display', () => {
    it('displays_error_when_input_is_empty', async () => {
      const onAddTag = vi.fn();
      render(<TagInput {...baseProps} onAddTag={onAddTag} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field');
      await userEvent.keyboard('{Enter}');
      
      expect(screen.getByTestId('tag-error-message')).toBeInTheDocument();
      expect(screen.getByText(/empty/i)).toBeInTheDocument();
      expect(onAddTag).not.toHaveBeenCalled();
    });

    it('displays_error_when_input_is_whitespace_only', async () => {
      const onAddTag = vi.fn();
      render(<TagInput {...baseProps} onAddTag={onAddTag} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field');
      await userEvent.type(input, '   ');
      await userEvent.keyboard('{Enter}');
      
      expect(screen.getByTestId('tag-error-message')).toBeInTheDocument();
      expect(onAddTag).not.toHaveBeenCalled();
    });

    it('displays_error_when_input_exceeds_20_characters', async () => {
      const onAddTag = vi.fn();
      render(<TagInput {...baseProps} onAddTag={onAddTag} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field');
      await userEvent.type(input, 'this-is-a-very-long-tag-name');
      await userEvent.keyboard('{Enter}');
      
      expect(screen.getByTestId('tag-error-message')).toBeInTheDocument();
      expect(screen.getByText(/20 characters/i)).toBeInTheDocument();
      expect(onAddTag).not.toHaveBeenCalled();
    });

    it('displays_error_when_tag_already_exists_case_insensitive', async () => {
      const onAddTag = vi.fn();
      render(<TagInput {...baseProps} tags={['Feature']} onAddTag={onAddTag} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field');
      await userEvent.type(input, 'feature');
      await userEvent.keyboard('{Enter}');
      
      expect(screen.getByTestId('tag-error-message')).toBeInTheDocument();
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      expect(onAddTag).not.toHaveBeenCalled();
    });

    it('clears_error_when_user_types_after_error', async () => {
      const onAddTag = vi.fn();
      render(<TagInput {...baseProps} onAddTag={onAddTag} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field');
      await userEvent.keyboard('{Enter}');
      
      expect(screen.getByTestId('tag-error-message')).toBeInTheDocument();
      
      await userEvent.type(input, 'a');
      
      await waitFor(() => {
        expect(screen.queryByTestId('tag-error-message')).not.toBeInTheDocument();
      });
    });
  });

  describe('tag_removal', () => {
    it('calls_onRemoveTag_when_X_icon_is_clicked', async () => {
      const onRemoveTag = vi.fn();
      render(<TagInput {...baseProps} tags={['removable']} onRemoveTag={onRemoveTag} />);
      
      const removeButton = screen.getByTestId('remove-tag-removable');
      await userEvent.click(removeButton);
      
      expect(onRemoveTag).toHaveBeenCalledWith('removable');
    });

    it('each_tag_has_its_own_remove_button', async () => {
      const onRemoveTag = vi.fn();
      render(<TagInput {...baseProps} tags={['one', 'two']} onRemoveTag={onRemoveTag} />);
      
      const removeOne = screen.getByTestId('remove-tag-one');
      const removeTwo = screen.getByTestId('remove-tag-two');
      
      await userEvent.click(removeOne);
      expect(onRemoveTag).toHaveBeenCalledWith('one');
      
      await userEvent.click(removeTwo);
      expect(onRemoveTag).toHaveBeenCalledWith('two');
    });
  });

  describe('autocomplete_behavior', () => {
    it('displays_matching_tags_when_user_types_in_input', async () => {
      const allTags = [
        { id: 1, name: 'feature', createdAt: '2026-01-01' },
        { id: 2, name: 'frontend', createdAt: '2026-01-01' },
        { id: 3, name: 'backend', createdAt: '2026-01-01' },
      ];
      
      render(<TagInput {...baseProps} allTags={allTags} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field');
      await userEvent.type(input, 'feat');
      
      expect(screen.getByTestId('autocomplete-dropdown')).toBeInTheDocument();
      expect(screen.getByText('feature')).toBeInTheDocument();
    });

    it('does_not_display_already_assigned_tags_in_autocomplete', async () => {
      const allTags = [
        { id: 1, name: 'feature', createdAt: '2026-01-01' },
        { id: 2, name: 'bug', createdAt: '2026-01-01' },
      ];
      
      render(<TagInput {...baseProps} allTags={allTags} tags={['feature']} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field');
      await userEvent.type(input, 'feat');
      
      // When the only matching tag is already assigned, no dropdown should appear
      expect(screen.queryByTestId('autocomplete-dropdown')).not.toBeInTheDocument();
    });

    it('clicking_an_autocomplete_option_adds_the_tag', async () => {
      const allTags = [
        { id: 1, name: 'feature', createdAt: '2026-01-01' },
      ];
      const onAddTag = vi.fn();
      
      render(<TagInput {...baseProps} allTags={allTags} onAddTag={onAddTag} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field');
      await userEvent.type(input, 'feat');
      
      const option = screen.getByText('feature');
      await userEvent.click(option);
      
      expect(onAddTag).toHaveBeenCalledWith('feature');
    });
  });

  describe('visual_styling', () => {
    it('uses_badge_component_for_tag_pills', () => {
      render(<TagInput {...baseProps} tags={['styled']} />);
      const tagPill = screen.getByTestId('tag-pill-styled');
      expect(tagPill.getAttribute('data-slot')).toBe('badge');
    });

    it('add_button_has_accessible_label', () => {
      render(<TagInput {...baseProps} />);
      const addButton = screen.getByTestId('add-tag-button');
      expect(addButton.getAttribute('aria-label')).toContain('tag');
    });

    it('remove_buttons_have_accessible_labels', () => {
      render(<TagInput {...baseProps} tags={['removable']} />);
      const removeButton = screen.getByTestId('remove-tag-removable');
      expect(removeButton.getAttribute('aria-label')).toContain('removable');
    });
  });

  describe('edge_cases', () => {
    it('handles_tags_with_special_characters', () => {
      render(<TagInput {...baseProps} tags={['bug-fix', 'v1.0_test', 'space here']} />);
      expect(screen.getByText('bug-fix')).toBeInTheDocument();
      expect(screen.getByText('v1.0_test')).toBeInTheDocument();
      expect(screen.getByText('space here')).toBeInTheDocument();
    });

    it('handles_tags_with_emojis', () => {
      render(<TagInput {...baseProps} tags={['🚀 launch']} />);
      expect(screen.getByText('🚀 launch')).toBeInTheDocument();
    });

    it('trims_whitespace_from_input_before_validation', async () => {
      const onAddTag = vi.fn();
      render(<TagInput {...baseProps} onAddTag={onAddTag} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field');
      await userEvent.type(input, '  trimmed  ');
      await userEvent.keyboard('{Enter}');
      
      expect(onAddTag).toHaveBeenCalledWith('trimmed');
    });

    it('accepts_exactly_20_character_tags', async () => {
      const onAddTag = vi.fn();
      render(<TagInput {...baseProps} onAddTag={onAddTag} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field');
      await userEvent.type(input, 'a'.repeat(20));
      await userEvent.keyboard('{Enter}');
      
      expect(onAddTag).toHaveBeenCalledWith('a'.repeat(20));
      expect(screen.queryByTestId('tag-error-message')).not.toBeInTheDocument();
    });

    it('rejects_21_character_tags', async () => {
      const onAddTag = vi.fn();
      render(<TagInput {...baseProps} onAddTag={onAddTag} />);
      
      const addButton = screen.getByTestId('add-tag-button');
      await userEvent.click(addButton);
      
      const input = screen.getByTestId('tag-input-field');
      await userEvent.type(input, 'a'.repeat(21));
      await userEvent.keyboard('{Enter}');
      
      expect(onAddTag).not.toHaveBeenCalled();
      expect(screen.getByTestId('tag-error-message')).toBeInTheDocument();
    });

  });
});
