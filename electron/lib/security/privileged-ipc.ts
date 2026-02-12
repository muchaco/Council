import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import crypto from 'crypto';
import { z } from 'zod';

import { logDiagnosticsEvent } from '../diagnostics/logger.js';
import { assertTrustedSender } from './trusted-sender.js';

const UNAUTHORIZED_SENDER_ERROR_CODE = 'UNAUTHORIZED_IPC_SENDER';
const INVALID_PAYLOAD_ERROR_CODE = 'INVALID_IPC_PAYLOAD';
const RATE_LIMITED_ERROR_CODE = 'IPC_RATE_LIMITED';
const UNAUTHORIZED_PUBLIC_ERROR_MESSAGE = 'Unauthorized request';
const INVALID_PAYLOAD_PUBLIC_ERROR_MESSAGE = 'Invalid request payload';
const RATE_LIMITED_PUBLIC_ERROR_MESSAGE = 'Rate limit exceeded';

type PrivilegedChannelHandler = (
  event: IpcMainInvokeEvent,
  ...args: readonly unknown[]
) => Promise<unknown> | unknown;

type PrivilegedRateLimitPolicy = {
  readonly maxRequests: number;
  readonly windowMs: number;
};

export type PrivilegedIpcHandleOptions = {
  readonly argsSchema?: z.ZodType<readonly unknown[]>;
  readonly rateLimit?: PrivilegedRateLimitPolicy;
};

const slidingWindowRateLimitState = new Map<string, Map<number, number[]>>();

const isExpectedPrivilegedIpcError = (error: unknown, errorCode: string): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message === errorCode;
};

const isUnauthorizedSenderError = (error: unknown): boolean => {
  return isExpectedPrivilegedIpcError(error, UNAUTHORIZED_SENDER_ERROR_CODE);
};

const isInvalidPayloadError = (error: unknown): boolean =>
  isExpectedPrivilegedIpcError(error, INVALID_PAYLOAD_ERROR_CODE);

const isRateLimitedError = (error: unknown): boolean =>
  isExpectedPrivilegedIpcError(error, RATE_LIMITED_ERROR_CODE);

const assertWithinRateLimit = (
  event: IpcMainInvokeEvent,
  channelName: string,
  rateLimit: PrivilegedRateLimitPolicy
): void => {
  const senderId = event.sender.id;
  const now = Date.now();

  const bySenderState = slidingWindowRateLimitState.get(channelName) ?? new Map<number, number[]>();
  const senderTimestamps = bySenderState.get(senderId) ?? [];
  const allowedTimestamps = senderTimestamps.filter(
    (timestamp) => now - timestamp < rateLimit.windowMs
  );

  if (allowedTimestamps.length >= rateLimit.maxRequests) {
    bySenderState.set(senderId, allowedTimestamps);
    slidingWindowRateLimitState.set(channelName, bySenderState);
    throw new Error(RATE_LIMITED_ERROR_CODE);
  }

  allowedTimestamps.push(now);
  bySenderState.set(senderId, allowedTimestamps);
  slidingWindowRateLimitState.set(channelName, bySenderState);
};

const parseIpcArgs = (
  args: readonly unknown[],
  argsSchema: z.ZodType<readonly unknown[]>
): readonly unknown[] => {
  const parsedArgs = argsSchema.safeParse(args);
  if (!parsedArgs.success) {
    throw new Error(INVALID_PAYLOAD_ERROR_CODE);
  }

  return parsedArgs.data;
};

export const mapPrivilegedIpcErrorToPublicFailure = (
  error: unknown
): { success: false; error: string } | null => {
  if (isUnauthorizedSenderError(error)) {
    return {
      success: false,
      error: UNAUTHORIZED_PUBLIC_ERROR_MESSAGE,
    };
  }

  if (isInvalidPayloadError(error)) {
    return {
      success: false,
      error: INVALID_PAYLOAD_PUBLIC_ERROR_MESSAGE,
    };
  }

  if (isRateLimitedError(error)) {
    return {
      success: false,
      error: RATE_LIMITED_PUBLIC_ERROR_MESSAGE,
    };
  }

  return null;
};

export const clearPrivilegedIpcRateLimitState = (): void => {
  slidingWindowRateLimitState.clear();
};

export const registerPrivilegedIpcHandle = (
  electronIpcMain: Pick<IpcMain, 'handle'>,
  channelName: string,
  handler: PrivilegedChannelHandler,
  options?: PrivilegedIpcHandleOptions
): void => {
  const argsSchema = options?.argsSchema;
  const rateLimit = options?.rateLimit;

  electronIpcMain.handle(channelName, async (event, ...args) => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    let outcome: 'success' | 'public_failure' | 'unhandled_error' = 'success';
    let failureCode: string | null = null;

    try {
      assertTrustedSender(event);

      if (rateLimit !== undefined) {
        assertWithinRateLimit(event, channelName, rateLimit);
      }

      const parsedArgs = argsSchema === undefined ? args : parseIpcArgs(args, argsSchema);
      return await handler(event, ...parsedArgs);
    } catch (error) {
      const publicFailure = mapPrivilegedIpcErrorToPublicFailure(error);
      if (publicFailure !== null) {
        outcome = 'public_failure';
        failureCode = publicFailure.error;
        return publicFailure;
      }

      outcome = 'unhandled_error';
      failureCode = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      throw error;
    } finally {
      logDiagnosticsEvent({
        event_name: 'ipc.request.completed',
        level: outcome === 'unhandled_error' ? 'error' : 'info',
        context: {
          request_id: requestId,
          channel: channelName,
          sender_id: typeof event.sender?.id === 'number' ? event.sender.id : null,
          argument_count: args.length,
          duration_ms: Date.now() - startedAt,
          outcome,
          failure_code: failureCode,
        },
      });
    }
  });
};
