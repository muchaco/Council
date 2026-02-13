import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';
import { loadPersona, loadPersonas, isLegacyPersona, isModernPersona } from './persona-migration';
import type { PersistedReusablePersonaRow } from '../../application/use-cases/reusable-personas/reusable-persona-dependencies';
import type { Persona } from '../../core/domain/persona';

describe('persona_migration_spec', () => {
  describe('loadPersona', () => {
    it('loads_modern_persona_with_modelid_and_providerid_without_migration', async () => {
      const modernRow = {
        id: '1',
        name: 'Modern Persona',
        role: 'assistant',
        systemPrompt: 'You are a helpful assistant',
        geminiModel: 'gemini-1.5-pro',
        modelId: 'gemini-2.0-flash',
        providerId: 'gemini',
        temperature: 0.7,
        color: '#FF5733',
        hiddenAgenda: null,
        verbosity: null,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      } as PersistedReusablePersonaRow;

      const result = await Effect.runPromise(loadPersona(modernRow));

      expect(result.modelId).toBe('gemini-2.0-flash');
      expect(result.providerId).toBe('gemini');
      expect(result.geminiModel).toBe('gemini-1.5-pro');
    });

    it('migrates_legacy_persona_with_gemini_model_only', async () => {
      const legacyRow = {
        id: '2',
        name: 'Legacy Persona',
        role: 'assistant',
        systemPrompt: 'You are an assistant',
        geminiModel: 'gemini-pro',
        temperature: 0.5,
        color: '#33FF57',
        hiddenAgenda: null,
        verbosity: null,
        createdAt: '2024-01-10T08:00:00Z',
        updatedAt: '2024-01-10T08:00:00Z',
      } as PersistedReusablePersonaRow;

      const result = await Effect.runPromise(loadPersona(legacyRow));

      expect(result.modelId).toBe('gemini-pro');
      expect(result.providerId).toBe('gemini');
      expect(result.geminiModel).toBe('gemini-pro');
    });

    it('handles_legacy_persona_without_gemini_model', async () => {
      const legacyRow = {
        id: '3',
        name: 'Empty Legacy Persona',
        role: 'assistant',
        systemPrompt: 'You are an assistant',
        geminiModel: '',
        temperature: 0.5,
        color: '#3357FF',
        hiddenAgenda: null,
        verbosity: null,
        createdAt: '2024-01-10T08:00:00Z',
        updatedAt: '2024-01-10T08:00:00Z',
      } as PersistedReusablePersonaRow;

      const result = await Effect.runPromise(loadPersona(legacyRow));

      expect(result.modelId).toBeUndefined();
      expect(result.providerId).toBeUndefined();
      expect(result.geminiModel).toBe('');
    });

    it('handles_persona_with_null_undefined_fields', async () => {
      const row = {
        id: '4',
        name: 'Test Persona',
        role: 'expert',
        systemPrompt: 'You are an expert',
        geminiModel: 'gemini-pro',
        temperature: 0.3,
        color: '#FF33A1',
        hiddenAgenda: 'Some hidden agenda',
        verbosity: 'medium',
        createdAt: '2024-01-20T12:00:00Z',
        updatedAt: '2024-01-20T12:00:00Z',
      } as PersistedReusablePersonaRow;

      const result = await Effect.runPromise(loadPersona(row));

      expect(result.id).toBe('4');
      expect(result.name).toBe('Test Persona');
      expect(result.role).toBe('expert');
      expect(result.systemPrompt).toBe('You are an expert');
      expect(result.hiddenAgenda).toBe('Some hidden agenda');
      expect(result.verbosity).toBe('medium');
      expect(result.modelId).toBe('gemini-pro');
      expect(result.providerId).toBe('gemini');
    });

    it('preserves_all_original_fields_during_migration', async () => {
      const legacyRow = {
        id: '5',
        name: 'Preserved Persona',
        role: 'consultant',
        systemPrompt: 'You are a consultant',
        geminiModel: 'gemini-1.5-flash',
        temperature: 0.8,
        color: '#A133FF',
        hiddenAgenda: null,
        verbosity: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      } as PersistedReusablePersonaRow;

      const result = await Effect.runPromise(loadPersona(legacyRow));

      expect(result.id).toBe('5');
      expect(result.name).toBe('Preserved Persona');
      expect(result.role).toBe('consultant');
      expect(result.systemPrompt).toBe('You are a consultant');
      expect(result.temperature).toBe(0.8);
      expect(result.color).toBe('#A133FF');
    });

    it('prioritizes_modern_fields_over_legacy_when_both_present', async () => {
      const mixedRow = {
        id: '6',
        name: 'Mixed Persona',
        role: 'analyst',
        systemPrompt: 'You are an analyst',
        geminiModel: 'old-gemini-model',
        modelId: 'new-model-id',
        providerId: 'custom-provider',
        temperature: 0.4,
        color: '#33FFA1',
        hiddenAgenda: null,
        verbosity: null,
        createdAt: '2024-01-25T15:00:00Z',
        updatedAt: '2024-01-25T15:00:00Z',
      } as PersistedReusablePersonaRow;

      const result = await Effect.runPromise(loadPersona(mixedRow));

      // Modern fields should be preferred
      expect(result.modelId).toBe('new-model-id');
      expect(result.providerId).toBe('custom-provider');
      // Legacy field preserved
      expect(result.geminiModel).toBe('old-gemini-model');
    });
  });

  describe('loadPersonas', () => {
    it('loads_multiple_personas_with_mixed_formats', async () => {
      const rows = [
        {
          id: '1',
          name: 'Modern',
          role: 'helper',
          systemPrompt: 'Help',
          geminiModel: 'gemini-pro',
          modelId: 'gpt-4',
          providerId: 'openai',
          temperature: 0.5,
          color: '#FF0000',
          hiddenAgenda: null,
          verbosity: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Legacy',
          role: 'assistant',
          systemPrompt: 'Assist',
          geminiModel: 'gemini-flash',
          temperature: 0.6,
          color: '#00FF00',
          hiddenAgenda: null,
          verbosity: null,
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
        {
          id: '3',
          name: 'Also Legacy',
          role: 'expert',
          systemPrompt: 'Expert',
          geminiModel: '',
          temperature: 0.7,
          color: '#0000FF',
          hiddenAgenda: null,
          verbosity: null,
          createdAt: '2024-01-03T00:00:00Z',
          updatedAt: '2024-01-03T00:00:00Z',
        },
      ] as PersistedReusablePersonaRow[];

      const results = await Effect.runPromise(loadPersonas(rows));

      expect(results).toHaveLength(3);
      // Modern - uses its own modern fields
      expect(results[0].modelId).toBe('gpt-4');
      expect(results[0].providerId).toBe('openai');
      // Legacy with geminiModel - migrated
      expect(results[1].modelId).toBe('gemini-flash');
      expect(results[1].providerId).toBe('gemini');
      // Legacy without geminiModel - no migration
      expect(results[2].modelId).toBeUndefined();
      expect(results[2].providerId).toBeUndefined();
    });

    it('returns_empty_array_for_empty_input', async () => {
      const results = await Effect.runPromise(loadPersonas([]));
      expect(results).toEqual([]);
    });
  });

  describe('isLegacyPersona', () => {
    it('returns_true_for_persona_with_geminiModel_but_no_modelId', () => {
      const legacyPersona: Persona = {
        id: '1',
        name: 'Legacy',
        role: 'assistant',
        systemPrompt: 'Help',
        color: '#FF0000',
        geminiModel: 'gemini-pro',
      };

      expect(isLegacyPersona(legacyPersona)).toBe(true);
    });

    it('returns_false_for_persona_without_geminiModel', () => {
      const modernPersona: Persona = {
        id: '2',
        name: 'Modern',
        role: 'assistant',
        systemPrompt: 'Help',
        color: '#FF0000',
        modelId: 'gpt-4',
        providerId: 'openai',
      };

      expect(isLegacyPersona(modernPersona)).toBe(false);
    });

    it('returns_false_for_persona_with_both_fields', () => {
      const migratedPersona: Persona = {
        id: '3',
        name: 'Migrated',
        role: 'assistant',
        systemPrompt: 'Help',
        color: '#FF0000',
        geminiModel: 'gemini-pro',
        modelId: 'gemini-pro',
        providerId: 'gemini',
      };

      expect(isLegacyPersona(migratedPersona)).toBe(false);
    });
  });

  describe('isModernPersona', () => {
    it('returns_true_for_persona_with_modelId_and_providerId', () => {
      const modernPersona: Persona = {
        id: '1',
        name: 'Modern',
        role: 'assistant',
        systemPrompt: 'Help',
        color: '#FF0000',
        modelId: 'gpt-4',
        providerId: 'openai',
      };

      expect(isModernPersona(modernPersona)).toBe(true);
    });

    it('returns_false_for_persona_without_modelId', () => {
      const legacyPersona: Persona = {
        id: '2',
        name: 'Legacy',
        role: 'assistant',
        systemPrompt: 'Help',
        color: '#FF0000',
        providerId: 'gemini',
      };

      expect(isModernPersona(legacyPersona)).toBe(false);
    });

    it('returns_false_for_persona_without_providerId', () => {
      const partialPersona: Persona = {
        id: '3',
        name: 'Partial',
        role: 'assistant',
        systemPrompt: 'Help',
        color: '#FF0000',
        modelId: 'gpt-4',
      };

      expect(isModernPersona(partialPersona)).toBe(false);
    });

    it('returns_false_for_legacy_persona', () => {
      const legacyPersona: Persona = {
        id: '4',
        name: 'Legacy',
        role: 'assistant',
        systemPrompt: 'Help',
        color: '#FF0000',
        geminiModel: 'gemini-pro',
      };

      expect(isModernPersona(legacyPersona)).toBe(false);
    });
  });
});
