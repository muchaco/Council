import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import { assertTrustedSender } from './trusted-sender.js';

const UNAUTHORIZED_SENDER_ERROR_CODE = 'UNAUTHORIZED_IPC_SENDER';
const UNAUTHORIZED_PUBLIC_ERROR_MESSAGE = 'Unauthorized request';

type PrivilegedChannelHandler = (
  event: IpcMainInvokeEvent,
  ...args: readonly unknown[]
) => Promise<unknown> | unknown;

const isUnauthorizedSenderError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message === UNAUTHORIZED_SENDER_ERROR_CODE;
};

export const mapPrivilegedIpcErrorToPublicFailure = (
  error: unknown
): { success: false; error: string } | null => {
  if (!isUnauthorizedSenderError(error)) {
    return null;
  }

  return {
    success: false,
    error: UNAUTHORIZED_PUBLIC_ERROR_MESSAGE,
  };
};

export const registerPrivilegedIpcHandle = (
  electronIpcMain: Pick<IpcMain, 'handle'>,
  channelName: string,
  handler: PrivilegedChannelHandler
): void => {
  electronIpcMain.handle(channelName, async (event, ...args) => {
    try {
      assertTrustedSender(event);
      return await handler(event, ...args);
    } catch (error) {
      const publicFailure = mapPrivilegedIpcErrorToPublicFailure(error);
      if (publicFailure !== null) {
        return publicFailure;
      }

      throw error;
    }
  });
};
