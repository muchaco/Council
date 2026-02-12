import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcHandleSpy, createPersonaMock, getPersonasMock } = vi.hoisted(() => ({
  ipcHandleSpy: vi.fn(),
  createPersonaMock: vi.fn(),
  getPersonasMock: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: ipcHandleSpy,
  },
}));

vi.mock('../lib/queries.js', () => ({
  createPersona: createPersonaMock,
  getPersonas: getPersonasMock,
}));

import { setupDatabaseHandlers } from './db';

const createMainFrame = (url: string): { url: string; top: unknown } => {
  const mainFrame: { url: string; top: unknown } = {
    url,
    top: null,
  };

  mainFrame.top = mainFrame;
  return mainFrame;
};

describe('database_handler_security_spec', () => {
  beforeEach(() => {
    ipcHandleSpy.mockClear();
    createPersonaMock.mockReset();
    getPersonasMock.mockReset();
  });

  it('rejects_invalid_payload_before_db_execution', async () => {
    setupDatabaseHandlers();

    const channelRegistrations = ipcHandleSpy.mock.calls as Array<
      [string, (event: unknown, ...args: unknown[]) => Promise<unknown>]
    >;
    const getPersonaHandler = channelRegistrations.find(
      ([channel]) => channel === 'db:persona:get'
    )?.[1];

    expect(getPersonaHandler).toBeDefined();

    const response = await getPersonaHandler!(
      { senderFrame: createMainFrame('app://index.html'), sender: { id: 10 } },
      42
    );

    expect(response).toEqual({ success: false, error: 'Invalid request payload' });
  });

  it('maps_query_failure_to_sanitized_public_error', async () => {
    getPersonasMock.mockRejectedValueOnce(new Error('SQLITE error with internal details'));
    setupDatabaseHandlers();

    const channelRegistrations = ipcHandleSpy.mock.calls as Array<
      [string, (event: unknown, ...args: unknown[]) => Promise<unknown>]
    >;
    const getAllPersonasHandler = channelRegistrations.find(
      ([channel]) => channel === 'db:persona:getAll'
    )?.[1];

    expect(getAllPersonasHandler).toBeDefined();

    const response = await getAllPersonasHandler!({
      senderFrame: createMainFrame('app://index.html'),
      sender: { id: 11 },
    });

    expect(response).toEqual({ success: false, error: 'Database operation failed' });
  });

  it('returns_rate_limit_failure_for_mutating_channel_abuse', async () => {
    createPersonaMock.mockResolvedValue({ id: 'persona-1' });
    setupDatabaseHandlers();

    const channelRegistrations = ipcHandleSpy.mock.calls as Array<
      [string, (event: unknown, ...args: unknown[]) => Promise<unknown>]
    >;
    const createPersonaHandler = channelRegistrations.find(
      ([channel]) => channel === 'db:persona:create'
    )?.[1];

    expect(createPersonaHandler).toBeDefined();

    const trustedEvent = {
      senderFrame: createMainFrame('app://index.html'),
      sender: { id: 77 },
    };

    for (let attempt = 0; attempt < 120; attempt += 1) {
      await createPersonaHandler!(trustedEvent, {
        name: `Persona ${attempt}`,
        role: 'Analyst',
        systemPrompt: 'Evaluate options',
        geminiModel: 'gemini-2.0-flash',
        temperature: 0.7,
        color: '#111111',
      });
    }

    const throttledResponse = await createPersonaHandler!(trustedEvent, {
      name: 'Rate limited',
      role: 'Analyst',
      systemPrompt: 'Evaluate options',
      geminiModel: 'gemini-2.0-flash',
      temperature: 0.7,
      color: '#111111',
    });

    expect(throttledResponse).toEqual({ success: false, error: 'Rate limit exceeded' });
  });
});
