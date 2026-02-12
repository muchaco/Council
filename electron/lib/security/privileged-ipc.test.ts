import type { IpcMain } from 'electron';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  clearPrivilegedIpcRateLimitState,
  mapPrivilegedIpcErrorToPublicFailure,
  registerPrivilegedIpcHandle,
} from './privileged-ipc';

const createMainFrame = (url: string): { url: string; top: unknown } => {
  const mainFrame: { url: string; top: unknown } = {
    url,
    top: null,
  };

  mainFrame.top = mainFrame;
  return mainFrame;
};

describe('privileged_ipc_security_spec', () => {
  it('maps_invalid_payload_error_to_stable_public_failure', () => {
    const response = mapPrivilegedIpcErrorToPublicFailure(new Error('INVALID_IPC_PAYLOAD'));

    expect(response).toEqual({
      success: false,
      error: 'Invalid request payload',
    });
  });

  it('maps_rate_limited_error_to_stable_public_failure', () => {
    const response = mapPrivilegedIpcErrorToPublicFailure(new Error('IPC_RATE_LIMITED'));

    expect(response).toEqual({
      success: false,
      error: 'Rate limit exceeded',
    });
  });

  it('maps_unauthorized_sender_error_to_stable_public_failure', () => {
    const response = mapPrivilegedIpcErrorToPublicFailure(
      new Error('UNAUTHORIZED_IPC_SENDER')
    );

    expect(response).toEqual({
      success: false,
      error: 'Unauthorized request',
    });
  });

  it('returns_null_for_non_unauthorized_errors', () => {
    const response = mapPrivilegedIpcErrorToPublicFailure(new Error('boom'));

    expect(response).toBeNull();
  });

  it('returns_unauthorized_failure_when_sender_is_untrusted', async () => {
    let invokeHandler: ((event: unknown, ...args: unknown[]) => Promise<unknown>) | undefined;

    const fakeIpcMain: Pick<IpcMain, 'handle'> = {
      handle: (
        _channel: string,
        listener: (event: unknown, ...args: unknown[]) => Promise<unknown>
      ): void => {
        invokeHandler = listener;
      },
    } as Pick<IpcMain, 'handle'>;

    registerPrivilegedIpcHandle(fakeIpcMain, 'db:test', async () => ({ success: true }));

    expect(invokeHandler).toBeDefined();

    const response = await invokeHandler!({
      senderFrame: createMainFrame('https://attacker.example'),
    });

    expect(response).toEqual({ success: false, error: 'Unauthorized request' });
  });

  it('returns_invalid_payload_failure_before_handler_execution', async () => {
    clearPrivilegedIpcRateLimitState();
    let invokeHandler: ((event: unknown, ...args: unknown[]) => Promise<unknown>) | undefined;
    let handlerExecutionCount = 0;

    const fakeIpcMain: Pick<IpcMain, 'handle'> = {
      handle: (
        _channel: string,
        listener: (event: unknown, ...args: unknown[]) => Promise<unknown>
      ): void => {
        invokeHandler = listener;
      },
    } as Pick<IpcMain, 'handle'>;

    registerPrivilegedIpcHandle(
      fakeIpcMain,
      'llm:chat',
      async () => {
        handlerExecutionCount += 1;
        return { success: true };
      },
      {
        argsSchema: z.tuple([z.object({ sessionId: z.string() })]),
      }
    );

    const response = await invokeHandler!(
      { senderFrame: createMainFrame('app://index.html'), sender: { id: 11 } },
      { sessionId: 42 }
    );

    expect(handlerExecutionCount).toBe(0);
    expect(response).toEqual({ success: false, error: 'Invalid request payload' });
  });

  it('returns_rate_limit_failure_for_high_frequency_calls_per_sender', async () => {
    clearPrivilegedIpcRateLimitState();
    let invokeHandler: ((event: unknown, ...args: unknown[]) => Promise<unknown>) | undefined;

    const fakeIpcMain: Pick<IpcMain, 'handle'> = {
      handle: (
        _channel: string,
        listener: (event: unknown, ...args: unknown[]) => Promise<unknown>
      ): void => {
        invokeHandler = listener;
      },
    } as Pick<IpcMain, 'handle'>;

    registerPrivilegedIpcHandle(
      fakeIpcMain,
      'settings:testConnection',
      async () => ({ success: true }),
      {
        rateLimit: {
          maxRequests: 1,
          windowMs: 60_000,
        },
      }
    );

    const trustedEvent = {
      senderFrame: createMainFrame('app://index.html'),
      sender: { id: 9 },
    };

    const firstResponse = await invokeHandler!(trustedEvent);
    const secondResponse = await invokeHandler!(trustedEvent);

    expect(firstResponse).toEqual({ success: true });
    expect(secondResponse).toEqual({ success: false, error: 'Rate limit exceeded' });
  });
});
