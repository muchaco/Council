import { ipcMain as electronIpcMain } from 'electron';
import { Effect, Either } from 'effect';
import { z } from 'zod';

import {
  executeArchiveSession,
  executeCreateSessionState,
  executeDeleteSessionState,
  executeUnarchiveSession,
  executeUpdateSessionState,
  SessionStateRepository,
} from '../../lib/application/use-cases/session-state/index.js';
import {
  executeLoadSessionById,
  executeLoadSessions,
  QueryLayerRepository,
} from '../../lib/application/use-cases/query-layer/index.js';
import {
  executeLoadCouncilTranscript,
  CouncilTranscriptRepository,
} from '../../lib/application/use-cases/council-transcript/index.js';
import {
  executeAddSessionParticipant,
  executeLoadSessionParticipants,
  SessionParticipationRepository,
} from '../../lib/application/use-cases/session-participation/index.js';
import {
  executeLoadSessionTagNames,
  SessionTagCatalogRepository,
} from '../../lib/application/use-cases/session-tag-catalog/index.js';
import {
  makeCouncilTranscriptRepositoryFromSqlExecutor,
  makeQueryLayerRepositoryFromSqlExecutor,
  makeSessionParticipationRepositoryFromSqlExecutor,
  makeSessionStateRepositoryFromSqlExecutor,
  makeSessionTagCatalogRepositoryFromSqlExecutor,
} from '../../lib/infrastructure/db/index.js';
import { LiveClockLayer } from '../../lib/infrastructure/clock/index.js';
import { LiveIdGeneratorLayer } from '../../lib/infrastructure/id/index.js';
import { makeElectronSqlQueryExecutor } from '../lib/sql-query-executor.js';
import {
  registerPrivilegedIpcHandle,
  type PrivilegedIpcHandleOptions,
} from '../lib/security/privileged-ipc.js';

const SESSION_OPERATION_PUBLIC_ERROR = 'Session operation failed';

const ipcMain = {
  handle: (
    channelName: string,
    handler: (...args: any[]) => unknown,
    options?: PrivilegedIpcHandleOptions
  ): void => {
    registerPrivilegedIpcHandle(electronIpcMain, channelName, handler as any, options);
  },
};

const sessionInputSchema = z.object({
  title: z.string().min(1),
  problemDescription: z.string().min(1),
  outputGoal: z.string().optional().default(''),
});

const sessionUpdateInputSchema = z.object({
  title: z.string().min(1).optional(),
  problemDescription: z.string().min(1).optional(),
  outputGoal: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  tokenCount: z.number().optional(),
  costEstimate: z.number().optional(),
  conductorEnabled: z.boolean().optional(),
  conductorMode: z.enum(['automatic', 'manual']).optional(),
  blackboard: z
    .object({
      consensus: z.string(),
      conflicts: z.string(),
      nextStep: z.string(),
      facts: z.string(),
    })
    .nullable()
    .optional(),
  autoReplyCount: z.number().int().optional(),
  tokenBudget: z.number().int().optional(),
  summary: z.string().nullable().optional(),
});

const sessionIdSchema = z.string().min(1);

const mapFailure = (): { success: false; error: string } => ({
  success: false,
  error: SESSION_OPERATION_PUBLIC_ERROR,
});

