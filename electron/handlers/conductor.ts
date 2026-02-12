import { app, ipcMain as electronIpcMain } from 'electron';
import { Effect } from 'effect';
import { z } from 'zod';

import { decrypt } from './settings.js';
import * as queries from '../lib/queries.js';
import { makeElectronSqlQueryExecutor } from '../lib/sql-query-executor.js';
import type { BlackboardState } from '../lib/types.js';
import {
  ConductorSettings,
  ConductorSelectorGateway,
  ConductorTurnRepository,
  executeConductorTurn,
  type SelectNextSpeakerRequest,
} from '../../lib/application/use-cases/conductor/index.js';
import {
  makeConductorTurnRepositoryFromSqlExecutor,
} from '../../lib/infrastructure/db/index.js';
import { LiveIdGeneratorLayer } from '../../lib/infrastructure/id/index.js';
import { makeConductorSelectorGatewayFromExecutor } from '../../lib/infrastructure/llm/index.js';
import {
  createCouncilSettingsStore,
  makeConductorSettingsService,
} from '../../lib/infrastructure/settings/index.js';
import { mapConductorTurnOutcomeToProcessTurnResponse } from '../lib/shell/conductor-process-turn-response.js';
import { executeConductorSelectorRequest } from '../lib/shell/conductor-selector-executor.js';
import {
  mapBlackboardLookupResponse,
  mapErrorFailureResponse,
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

export function setupConductorHandlers(): void {
  const sqlExecutor = makeElectronSqlQueryExecutor();
  const repository = makeConductorTurnRepositoryFromSqlExecutor(sqlExecutor);
  const selectorGateway = makeConductorSelectorGatewayFromExecutor((request: SelectNextSpeakerRequest) =>
    executeConductorSelectorRequest(request)
  );
  const settingsStore = createCouncilSettingsStore<{ apiKey?: string }>(app.isPackaged);
  const settings = makeConductorSettingsService(decrypt, settingsStore);

  // Enable conductor for a session
  ipcMain.handle('conductor:enable', async (_, { sessionId, conductorPersonaId }: { sessionId: string; conductorPersonaId: string }) => {
    try {
      await queries.enableConductor(sessionId, conductorPersonaId);
      return mapVoidSuccessResponse();
    } catch (error) {
      console.error('Error enabling conductor:', error);
      return mapErrorFailureResponse(error);
    }
  });

  // Disable conductor for a session
  ipcMain.handle('conductor:disable', async (_, sessionId: string) => {
    try {
      await queries.disableConductor(sessionId);
      await queries.resetAutoReplyCount(sessionId);
      return mapVoidSuccessResponse();
    } catch (error) {
      console.error('Error disabling conductor:', error);
      return mapErrorFailureResponse(error);
    }
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

      return mapConductorTurnOutcomeToProcessTurnResponse(outcome);

    } catch (error) {
      console.error('Orchestration error:', error);
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
      await queries.resetAutoReplyCount(sessionId);
      return mapVoidSuccessResponse();
    } catch (error) {
      console.error('Error resetting circuit breaker:', error);
      return mapErrorFailureResponse(error);
    }
  });

  // Get blackboard state
  ipcMain.handle('conductor:getBlackboard', async (_, sessionId: string) => {
    try {
      const session = await queries.getSession(sessionId);
      return mapBlackboardLookupResponse(session);
    } catch (error) {
      console.error('Error getting blackboard:', error);
      return mapErrorFailureResponse(error);
    }
  });

  // Update blackboard manually (for testing or debugging)
  ipcMain.handle('conductor:updateBlackboard', async (_, { sessionId, blackboard }: { sessionId: string; blackboard: BlackboardState }) => {
    try {
      await queries.updateBlackboard(sessionId, blackboard);
      return mapVoidSuccessResponse();
    } catch (error) {
      console.error('Error updating blackboard:', error);
      return mapErrorFailureResponse(error);
    }
  });
}
