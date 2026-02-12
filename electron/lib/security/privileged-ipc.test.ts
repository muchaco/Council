import type { IpcMain } from 'electron';
import { describe, expect, it } from 'vitest';

import {
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
});
