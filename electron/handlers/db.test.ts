import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcHandleSpy, createPersonaMock, getPersonasMock, createSessionMock, createMessageMock } = vi.hoisted(() => ({
  ipcHandleSpy: vi.fn(),
  createPersonaMock: vi.fn(),
  getPersonasMock: vi.fn(),
  createSessionMock: vi.fn(),
  createMessageMock: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: ipcHandleSpy,
  },
}));

vi.mock('../lib/queries.js', () => ({
  createPersona: createPersonaMock,
  getPersonas: getPersonasMock,
  createSession: createSessionMock,
  createMessage: createMessageMock,
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
    createSessionMock.mockReset();
    createMessageMock.mockReset();
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

  it('accepts_session_creation_without_optional_output_goal', async () => {
    createSessionMock.mockResolvedValue({ id: 'session-1' });
    setupDatabaseHandlers();

    const channelRegistrations = ipcHandleSpy.mock.calls as Array<
      [string, (event: unknown, ...args: unknown[]) => Promise<unknown>]
    >;
    const createSessionHandler = channelRegistrations.find(
      ([channel]) => channel === 'db:session:create'
    )?.[1];

    expect(createSessionHandler).toBeDefined();

    const response = await createSessionHandler!(
      { senderFrame: createMainFrame('app://index.html'), sender: { id: 12 } },
      {
        title: 'Launch readiness',
        problemDescription: 'Align launch decisions',
      }
    );

    expect(response).toEqual({ success: true, data: { id: 'session-1' } });
    expect(createSessionMock).toHaveBeenCalledWith(
      {
        title: 'Launch readiness',
        problemDescription: 'Align launch decisions',
        outputGoal: '',
      },
      undefined
    );
  });

  it('accepts_session_creation_with_all_supported_fields', async () => {
    createSessionMock.mockResolvedValue({ id: 'session-2' });
    setupDatabaseHandlers();

    const channelRegistrations = ipcHandleSpy.mock.calls as Array<
      [string, (event: unknown, ...args: unknown[]) => Promise<unknown>]
    >;
    const createSessionHandler = channelRegistrations.find(
      ([channel]) => channel === 'db:session:create'
    )?.[1];

    expect(createSessionHandler).toBeDefined();

    const response = await createSessionHandler!(
      { senderFrame: createMainFrame('app://index.html'), sender: { id: 13 } },
      {
        title: 'Q2 planning',
        problemDescription: 'Resolve roadmap conflicts',
        outputGoal: 'Deliver an execution brief',
        conductorConfig: {
          enabled: true,
          mode: 'manual',
        },
      }
    );

    expect(response).toEqual({ success: true, data: { id: 'session-2' } });
    expect(createSessionMock).toHaveBeenCalledWith(
      {
        title: 'Q2 planning',
        problemDescription: 'Resolve roadmap conflicts',
        outputGoal: 'Deliver an execution brief',
      },
      {
        enabled: true,
        mode: 'manual',
      }
    );
  });

  it('accepts_message_creation_with_source_field', async () => {
    createMessageMock.mockResolvedValue({ id: 'message-1' });
    setupDatabaseHandlers();

    const channelRegistrations = ipcHandleSpy.mock.calls as Array<
      [string, (event: unknown, ...args: unknown[]) => Promise<unknown>]
    >;
    const createMessageHandler = channelRegistrations.find(
      ([channel]) => channel === 'db:message:create'
    )?.[1];

    expect(createMessageHandler).toBeDefined();

    const response = await createMessageHandler!(
      { senderFrame: createMainFrame('app://index.html'), sender: { id: 14 } },
      {
        sessionId: 'session-1',
        personaId: null,
        source: 'conductor',
        content: 'Please refocus on the objective.',
        turnNumber: 3,
        tokenCount: 0,
      }
    );

    expect(response).toEqual({ success: true, data: { id: 'message-1' } });
    expect(createMessageMock).toHaveBeenCalledWith({
      sessionId: 'session-1',
      personaId: null,
      source: 'conductor',
      content: 'Please refocus on the objective.',
      turnNumber: 3,
      tokenCount: 0,
    });
  });

  it('rejects_message_creation_when_source_is_invalid', async () => {
    setupDatabaseHandlers();

    const channelRegistrations = ipcHandleSpy.mock.calls as Array<
      [string, (event: unknown, ...args: unknown[]) => Promise<unknown>]
    >;
    const createMessageHandler = channelRegistrations.find(
      ([channel]) => channel === 'db:message:create'
    )?.[1];

    expect(createMessageHandler).toBeDefined();

    const response = await createMessageHandler!(
      { senderFrame: createMainFrame('app://index.html'), sender: { id: 15 } },
      {
        sessionId: 'session-1',
        personaId: null,
        source: 'system',
        content: 'Invalid source message.',
        turnNumber: 4,
      }
    );

    expect(response).toEqual({ success: false, error: 'Invalid request payload' });
    expect(createMessageMock).not.toHaveBeenCalled();
  });
});
