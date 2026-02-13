import { app, ipcMain as electronIpcMain } from 'electron';
import { Effect, Either } from 'effect';
import { z } from 'zod';

import { decrypt } from './settings.js';
import { logDiagnosticsError, logDiagnosticsEvent } from '../lib/diagnostics/logger.js';
import { makeElectronSqlQueryExecutor } from '../lib/sql-query-executor.js';
import type { BlackboardState } from '../lib/types.js';
import {
  ConductorSettings,
  ConductorSelectorGateway,
  ConductorTurnRepository,
  executeDisableConductorForSession,
  executeEnableConductorForSession,
  executeGetSessionBlackboard,
  executeConductorTurn,
  executeUpdateConductorSessionBlackboard,
} from '../../lib/application/use-cases/conductor/index.js';
import {
  executeResetSessionAutoReplyCount,
  SessionStateRepository,
} from '../../lib/application/use-cases/session-state/index.js';
import { QueryLayerRepository } from '../../lib/application/use-cases/query-layer/index.js';
import {
  makeQueryLayerRepositoryFromSqlExecutor,
  makeSessionStateRepositoryFromSqlExecutor,
  makeConductorTurnRepositoryFromSqlExecutor,
} from '../../lib/infrastructure/db/index.js';
import { LiveIdGeneratorLayer } from '../../lib/infrastructure/id/index.js';
import {
  createConductorSelectorGateway,
  createProviderRegistry,
  createGeminiGatewayAdapter,
} from '../../lib/infrastructure/llm/index.js';
import {
  createCouncilSettingsStore,
  makeConductorSettingsService,
  LlmSettings,
  type LlmProviderConfig,
  type ProviderId,
} from '../../lib/infrastructure/settings/index.js';
import { mapConductorTurnOutcomeToProcessTurnResponse } from '../lib/shell/conductor-process-turn-response.js';
import {
  mapBlackboardLookupResponse,
  mapErrorFailureResponse,
  mapSessionNotFoundResponse,
  mapVoidSuccessResponse,
} from '../lib/shell/conductor-handler-response.js';
import {
  registerPrivilegedIpcHandle,
  type PrivilegedIpcHandleOptions,
} from '../lib/security/privileged-ipc.js';

const ipcMain = {
  handle: (
    channelName: string,
    handler: (...args: any[]) => unknown,
    options?: PrivilegedIpcHandleOptions
  ): void => {
    registerPrivilegedIpcHandle(electronIpcMain, channelName, handler as any, options);
  },
};

const sessionIdSchema = z.string();
const enableConductorArgsSchema = z.tuple([
  z.object({
    sessionId: sessionIdSchema,
    mode: z.enum(['automatic', 'manual']),
  }),
]);
const updateBlackboardArgsSchema = z.tuple([
  z.object({
    sessionId: sessionIdSchema,
    blackboard: z.object({
      consensus: z.string(),
      conflicts: z.string(),
      nextStep: z.string(),
      facts: z.string(),
    }),
  }),
]);

