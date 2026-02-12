import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagDisplay, type TagDisplayProps } from './TagDisplay';

const baseProps: TagDisplayProps = {
  tags: [],
  variant: 'editable',
};

describe('tag_display_spec', () => {
  describe('empty_tag_states', () => {
    it.each([
      { label: 'empty_array', tags: [] as string[] },
      { label: 'undefined_tags', tags: undefined as unknown as string[] },
    ])('renders_nothing_when_tags_are_$label', ({ tags }) => {
      const { container } = render(<TagDisplay {...baseProps} tags={tags} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('tag_list_rendering', () => {
    it('renders_all_tags_in_the_original_input_order', () => {
      const { container } = render(<TagDisplay {...baseProps} tags={['first', 'second', 'third']} />);

      const badges = container.querySelectorAll('[data-slot="badge"]');
      expect(badges).toHaveLength(3);
      expect(badges[0].textContent).toContain('first');
      expect(badges[1].textContent).toContain('second');
      expect(badges[2].textContent).toContain('third');
    });

    it.each([
      { tags: ['bug-fix', 'v1.0_test', 'space here'] },
      { tags: ['🚀 launch', '🐛 bug'] },
      { tags: ['v2.0', '2024', 'item-123'] },
      { tags: ['a'.repeat(20)] },
      { tags: ['a', 'b', 'c'] },
      { tags: [''] },
    ])('renders_special_or_boundary_tag_values %j', ({ tags }) => {
      render(<TagDisplay {...baseProps} tags={tags} />);

      tags.forEach((tag: string) => {
        expect(screen.getAllByText(tag).length).toBeGreaterThan(0);
      });
    });
  });

  describe('layout_and_badge_contract', () => {
    it('renders_a_single_horizontal_non_wrapping_row', () => {
      render(<TagDisplay {...baseProps} tags={['one', 'two', 'three']} />);
      const container = screen.getByTestId('tag-display-container');

      expect(container.className).toContain('flex');
      expect(container.className).toContain('flex-row');
      expect(container.className).toContain('flex-nowrap');
      expect(container.className).toContain('gap-2');
    });

    it('uses_secondary_badges_for_tags', () => {
      render(<TagDisplay {...baseProps} tags={['styled']} />);
      const tagBadge = screen.getByTestId('tag-badge-styled');

      expect(tagBadge.getAttribute('data-slot')).toBe('badge');
      expect(tagBadge.className).toContain('secondary');
      expect(tagBadge.getAttribute('role')).not.toBe('button');
    });
  });

  describe('editable_and_readonly_behavior', () => {
    it('calls_onRemoveTag_with_the_clicked_tag_in_editable_mode', async () => {
      const onRemoveTag = vi.fn();
      render(<TagDisplay {...baseProps} tags={['one', 'two']} variant="editable" onRemoveTag={onRemoveTag} />);

      await userEvent.click(screen.getByTestId('remove-tag-one'));
      await userEvent.click(screen.getByTestId('remove-tag-two'));

      expect(onRemoveTag).toHaveBeenNthCalledWith(1, 'one');
      expect(onRemoveTag).toHaveBeenNthCalledWith(2, 'two');
    });

    it('does_not_throw_when_remove_is_clicked_without_a_callback', async () => {
      render(<TagDisplay {...baseProps} tags={['tag1']} variant="editable" />);

      await expect(userEvent.click(screen.getByTestId('remove-tag-tag1'))).resolves.not.toThrow();
    });

    it('renders_remove_controls_only_in_editable_mode', () => {
      const { rerender } = render(<TagDisplay {...baseProps} tags={['static']} variant="editable" />);
      expect(screen.getByTestId('remove-tag-static')).toBeInTheDocument();
      expect(screen.getByTestId('remove-tag-static').getAttribute('aria-label')).toContain('static');

      rerender(<TagDisplay {...baseProps} tags={['static']} variant="readonly" />);
      expect(screen.queryByTestId('remove-tag-static')).not.toBeInTheDocument();
    });
  });

  describe('accessibility_basics', () => {
    it('uses_a_div_container_and_button_controls_for_remove_actions', () => {
      render(<TagDisplay {...baseProps} tags={['focusable']} variant="editable" />);

      expect(screen.getByTestId('tag-display-container').tagName.toLowerCase()).toBe('div');
      expect(screen.getByTestId('remove-tag-focusable').tagName.toLowerCase()).toBe('button');
    });
  });
});
