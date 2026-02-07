import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble, MessageBubbleProps } from './MessageBubble';
import { calculateAccentColor, hexToHSL } from '@/lib/colors';

describe('message_bubble_spec', () => {
  const baseProps: MessageBubbleProps = {
    content: 'Hello, this is a test message',
    senderName: 'Test Persona',
    timestamp: '2026-02-07T10:30:00.000Z',
    isUser: false,
    isOrchestrator: false,
  };

  // Helper to convert hex to RGB string for comparison with computed styles
  function hexToRgb(hex: string): string {
    const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
    const r = parseInt(normalized.substring(0, 2), 16);
    const g = parseInt(normalized.substring(2, 4), 16);
    const b = parseInt(normalized.substring(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
  }

  describe('a_message_renders_with_sender_information', () => {
    it('displays_the_sender_name', () => {
      render(<MessageBubble {...baseProps} senderName="Alice" />);
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('displays_the_timestamp_in_locale_time_format', () => {
      render(<MessageBubble {...baseProps} timestamp="2026-02-07T14:30:00.000Z" />);
      const timeRegex = /\d{1,2}:\d{2}/;
      expect(screen.getByText(timeRegex)).toBeInTheDocument();
    });

    it('displays_the_message_content', () => {
      render(<MessageBubble {...baseProps} content="This is the message content" />);
      expect(screen.getByText('This is the message content')).toBeInTheDocument();
    });
  });

  describe('a_user_message_uses_primary_styling', () => {
    it('applies_bg_primary_class', () => {
      render(<MessageBubble {...baseProps} isUser={true} />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.classList.contains('bg-primary')).toBe(true);
    });

    it('applies_text_primary_foreground_class', () => {
      render(<MessageBubble {...baseProps} isUser={true} />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.classList.contains('text-primary-foreground')).toBe(true);
    });

    it('ignores_accent_color_even_when_provided', () => {
      render(<MessageBubble {...baseProps} isUser={true} accentColor="#3B82F6" />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.style.borderLeft).toBe('');
      expect(bubble.style.backgroundColor).toBe('');
    });
  });

  describe('an_intervention_message_uses_secondary_styling', () => {
    it('applies_bg_secondary_class', () => {
      render(<MessageBubble {...baseProps} isIntervention={true} />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.classList.contains('bg-secondary')).toBe(true);
    });

    it('applies_border_class', () => {
      render(<MessageBubble {...baseProps} isIntervention={true} />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.classList.contains('border')).toBe(true);
    });

    it('displays_intervention_badge', () => {
      render(<MessageBubble {...baseProps} isIntervention={true} />);
      expect(screen.getByText('Intervention')).toBeInTheDocument();
    });

    it('ignores_accent_color_even_when_provided', () => {
      render(<MessageBubble {...baseProps} isIntervention={true} accentColor="#3B82F6" />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.style.borderLeft).toBe('');
      expect(bubble.style.backgroundColor).toBe('');
    });
  });

  describe('an_orchestrator_message_uses_neutral_styling', () => {
    it('applies_bg_card_class', () => {
      render(<MessageBubble {...baseProps} isOrchestrator={true} />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.classList.contains('bg-card')).toBe(true);
    });

    it('applies_border_class', () => {
      render(<MessageBubble {...baseProps} isOrchestrator={true} />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.classList.contains('border')).toBe(true);
    });

    it('ignores_accent_color_even_when_provided', () => {
      render(<MessageBubble {...baseProps} isOrchestrator={true} accentColor="#3B82F6" />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.style.borderLeft).toBe('');
      expect(bubble.style.backgroundColor).toBe('');
    });
  });

  describe('a_persona_message_with_accent_color_applies_styling', () => {
    it('applies_left_border_with_accent_color', () => {
      render(<MessageBubble {...baseProps} accentColor="#3B82F6" />);
      const bubble = screen.getByTestId('message-bubble');
      const expectedRgb = hexToRgb('3B82F6');
      expect(bubble.style.borderLeft).toBe(`3px solid ${expectedRgb}`);
    });

    it('applies_background_tint_at_8_percent_opacity', () => {
      render(<MessageBubble {...baseProps} accentColor="#3B82F6" />);
      const bubble = screen.getByTestId('message-bubble');
      const expectedBackground = calculateAccentColor('#3B82F6').background;
      expect(bubble.style.backgroundColor).toBe(expectedBackground);
    });

    it('applies_border_class_for_base_styling', () => {
      render(<MessageBubble {...baseProps} accentColor="#3B82F6" />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.classList.contains('border')).toBe(true);
    });

    const personaColors = [
      { name: 'Blue', color: '#3B82F6' },
      { name: 'Emerald', color: '#10B981' },
      { name: 'Red', color: '#EF4444' },
      { name: 'Purple', color: '#8B5CF6' },
      { name: 'Orange', color: '#F97316' },
      { name: 'Pink', color: '#EC4899' },
      { name: 'Cyan', color: '#06B6D4' },
      { name: 'Amber', color: '#F59E0B' },
      { name: 'Gray', color: '#6B7280' },
    ];

    personaColors.forEach(({ name, color }) => {
      it(`applies_correct_styling_for_${name.toLowerCase()}_color`, () => {
        render(<MessageBubble {...baseProps} accentColor={color} />);
        const bubble = screen.getByTestId('message-bubble');
        const accentColors = calculateAccentColor(color);
        const expectedRgb = hexToRgb(accentColors.border.slice(1)); // Remove # prefix
        expect(bubble.style.borderLeft).toBe(`3px solid ${expectedRgb}`);
        expect(bubble.style.backgroundColor).toBe(accentColors.background);
      });
    });
  });

  describe('a_persona_message_without_accent_color_uses_neutral_styling', () => {
    it('applies_bg_card_class', () => {
      render(<MessageBubble {...baseProps} accentColor={undefined} />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.classList.contains('bg-card')).toBe(true);
    });

    it('applies_border_class', () => {
      render(<MessageBubble {...baseProps} accentColor={undefined} />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.classList.contains('border')).toBe(true);
    });

    it('has_no_inline_border_style', () => {
      render(<MessageBubble {...baseProps} accentColor={undefined} />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.style.borderLeft).toBe('');
    });

    it('has_no_inline_background_style', () => {
      render(<MessageBubble {...baseProps} accentColor={undefined} />);
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.style.backgroundColor).toBe('');
    });
  });

  describe('edge_cases', () => {
    it('handles_very_light_colors_by_blending_toward_gray', () => {
      render(<MessageBubble {...baseProps} accentColor="#FFFFFF" />);
      const bubble = screen.getByTestId('message-bubble');
      const accentColors = calculateAccentColor('#FFFFFF');
      const expectedRgb = hexToRgb(accentColors.border.slice(1));
      expect(bubble.style.borderLeft).toBe(`3px solid ${expectedRgb}`);
      expect(bubble.style.backgroundColor).toBe(accentColors.background);
    });

    it('handles_very_dark_colors_by_blending_toward_gray', () => {
      render(<MessageBubble {...baseProps} accentColor="#000000" />);
      const bubble = screen.getByTestId('message-bubble');
      const accentColors = calculateAccentColor('#000000');
      const expectedRgb = hexToRgb(accentColors.border.slice(1));
      expect(bubble.style.borderLeft).toBe(`3px solid ${expectedRgb}`);
      expect(bubble.style.backgroundColor).toBe(accentColors.background);
    });

    it('handles_short_hex_format', () => {
      render(<MessageBubble {...baseProps} accentColor="#F00" />);
      const bubble = screen.getByTestId('message-bubble');
      const expectedRgb = hexToRgb('FF0000');
      expect(bubble.style.borderLeft).toBe(`3px solid ${expectedRgb}`);
    });

    it('handles_hex_without_hash_prefix', () => {
      render(<MessageBubble {...baseProps} accentColor="3B82F6" />);
      const bubble = screen.getByTestId('message-bubble');
      const expectedRgb = hexToRgb('3B82F6');
      expect(bubble.style.borderLeft).toBe(`3px solid ${expectedRgb}`);
    });
  });

  describe('accessibility', () => {
    it('maintains_structural_markup_for_screen_readers', () => {
      render(<MessageBubble {...baseProps} />);
      expect(screen.getByText(baseProps.content)).toBeInTheDocument();
      expect(screen.getByText(baseProps.senderName)).toBeInTheDocument();
    });
  });
});