export function setupSessionStateHandlers(): void {
  const sqlExecutor = makeElectronSqlQueryExecutor();
  const sessionStateRepository = makeSessionStateRepositoryFromSqlExecutor(sqlExecutor);
  const queryLayerRepository = makeQueryLayerRepositoryFromSqlExecutor(sqlExecutor);
  const councilTranscriptRepository = makeCouncilTranscriptRepositoryFromSqlExecutor(sqlExecutor);
  const sessionParticipationRepository = makeSessionParticipationRepositoryFromSqlExecutor(sqlExecutor);
  const sessionTagCatalogRepository = makeSessionTagCatalogRepositoryFromSqlExecutor(sqlExecutor);

  ipcMain.handle(
    'session:command:createFull',
    async (
      _,
      command: {
        input: z.infer<typeof sessionInputSchema>;
        personaIds: string[];
        conductorConfig?: { enabled: boolean; mode?: 'automatic' | 'manual' };
      }
    ) => {
      const outcome = await Effect.runPromise(
        Effect.gen(function* () {
          const createdSession = yield* executeCreateSessionState(command.input, command.conductorConfig);
          for (const personaId of command.personaIds) {
            yield* executeAddSessionParticipant(createdSession.id, personaId, false);
          }
          return createdSession;
        }).pipe(
          Effect.provideService(SessionStateRepository, sessionStateRepository),
          Effect.provideService(SessionParticipationRepository, sessionParticipationRepository),
          Effect.provide(LiveIdGeneratorLayer),
          Effect.provide(LiveClockLayer),
          Effect.either
        )
      );

      if (Either.isLeft(outcome)) {
        return mapFailure();
      }

      return { success: true, data: outcome.right };
    },
    {
      argsSchema: z.tuple([
        z.object({
          input: sessionInputSchema,
          personaIds: z.array(z.string().min(1)),
          conductorConfig: z
            .object({
              enabled: z.boolean(),
              mode: z.enum(['automatic', 'manual']).optional(),
            })
            .optional(),
        }),
      ]),
    }
  );

  ipcMain.handle(
    'session:command:update',
    async (_, sessionId: string, input: z.infer<typeof sessionUpdateInputSchema>) => {
      const outcome = await Effect.runPromise(
        executeUpdateSessionState(sessionId, input).pipe(
          Effect.provideService(SessionStateRepository, sessionStateRepository),
          Effect.provide(LiveClockLayer),
          Effect.andThen(executeLoadSessionById(sessionId)),
          Effect.provideService(QueryLayerRepository, queryLayerRepository),
          Effect.either
        )
      );

      if (Either.isLeft(outcome) || outcome.right === null) {
        return mapFailure();
      }

      return {
        success: true,
        data: outcome.right,
      };
    },
    {
      argsSchema: z.tuple([sessionIdSchema, sessionUpdateInputSchema]),
    }
  );

  ipcMain.handle('session:command:delete', async (_, sessionId: string) => {
    const outcome = await Effect.runPromise(
      executeDeleteSessionState(sessionId).pipe(
        Effect.provideService(SessionStateRepository, sessionStateRepository),
        Effect.either
      )
    );

    if (Either.isLeft(outcome)) {
      return mapFailure();
    }

    return { success: true };
  }, {
    argsSchema: z.tuple([sessionIdSchema]),
  });

  ipcMain.handle('session:command:archive', async (_, sessionId: string) => {
    const outcome = await Effect.runPromise(
      executeArchiveSession(sessionId).pipe(
        Effect.provideService(SessionStateRepository, sessionStateRepository),
        Effect.provide(LiveClockLayer),
        Effect.either
      )
    );

    if (Either.isLeft(outcome)) {
      return mapFailure();
    }

    return { success: true };
  }, {
    argsSchema: z.tuple([sessionIdSchema]),
  });

  ipcMain.handle('session:command:unarchive', async (_, sessionId: string) => {
    const outcome = await Effect.runPromise(
      executeUnarchiveSession(sessionId).pipe(
        Effect.provideService(SessionStateRepository, sessionStateRepository),
        Effect.either
      )
    );

    if (Either.isLeft(outcome)) {
      return mapFailure();
    }

    return { success: true };
  }, {
    argsSchema: z.tuple([sessionIdSchema]),
  });

  ipcMain.handle('session:query:list', async () => {
    const outcome = await Effect.runPromise(
      executeLoadSessions().pipe(
        Effect.provideService(QueryLayerRepository, queryLayerRepository),
        Effect.either
      )
    );

    if (Either.isLeft(outcome)) {
      return mapFailure();
    }

    return { success: true, data: outcome.right };
  }, {
    argsSchema: z.tuple([]),
  });

  ipcMain.handle('session:query:get', async (_, sessionId: string) => {
    const outcome = await Effect.runPromise(
      executeLoadSessionById(sessionId).pipe(
        Effect.provideService(QueryLayerRepository, queryLayerRepository),
        Effect.either
      )
    );

    if (Either.isLeft(outcome)) {
      return mapFailure();
    }

    return { success: true, data: outcome.right };
  }, {
    argsSchema: z.tuple([sessionIdSchema]),
  });

  ipcMain.handle('session:query:participants', async (_, sessionId: string) => {
    const outcome = await Effect.runPromise(
      executeLoadSessionParticipants(sessionId).pipe(
        Effect.provideService(SessionParticipationRepository, sessionParticipationRepository),
        Effect.either
      )
    );

    if (Either.isLeft(outcome)) {
      return mapFailure();
    }

    return { success: true, data: outcome.right };
  }, {
    argsSchema: z.tuple([sessionIdSchema]),
  });

  ipcMain.handle('session:query:loadSnapshot', async (_, sessionId: string) => {
    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        const session = yield* executeLoadSessionById(sessionId);
        if (session === null) {
          return null;
        }

        const [messages, participants, tags] = yield* Effect.all([
          executeLoadCouncilTranscript(sessionId),
          executeLoadSessionParticipants(sessionId),
          executeLoadSessionTagNames(sessionId),
        ]);

        return {
          session,
          messages,
          participants,
          tags,
        };
      }).pipe(
        Effect.provideService(QueryLayerRepository, queryLayerRepository),
        Effect.provideService(CouncilTranscriptRepository, councilTranscriptRepository),
        Effect.provideService(SessionParticipationRepository, sessionParticipationRepository),
        Effect.provideService(SessionTagCatalogRepository, sessionTagCatalogRepository),
        Effect.either
      )
    );

    if (Either.isLeft(outcome)) {
      return mapFailure();
    }

    return {
      success: true,
      data: outcome.right,
    };
  }, {
    argsSchema: z.tuple([sessionIdSchema]),
  });
}
