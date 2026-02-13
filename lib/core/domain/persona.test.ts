import { describe, expect, it } from 'vitest';
import { migratePersona, type Persona } from './persona';

describe('persona_spec', () => {
  describe('migratePersona', () => {
    it('migrates_legacy_persona_with_geminiModel_to_modelId', () => {
      const legacy = {
        geminiModel: 'gemini-pro',
        name: 'Test',
        id: 'test-id',
        role: 'Tester',
        systemPrompt: 'You are a tester',
        color: '#FF0000',
      };
      
      const migrated = migratePersona(legacy);
      
      expect(migrated.modelId).toBe('gemini-pro');
      expect(migrated.providerId).toBe('gemini');
      expect(migrated.name).toBe('Test');
      expect(migrated.id).toBe('test-id');
    });

    it('preserves_modern_persona_with_modelId_and_providerId', () => {
      const modern: Persona = {
        id: 'modern-id',
        name: 'Modern',
        role: 'Modern Tester',
        systemPrompt: 'You are modern',
        color: '#00FF00',
        modelId: 'gpt-4',
        providerId: 'openai',
      };
      
      const migrated = migratePersona(modern);
      
      expect(migrated.modelId).toBe('gpt-4');
      expect(migrated.providerId).toBe('openai');
      expect(migrated.name).toBe('Modern');
    });

    it('preserves_existing_fields_during_migration', () => {
      const legacy = {
        id: 'legacy-id',
        name: 'Legacy Persona',
        role: 'Legacy Role',
        systemPrompt: 'Legacy prompt',
        color: '#0000FF',
        avatar: 'avatar.png',
        isActive: true,
        geminiModel: 'gemini-2.5-flash',
      };
      
      const migrated = migratePersona(legacy);
      
      expect(migrated.id).toBe('legacy-id');
      expect(migrated.name).toBe('Legacy Persona');
      expect(migrated.role).toBe('Legacy Role');
      expect(migrated.systemPrompt).toBe('Legacy prompt');
      expect(migrated.color).toBe('#0000FF');
      expect(migrated.avatar).toBe('avatar.png');
      expect(migrated.isActive).toBe(true);
      expect(migrated.modelId).toBe('gemini-2.5-flash');
      expect(migrated.providerId).toBe('gemini');
    });

    it('defaults_providerId_to_gemini_when_no_providerId_or_geminiModel', () => {
      const minimal = {
        id: 'minimal',
        name: 'Minimal',
        role: 'Minimal Role',
        systemPrompt: 'Minimal prompt',
        color: '#FFFFFF',
      };
      
      const migrated = migratePersona(minimal);
      
      expect(migrated.modelId).toBeUndefined();
      expect(migrated.providerId).toBe('gemini');
    });

    it('prefers_modelId_over_geminiModel_when_both_present', () => {
      const mixed = {
        id: 'mixed',
        name: 'Mixed',
        role: 'Mixed Role',
        systemPrompt: 'Mixed prompt',
        color: '#FF00FF',
        modelId: 'gpt-4-turbo',
        geminiModel: 'gemini-pro',
      };
      
      const migrated = migratePersona(mixed);
      
      expect(migrated.modelId).toBe('gpt-4-turbo');
      expect(migrated.providerId).toBe('gemini');
    });

    it('preserves_geminiModel_field_in_migrated_result', () => {
      const legacy = {
        geminiModel: 'gemini-pro',
        name: 'Test',
        id: 'test-id',
        role: 'Tester',
        systemPrompt: 'You are a tester',
        color: '#FF0000',
      };
      
      const migrated = migratePersona(legacy);
      
      // The geminiModel field should still be present for backward compatibility
      expect(migrated.geminiModel).toBe('gemini-pro');
    });
  });
});
