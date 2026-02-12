import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble, type MessageBubbleProps } from './MessageBubble';
import { calculateAccentColor } from '@/lib/colors';

const baseProps: MessageBubbleProps = {
  content: 'Hello, this is a test message',
  senderName: 'Test Persona',
  timestamp: '2026-02-07T10:30:00.000Z',
  isUser: false,
  isConductor: false,
};

function hexToRgb(hex: string): string {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

describe('message_bubble_spec', () => {
  describe('message_identity_rendering', () => {
    it('shows_the_sender_name_content_and_time', () => {
      render(<MessageBubble {...baseProps} senderName="Alice" content="A test payload" />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('A test payload')).toBeInTheDocument();
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    });
  });

  describe('accent_rules_by_message_type', () => {
    it.each([
      {
        messageType: 'user',
        props: { isUser: true, isConductor: false, isIntervention: false as const, accentColor: '#3B82F6' },
        expectedClass: 'bg-primary',
      },
      {
        messageType: 'conductor',
        props: { isUser: false, isConductor: true, isIntervention: false as const, accentColor: '#3B82F6' },
        expectedClass: 'bg-card',
      },
      {
        messageType: 'intervention',
        props: { isUser: false, isConductor: false, isIntervention: true as const, accentColor: '#3B82F6' },
        expectedClass: 'bg-secondary',
      },
    ])(
      'does_not_apply_accent_styles_for_$messageType_messages',
      ({ props, expectedClass }) => {
        render(<MessageBubble {...baseProps} {...props} />);

        const bubble = screen.getByTestId('message-bubble');
        expect(bubble.className).toContain(expectedClass);
        expect(bubble.style.borderLeft).toBe('');
        expect(bubble.style.backgroundColor).toBe('');
      }
    );

    it('shows_intervention_badge_for_intervention_messages', () => {
      render(<MessageBubble {...baseProps} isIntervention={true} />);
      expect(screen.getByText('Intervention')).toBeInTheDocument();
    });
  });

  describe('persona_message_accent_behavior', () => {
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
      '#FFFFFF',
      '#000000',
      '#F00',
      '3B82F6',
    ])('uses_calculated_accent_colors_for_%s', (color) => {
      render(<MessageBubble {...baseProps} accentColor={color} />);

      const bubble = screen.getByTestId('message-bubble');
      const expectedAccent = calculateAccentColor(color);
      const expectedRgb = hexToRgb(expectedAccent.border);

      expect(bubble.style.borderLeft).toBe(`3px solid ${expectedRgb}`);
      expect(bubble.style.backgroundColor).toBe(expectedAccent.background);
      expect(bubble.className).toContain('border');
    });

    it('falls_back_to_neutral_card_styling_when_accent_is_missing', () => {
      render(<MessageBubble {...baseProps} accentColor={undefined} />);

      const bubble = screen.getByTestId('message-bubble');
      expect(bubble.className).toContain('bg-card');
      expect(bubble.style.borderLeft).toBe('');
      expect(bubble.style.backgroundColor).toBe('');
    });
  });
});
