import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import type { Persona } from '../lib/types';
import { usePersonasStore } from './personas';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockElectronDB = {
  getPersonas: vi.fn(),
  createPersona: vi.fn(),
  updatePersona: vi.fn(),
  deletePersona: vi.fn(),
};

describe('personas_store_spec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePersonasStore.setState({
      personas: [],
      isLoading: false,
    });
    Object.assign(window, { electronDB: mockElectronDB });
  });

  it('loads_personas_from_gateway_use_case', async () => {
    const personas: Persona[] = [
      {
        id: 'persona-1',
        name: 'Architect',
        role: 'System designer',
        systemPrompt: 'Design safely',
        geminiModel: 'gemini-2.0-flash',
        temperature: 0.4,
        color: '#3B82F6',
        hiddenAgenda: undefined,
        verbosity: undefined,
        createdAt: '2026-02-11T10:00:00.000Z',
        updatedAt: '2026-02-11T10:00:00.000Z',
      },
    ];

    mockElectronDB.getPersonas.mockResolvedValue({ success: true, data: personas });

    await usePersonasStore.getState().fetchPersonas();

    expect(usePersonasStore.getState().personas).toEqual(personas);
    expect(mockElectronDB.getPersonas).toHaveBeenCalledTimes(1);
  });

  it('returns_null_when_create_persona_gateway_fails', async () => {
    mockElectronDB.createPersona.mockResolvedValue({ success: false, error: 'create failed' });

    const result = await usePersonasStore.getState().createPersona({
      name: 'Critic',
      role: 'Risk assessor',
      systemPrompt: 'Challenge assumptions',
      geminiModel: 'gemini-2.0-flash',
      temperature: 0.2,
      color: '#EF4444',
    });

    expect(result).toBeNull();
    expect(mockElectronDB.createPersona).toHaveBeenCalledTimes(1);
  });

  it('removes_deleted_persona_from_store_state', async () => {
    usePersonasStore.setState({
      personas: [
        {
          id: 'persona-1',
          name: 'Moderator',
          role: 'Facilitator',
          systemPrompt: 'Facilitate discussion',
          geminiModel: 'gemini-2.0-flash',
          temperature: 0.3,
          color: '#10B981',
          hiddenAgenda: undefined,
          verbosity: undefined,
          createdAt: '2026-02-11T10:00:00.000Z',
          updatedAt: '2026-02-11T10:00:00.000Z',
        },
      ],
    });
    mockElectronDB.deletePersona.mockResolvedValue({ success: true });

    const result = await usePersonasStore.getState().deletePersona('persona-1');

    expect(result).toBe(true);
    expect(usePersonasStore.getState().personas).toEqual([]);
  });

  it('rejects_malformed_persona_catalog_payload', async () => {
    usePersonasStore.setState({
      personas: [
        {
          id: 'persona-existing',
          name: 'Existing',
          role: 'Role',
          systemPrompt: 'Prompt',
          geminiModel: 'gemini-2.0-flash',
          temperature: 0.3,
          color: '#10B981',
          hiddenAgenda: undefined,
          verbosity: undefined,
          createdAt: '2026-02-11T10:00:00.000Z',
          updatedAt: '2026-02-11T10:00:00.000Z',
        },
      ],
    });
    mockElectronDB.getPersonas.mockResolvedValue({ success: true, data: [{ id: 1 }] });

    await usePersonasStore.getState().fetchPersonas();

    expect(usePersonasStore.getState().personas).toHaveLength(1);
    expect(toast.error).toHaveBeenCalledWith('Invalid persona catalog payload');
  });

  it('rejects_missing_persona_catalog_payload_when_call_succeeds', async () => {
    mockElectronDB.getPersonas.mockResolvedValue({ success: true });

    await usePersonasStore.getState().fetchPersonas();

    expect(toast.error).toHaveBeenCalledWith('Invalid persona catalog payload');
  });
});
