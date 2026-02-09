import { describe, it, expect } from 'vitest';
import type { SessionPersona } from './types';
import {
  isPersonaHushed,
  decrementHushTurns,
  setHushTurns,
  clearHush,
  filterHushedPersonas,
  decrementAllHushTurns,
  getRemainingHushTurns,
  formatHushStatus,
  type HushState,
} from './hush';

// Extended SessionPersona type for testing with all Persona fields
interface TestSessionPersona extends SessionPersona {
  name: string;
  role: string;
  systemPrompt: string;
  geminiModel: string;
  temperature: number;
  color: string;
  hiddenAgenda?: string;
  verbosity?: string;
  createdAt: string;
  updatedAt: string;
}

describe('hush pure functions', () => {
  describe('isPersonaHushed', () => {
    it('returns true when persona has remaining hush turns', () => {
      const persona: HushState = { hushTurnsRemaining: 3, hushedAt: '2024-01-01T00:00:00Z' };
      expect(isPersonaHushed(persona)).toBe(true);
    });

    it('returns false when persona has no remaining hush turns', () => {
      const persona: HushState = { hushTurnsRemaining: 0, hushedAt: null };
      expect(isPersonaHushed(persona)).toBe(false);
    });

    it('returns false when hush turns is negative', () => {
      const persona: HushState = { hushTurnsRemaining: -1, hushedAt: null };
      expect(isPersonaHushed(persona)).toBe(false);
    });
  });

  describe('decrementHushTurns', () => {
    it('decrements hush turns by 1', () => {
      const current: HushState = { hushTurnsRemaining: 3, hushedAt: '2024-01-01T00:00:00Z' };
      const result = decrementHushTurns(current);
      expect(result.hushTurnsRemaining).toBe(2);
      expect(result.hushedAt).toBe('2024-01-01T00:00:00Z');
    });

    it('does not go below 0', () => {
      const current: HushState = { hushTurnsRemaining: 0, hushedAt: null };
      const result = decrementHushTurns(current);
      expect(result.hushTurnsRemaining).toBe(0);
    });

    it('clears hushedAt when turns reach 0', () => {
      const current: HushState = { hushTurnsRemaining: 1, hushedAt: '2024-01-01T00:00:00Z' };
      const result = decrementHushTurns(current);
      expect(result.hushTurnsRemaining).toBe(0);
      expect(result.hushedAt).toBeNull();
    });

    it('does not mutate original state', () => {
      const current: HushState = { hushTurnsRemaining: 2, hushedAt: '2024-01-01T00:00:00Z' };
      decrementHushTurns(current);
      expect(current.hushTurnsRemaining).toBe(2);
    });
  });

  describe('setHushTurns', () => {
    it('sets hush turns and timestamp for positive values', () => {
      const before = Date.now();
      const result = setHushTurns(5);
      const after = Date.now();
      
      expect(result.hushTurnsRemaining).toBe(5);
      expect(result.hushedAt).not.toBeNull();
      expect(new Date(result.hushedAt!).getTime()).toBeGreaterThanOrEqual(before);
      expect(new Date(result.hushedAt!).getTime()).toBeLessThanOrEqual(after);
    });

    it('throws error for zero turns', () => {
      expect(() => setHushTurns(0)).toThrow('Hush turns must be positive');
    });

    it('throws error for negative turns', () => {
      expect(() => setHushTurns(-1)).toThrow('Hush turns must be positive');
    });
  });

  describe('clearHush', () => {
    it('returns hush state with 0 turns and no timestamp', () => {
      const result = clearHush();
      expect(result.hushTurnsRemaining).toBe(0);
      expect(result.hushedAt).toBeNull();
    });
  });

  describe('filterHushedPersonas', () => {
    it('removes hushed personas from the list', () => {
      const personas: TestSessionPersona[] = [
        createTestPersona('1', 'Alice', 0),
        createTestPersona('2', 'Bob', 3),
        createTestPersona('3', 'Charlie', 0),
        createTestPersona('4', 'Diana', 5),
      ];
      
      const result = filterHushedPersonas(personas);
      expect(result).toHaveLength(2);
      expect(result.map(p => (p as TestSessionPersona).name)).toEqual(['Alice', 'Charlie']);
    });

    it('returns empty array when all personas are hushed', () => {
      const personas: TestSessionPersona[] = [
        createTestPersona('1', 'Alice', 3),
        createTestPersona('2', 'Bob', 5),
      ];
      
      const result = filterHushedPersonas(personas);
      expect(result).toHaveLength(0);
    });

    it('returns all personas when none are hushed', () => {
      const personas: TestSessionPersona[] = [
        createTestPersona('1', 'Alice', 0),
        createTestPersona('2', 'Bob', 0),
      ];
      
      const result = filterHushedPersonas(personas);
      expect(result).toHaveLength(2);
    });

    it('does not mutate original array', () => {
      const personas: TestSessionPersona[] = [
        createTestPersona('1', 'Alice', 3),
      ];
      filterHushedPersonas(personas);
      expect(personas).toHaveLength(1);
      expect(personas[0].hushTurnsRemaining).toBe(3);
    });
  });

  describe('decrementAllHushTurns', () => {
    it('decrements hush turns for all personas', () => {
      const personas: TestSessionPersona[] = [
        createTestPersona('1', 'Alice', 3),
        createTestPersona('2', 'Bob', 1),
        createTestPersona('3', 'Charlie', 0),
      ];
      
      const result = decrementAllHushTurns(personas);
      expect(result[0].hushTurnsRemaining).toBe(2);
      expect(result[1].hushTurnsRemaining).toBe(0);
      expect(result[2].hushTurnsRemaining).toBe(0);
    });

    it('clears hushedAt when turns reach 0', () => {
      const personas: TestSessionPersona[] = [
        createTestPersona('1', 'Alice', 1, '2024-01-01T00:00:00Z'),
      ];
      
      const result = decrementAllHushTurns(personas);
      expect(result[0].hushTurnsRemaining).toBe(0);
      expect(result[0].hushedAt).toBeNull();
    });

    it('does not mutate original array', () => {
      const personas: TestSessionPersona[] = [
        createTestPersona('1', 'Alice', 3),
      ];
      decrementAllHushTurns(personas);
      expect(personas[0].hushTurnsRemaining).toBe(3);
    });
  });

  describe('getRemainingHushTurns', () => {
    it('returns the exact number of remaining turns', () => {
      const persona: HushState = { hushTurnsRemaining: 7, hushedAt: '2024-01-01T00:00:00Z' };
      expect(getRemainingHushTurns(persona)).toBe(7);
    });

    it('returns 0 for non-hushed persona', () => {
      const persona: HushState = { hushTurnsRemaining: 0, hushedAt: null };
      expect(getRemainingHushTurns(persona)).toBe(0);
    });
  });

  describe('formatHushStatus', () => {
    it('returns formatted string for multiple turns', () => {
      const persona: HushState = { hushTurnsRemaining: 5, hushedAt: '2024-01-01T00:00:00Z' };
      expect(formatHushStatus(persona)).toBe('Hushed (5 turns remaining)');
    });

    it('returns formatted string for single turn', () => {
      const persona: HushState = { hushTurnsRemaining: 1, hushedAt: '2024-01-01T00:00:00Z' };
      expect(formatHushStatus(persona)).toBe('Hushed (1 turn remaining)');
    });

    it('returns null for non-hushed persona', () => {
      const persona: HushState = { hushTurnsRemaining: 0, hushedAt: null };
      expect(formatHushStatus(persona)).toBeNull();
    });
  });
});

// Helper function to create test personas
function createTestPersona(
  personaId: string,
  name: string,
  hushTurnsRemaining: number,
  hushedAt: string | null = null
): TestSessionPersona {
  return {
    sessionId: 'test-session-123',
    personaId,
    name,
    role: 'Test Role',
    systemPrompt: 'Test system prompt',
    geminiModel: 'gemini-1.5-flash',
    temperature: 0.7,
    color: '#3B82F6',
    hiddenAgenda: undefined,
    verbosity: undefined,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isOrchestrator: false,
    hushTurnsRemaining,
    hushedAt,
  };
}
