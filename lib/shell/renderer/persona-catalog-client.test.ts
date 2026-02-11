import { describe, expect, it, vi } from 'vitest';

import {
  createPersonaCatalogEntry,
  deletePersonaCatalogEntry,
  loadPersonaCatalog,
  updatePersonaCatalogEntry,
} from './persona-catalog-client';

const validPersona = {
  id: 'persona-1',
  name: 'Analyst',
  role: 'Analyst',
  systemPrompt: 'Analyze deeply',
  geminiModel: 'gemini-2.0-flash',
  temperature: 0.3,
  color: '#3B82F6',
  hiddenAgenda: undefined,
  verbosity: undefined,
  createdAt: '2026-02-11T10:00:00.000Z',
  updatedAt: '2026-02-11T10:00:00.000Z',
};

describe('persona_catalog_client_spec', () => {
  it('loads_persona_catalog_when_transport_payload_is_valid', async () => {
    const electronDB = {
      getPersonas: vi.fn().mockResolvedValue({ success: true, data: [validPersona] }),
      createPersona: vi.fn(),
      updatePersona: vi.fn(),
      deletePersona: vi.fn(),
    };

    const personas = await loadPersonaCatalog(electronDB);

    expect(personas).toEqual([validPersona]);
  });

  it('rejects_invalid_persona_catalog_payload', async () => {
    const electronDB = {
      getPersonas: vi.fn().mockResolvedValue({ success: true, data: [{ id: 1 }] }),
      createPersona: vi.fn(),
      updatePersona: vi.fn(),
      deletePersona: vi.fn(),
    };

    await expect(loadPersonaCatalog(electronDB)).rejects.toThrow('Invalid persona catalog payload');
  });

  it('creates_updates_and_deletes_persona_catalog_entries', async () => {
    const electronDB = {
      getPersonas: vi.fn(),
      createPersona: vi.fn().mockResolvedValue({ success: true, data: validPersona }),
      updatePersona: vi.fn().mockResolvedValue({ success: true, data: { ...validPersona, name: 'Updated' } }),
      deletePersona: vi.fn().mockResolvedValue({ success: true }),
    };

    const created = await createPersonaCatalogEntry(electronDB, {
      name: 'Analyst',
      role: 'Analyst',
      systemPrompt: 'Analyze deeply',
      geminiModel: 'gemini-2.0-flash',
      temperature: 0.3,
      color: '#3B82F6',
    });
    const updated = await updatePersonaCatalogEntry(electronDB, 'persona-1', { name: 'Updated' });
    await deletePersonaCatalogEntry(electronDB, 'persona-1');

    expect(created).toEqual(validPersona);
    expect(updated.name).toBe('Updated');
    expect(electronDB.deletePersona).toHaveBeenCalledWith('persona-1');
  });
});
