import type { SessionPersona } from './types';

/**
 * Pure functions for Hush logic - "The Hush Button" feature
 * 
 * Following FC-IS pattern: These are pure functions with no side effects
 * that can be easily tested without mocks.
 */

export interface HushState {
  hushTurnsRemaining: number;
  hushedAt: string | null;
}

/**
 * Checks if a persona is currently hushed (has remaining hush turns)
 * 
 * @param persona - The persona to check
 * @returns true if the persona has remaining hush turns
 */
export function isPersonaHushed(persona: HushState): boolean {
  return persona.hushTurnsRemaining > 0;
}

/**
 * Decrements hush turns for a persona
 * Returns the new hush state
 * 
 * @param currentState - Current hush state
 * @returns New hush state with decremented turns (minimum 0)
 */
export function decrementHushTurns(currentState: HushState): HushState {
  const newTurns = Math.max(0, currentState.hushTurnsRemaining - 1);
  return {
    hushTurnsRemaining: newTurns,
    hushedAt: newTurns === 0 ? null : currentState.hushedAt,
  };
}

/**
 * Sets hush turns for a persona
 * Returns the new hush state
 * 
 * @param turns - Number of turns to hush (must be positive)
 * @returns New hush state
 * @throws Error if turns is not positive
 */
export function setHushTurns(turns: number): HushState {
  if (turns <= 0) {
    throw new Error('Hush turns must be positive');
  }
  
  return {
    hushTurnsRemaining: turns,
    hushedAt: new Date().toISOString(),
  };
}

/**
 * Clears hush state for a persona
 * Returns a cleared hush state
 * 
 * @returns Hush state with 0 turns remaining
 */
export function clearHush(): HushState {
  return {
    hushTurnsRemaining: 0,
    hushedAt: null,
  };
}

/**
 * Filters out hushed personas from a list
 * 
 * @param personas - List of personas with hush state
 * @returns Array of non-hushed personas
 */
export function filterHushedPersonas(personas: SessionPersona[]): SessionPersona[] {
  return personas.filter(p => !isPersonaHushed(p));
}

/**
 * Decrements hush turns for all personas in a list
 * Returns a new list with updated hush states
 * 
 * @param personas - List of personas with hush state
 * @returns New array with decremented hush turns
 */
export function decrementAllHushTurns(personas: SessionPersona[]): SessionPersona[] {
  return personas.map(p => ({
    ...p,
    ...decrementHushTurns(p),
  }));
}

/**
 * Gets the count of remaining hush turns for a persona
 * 
 * @param persona - The persona to check
 * @returns Number of remaining hush turns
 */
export function getRemainingHushTurns(persona: HushState): number {
  return persona.hushTurnsRemaining;
}

/**
 * Formats hush status message for UI display
 * 
 * @param persona - The persona to format status for
 * @returns Human-readable hush status string, or null if not hushed
 */
export function formatHushStatus(persona: HushState): string | null {
  if (!isPersonaHushed(persona)) {
    return null;
  }
  
  const turns = persona.hushTurnsRemaining;
  return turns === 1 
    ? 'Hushed (1 turn remaining)' 
    : `Hushed (${turns} turns remaining)`;
}