export function setupConductorHandlers(): void {
  const sqlExecutor = makeElectronSqlQueryExecutor();
  const repository = makeConductorTurnRepositoryFromSqlExecutor(sqlExecutor);
  const sessionStateRepository = makeSessionStateRepositoryFromSqlExecutor(sqlExecutor);
  const queryLayerRepository = makeQueryLayerRepositoryFromSqlExecutor(sqlExecutor);
  const selectorGateway = makeConductorSelectorGatewayFromExecutor((request: SelectNextSpeakerRequest) =>
    executeConductorSelectorRequest(request)
  );
  const settingsStore = createCouncilSettingsStore<{ apiKey?: string }>(app.isPackaged);
  const settings = makeConductorSettingsService(decrypt, settingsStore);

  // Enable conductor for a session
  ipcMain.handle('conductor:enable', async (_, { sessionId, mode }: { sessionId: string; mode: 'automatic' | 'manual' }) => {
    try {
      const outcome = await Effect.runPromise(
        executeEnableConductorForSession(sessionId, mode).pipe(
          Effect.provideService(SessionStateRepository, sessionStateRepository),
          Effect.either
        )
      );

      if (Either.isLeft(outcome)) {
        return mapErrorFailureResponse(outcome.left);
      }

      return mapVoidSuccessResponse();
    } catch (error) {
      logDiagnosticsError('conductor.enable.failed', error, {
        session_id: sessionId,
        mode,
      });
      return mapErrorFailureResponse(error);
    }
  }, {
    argsSchema: enableConductorArgsSchema,
  });

  // Disable conductor for a session
  ipcMain.handle('conductor:disable', async (_, sessionId: string) => {
    try {
      const outcome = await Effect.runPromise(
        executeDisableConductorForSession(sessionId).pipe(
          Effect.provideService(SessionStateRepository, sessionStateRepository),
          Effect.either
        )
      );

      if (Either.isLeft(outcome)) {
        return mapErrorFailureResponse(outcome.left);
      }

      return mapVoidSuccessResponse();
    } catch (error) {
      logDiagnosticsError('conductor.disable.failed', error, {
        session_id: sessionId,
      });
      return mapErrorFailureResponse(error);
    }
  }, {
    argsSchema: z.tuple([sessionIdSchema]),
  });

  // Process a turn - this is the main orchestration loop
  ipcMain.handle('conductor:processTurn', async (_, sessionId: string) => {
    try {
      const outcome = await Effect.runPromise(
        executeConductorTurn({ sessionId }).pipe(
          Effect.provideService(ConductorTurnRepository, repository),
          Effect.provideService(ConductorSelectorGateway, selectorGateway),
          Effect.provideService(ConductorSettings, settings),
          Effect.provide(LiveIdGeneratorLayer),
          Effect.either
        )
      );

      const errorContext =
        outcome._tag === 'Left'
          ? {
              error_tag: (outcome.left as { _tag?: string })._tag ?? 'Unknown',
              error_message: (outcome.left as { message?: string }).message ?? 'No message',
              error_code: (outcome.left as { code?: string }).code ?? null,
              error_source: (outcome.left as { source?: string }).source ?? null,
            }
          : {};

      logDiagnosticsEvent({
        event_name: 'conductor.turn.completed',
        context: {
          session_id: sessionId,
          outcome_tag: outcome._tag,
          ...errorContext,
        },
      });

      return mapConductorTurnOutcomeToProcessTurnResponse(outcome);

    } catch (error) {
      logDiagnosticsError('conductor.turn.failed', error, {
        session_id: sessionId,
      });
      return mapErrorFailureResponse(error);
    }
  }, {
    argsSchema: z.tuple([sessionIdSchema]),
    rateLimit: {
      maxRequests: 20,
      windowMs: 60_000,
    },
  });

  // Reset circuit breaker (user clicked continue)
  ipcMain.handle('conductor:resetCircuitBreaker', async (_, sessionId: string) => {
    try {
      const outcome = await Effect.runPromise(
        executeResetSessionAutoReplyCount(sessionId).pipe(
          Effect.provideService(SessionStateRepository, sessionStateRepository),
          Effect.either
        )
      );

      if (Either.isLeft(outcome)) {
        return mapErrorFailureResponse(outcome.left);
      }

      return mapVoidSuccessResponse();
    } catch (error) {
      logDiagnosticsError('conductor.circuit_breaker_reset.failed', error, {
        session_id: sessionId,
      });
      return mapErrorFailureResponse(error);
    }
  }, {
    argsSchema: z.tuple([sessionIdSchema]),
  });

  // Get blackboard state
  ipcMain.handle('conductor:getBlackboard', async (_, sessionId: string) => {
    try {
      const outcome = await Effect.runPromise(
        executeGetSessionBlackboard(sessionId).pipe(
          Effect.provideService(QueryLayerRepository, queryLayerRepository),
          Effect.either
        )
      );

      if (Either.isLeft(outcome)) {
        return mapErrorFailureResponse(outcome.left);
      }

      if (outcome.right === null) {
        return mapSessionNotFoundResponse();
      }

      return mapBlackboardLookupResponse({ blackboard: outcome.right });
    } catch (error) {
      logDiagnosticsError('conductor.blackboard.get.failed', error, {
        session_id: sessionId,
      });
      return mapErrorFailureResponse(error);
    }
  }, {
    argsSchema: z.tuple([sessionIdSchema]),
  });

  // Update blackboard manually (for testing or debugging)
  ipcMain.handle('conductor:updateBlackboard', async (_, { sessionId, blackboard }: { sessionId: string; blackboard: BlackboardState }) => {
    try {
      const outcome = await Effect.runPromise(
        executeUpdateConductorSessionBlackboard(sessionId, blackboard).pipe(
          Effect.provideService(SessionStateRepository, sessionStateRepository),
          Effect.either
        )
      );

      if (Either.isLeft(outcome)) {
        return mapErrorFailureResponse(outcome.left);
      }

      return mapVoidSuccessResponse();
    } catch (error) {
      logDiagnosticsError('conductor.blackboard.update.failed', error, {
        session_id: sessionId,
      });
      return mapErrorFailureResponse(error);
    }
  }, {
    argsSchema: updateBlackboardArgsSchema,
  });
}
