import { Effect, Either } from 'effect';

import { makeElectronSqlQueryExecutor } from './sql-query-executor.js';
import type { Persona, PersonaInput, Session, SessionInput, Message, MessageInput, Tag, TagInput, SessionPersona } from './types.js';
import {
  CouncilTranscriptRepository,
  SessionParticipationRepository,
  ReusablePersonaRepository,
  SessionStateRepository,
  SessionTagCatalogRepository,
  QueryLayerRepository,
  executeAddSessionParticipant,
  executeArchiveSession,
  executeAssignSessionTagCatalogEntryToSession,
  executeCleanupOrphanedSessionTags,
  executeClearSessionParticipantHush,
  executeCreateCouncilTranscriptMessage,
  executeCreateReusablePersona,
  executeCreateSessionState,
  executeCreateSessionTagCatalogEntry,
  executeDecrementAllSessionParticipantHushTurns,
  executeDecrementSessionParticipantHush,
  executeDeleteReusablePersona,
  executeDeleteSessionState,
  executeDeleteSessionTagCatalogEntry,
  executeDisableSessionOrchestrator,
  executeEnableSessionOrchestrator,
  executeIncrementSessionAutoReplyCount,
  executeIsSessionArchived,
  executeLoadCouncilTranscript,
  executeLoadRecentCouncilTranscript,
  executeLoadReusablePersonaById,
  executeLoadReusablePersonas,
  executeLoadSessionTagByName,
  executeLoadSessionTagNames,
  executeLoadSessionParticipants,
  executeLoadActiveSessionTagCatalog,
  executeLoadHushedSessionParticipantIds,
  executeLoadNextCouncilTurnNumber,
  executeRemoveSessionParticipant,
  executeRemoveSessionTagCatalogEntryFromSession,
  executeResetSessionAutoReplyCount,
  executeSetSessionParticipantHush,
  executeLoadSessionById,
  executeLoadSessions,
  executeUnarchiveSession,
  executeUpdateReusablePersona,
  executeUpdateSessionBlackboard,
  executeUpdateSessionState,
  executeUpdateSessionSummary,
  type CouncilTranscriptInfrastructureError,
  type QueryLayerInfrastructureError,
  type ReusablePersonaInfrastructureError,
  type SessionStateInfrastructureError,
  type SessionTagCatalogInfrastructureError,
  type SessionParticipationInfrastructureError,
} from '../../lib/application/use-cases';
import {
  makeCouncilTranscriptRepositoryFromSqlExecutor,
  makeQueryLayerRepositoryFromSqlExecutor,
  makeReusablePersonaRepositoryFromSqlExecutor,
  makeSessionStateRepositoryFromSqlExecutor,
  makeSessionTagCatalogRepositoryFromSqlExecutor,
  makeSessionParticipationRepositoryFromSqlExecutor,
} from '../../lib/infrastructure/db';

const sqlQueryExecutor = makeElectronSqlQueryExecutor();
const queryLayerRepository = makeQueryLayerRepositoryFromSqlExecutor(sqlQueryExecutor);
const councilTranscriptRepository = makeCouncilTranscriptRepositoryFromSqlExecutor(sqlQueryExecutor);
const sessionParticipationRepository = makeSessionParticipationRepositoryFromSqlExecutor(sqlQueryExecutor);
const reusablePersonaRepository = makeReusablePersonaRepositoryFromSqlExecutor(sqlQueryExecutor);
const sessionStateRepository = makeSessionStateRepositoryFromSqlExecutor(sqlQueryExecutor);
const sessionTagCatalogRepository = makeSessionTagCatalogRepositoryFromSqlExecutor(sqlQueryExecutor);

const runQueryLayerRead = async <A>(
  operation: Effect.Effect<A, QueryLayerInfrastructureError, QueryLayerRepository>
): Promise<A> => {
  const result = await Effect.runPromise(
    operation.pipe(
      Effect.provideService(QueryLayerRepository, queryLayerRepository),
      Effect.either
    )
  );

  if (Either.isLeft(result)) {
    throw new Error(result.left.message);
  }

  return result.right;
};

const runCouncilTranscriptRead = async <A>(
  operation: Effect.Effect<A, CouncilTranscriptInfrastructureError, CouncilTranscriptRepository>
): Promise<A> => {
  const result = await Effect.runPromise(
    operation.pipe(
      Effect.provideService(CouncilTranscriptRepository, councilTranscriptRepository),
      Effect.either
    )
  );

  if (Either.isLeft(result)) {
    throw new Error(result.left.message);
  }

  return result.right;
};

const runSessionParticipationRead = async <A>(
  operation: Effect.Effect<A, SessionParticipationInfrastructureError, SessionParticipationRepository>
): Promise<A> => {
  const result = await Effect.runPromise(
    operation.pipe(
      Effect.provideService(SessionParticipationRepository, sessionParticipationRepository),
      Effect.either
    )
  );

  if (Either.isLeft(result)) {
    throw new Error(result.left.message);
  }

  return result.right;
};

const runReusablePersona = async <A>(
  operation: Effect.Effect<A, ReusablePersonaInfrastructureError, ReusablePersonaRepository>
): Promise<A> => {
  const result = await Effect.runPromise(
    operation.pipe(
      Effect.provideService(ReusablePersonaRepository, reusablePersonaRepository),
      Effect.either
    )
  );

  if (Either.isLeft(result)) {
    throw new Error(result.left.message);
  }

  return result.right;
};

const runSessionState = async <A>(
  operation: Effect.Effect<A, SessionStateInfrastructureError, SessionStateRepository>
): Promise<A> => {
  const result = await Effect.runPromise(
    operation.pipe(
      Effect.provideService(SessionStateRepository, sessionStateRepository),
      Effect.either
    )
  );

  if (Either.isLeft(result)) {
    throw new Error(result.left.message);
  }

  return result.right;
};

const runSessionTagCatalog = async <A>(
  operation: Effect.Effect<A, SessionTagCatalogInfrastructureError, SessionTagCatalogRepository>
): Promise<A> => {
  const result = await Effect.runPromise(
    operation.pipe(
      Effect.provideService(SessionTagCatalogRepository, sessionTagCatalogRepository),
      Effect.either
    )
  );

  if (Either.isLeft(result)) {
    throw new Error(result.left.message);
  }

  return result.right;
};

// Persona operations
export async function createPersona(data: PersonaInput): Promise<Persona> {
  return runReusablePersona(executeCreateReusablePersona(data));
}

export async function getPersonas(): Promise<Persona[]> {
  return runReusablePersona(executeLoadReusablePersonas());
}

export async function getPersona(id: string): Promise<Persona | null> {
  return runReusablePersona(executeLoadReusablePersonaById(id));
}

export async function updatePersona(id: string, data: Partial<PersonaInput>): Promise<Persona> {
  const updated = await runReusablePersona(executeUpdateReusablePersona(id, data));
  if (!updated) {
    throw new Error('Persona not found after update');
  }
  return updated;
}

export async function deletePersona(id: string): Promise<void> {
  await runReusablePersona(executeDeleteReusablePersona(id));
}

// Session operations
export async function createSession(
  data: SessionInput,
  orchestratorConfig?: { enabled: boolean; orchestratorPersonaId?: string }
): Promise<Session> {
  return runSessionState(executeCreateSessionState(data, orchestratorConfig));
}

export async function getSessions(): Promise<Session[]> {
  return runQueryLayerRead(executeLoadSessions());
}

export async function getSession(id: string): Promise<Session | null> {
  return runQueryLayerRead(executeLoadSessionById(id));
}

export async function updateSession(
  id: string, 
  data: Partial<SessionInput> & { 
    status?: string; 
    tokenCount?: number; 
    costEstimate?: number;
    orchestratorEnabled?: boolean;
    orchestratorPersonaId?: string | null;
    blackboard?: any;
    autoReplyCount?: number;
    tokenBudget?: number;
    summary?: string | null;
  }
): Promise<Session> {
  await runSessionState(executeUpdateSessionState(id, data));
  
  const updated = await getSession(id);
  if (!updated) {
    throw new Error('Session not found after update');
  }
  return updated;
}

export async function deleteSession(id: string): Promise<void> {
  await runSessionState(executeDeleteSessionState(id));
}

// Message operations
export async function createMessage(data: MessageInput): Promise<Message> {
  return runCouncilTranscriptRead(executeCreateCouncilTranscriptMessage(data));
}

export async function getMessagesBySession(sessionId: string): Promise<Message[]> {
  return runCouncilTranscriptRead(executeLoadCouncilTranscript(sessionId));
}

export async function getLastMessages(sessionId: string, limit: number = 10): Promise<Message[]> {
  return runCouncilTranscriptRead(executeLoadRecentCouncilTranscript(sessionId, limit));
}

// Session Persona operations
export async function addPersonaToSession(sessionId: string, personaId: string, isOrchestrator: boolean = false): Promise<void> {
  await runSessionParticipationRead(executeAddSessionParticipant(sessionId, personaId, isOrchestrator));
}

export async function getSessionPersonas(sessionId: string): Promise<SessionPersona[]> {
  return runSessionParticipationRead(executeLoadSessionParticipants(sessionId));
}

// Hush operations - "The Hush Button" feature
export async function setPersonaHush(sessionId: string, personaId: string, turns: number): Promise<void> {
  await runSessionParticipationRead(executeSetSessionParticipantHush(sessionId, personaId, turns));
}

export async function decrementPersonaHush(sessionId: string, personaId: string): Promise<number> {
  return runSessionParticipationRead(executeDecrementSessionParticipantHush(sessionId, personaId));
}

export async function clearPersonaHush(sessionId: string, personaId: string): Promise<void> {
  await runSessionParticipationRead(executeClearSessionParticipantHush(sessionId, personaId));
}

export async function decrementAllHushTurns(sessionId: string): Promise<void> {
  await runSessionParticipationRead(executeDecrementAllSessionParticipantHushTurns(sessionId));
}

export async function getHushedPersonas(sessionId: string): Promise<string[]> {
  const hushedPersonaIds = await runSessionParticipationRead(
    executeLoadHushedSessionParticipantIds(sessionId)
  );
  return [...hushedPersonaIds];
}

export async function removePersonaFromSession(sessionId: string, personaId: string): Promise<void> {
  await runSessionParticipationRead(executeRemoveSessionParticipant(sessionId, personaId));
}

// Get next turn number
export async function getNextTurnNumber(sessionId: string): Promise<number> {
  return runCouncilTranscriptRead(executeLoadNextCouncilTurnNumber(sessionId));
}

// Orchestrator operations
export async function updateBlackboard(sessionId: string, blackboard: any): Promise<void> {
  await runSessionState(executeUpdateSessionBlackboard(sessionId, blackboard));
}

export async function updateSessionSummary(sessionId: string, summary: string): Promise<void> {
  await runSessionState(executeUpdateSessionSummary(sessionId, summary));
}

export async function incrementAutoReplyCount(sessionId: string): Promise<number> {
  return runSessionState(executeIncrementSessionAutoReplyCount(sessionId));
}

export async function resetAutoReplyCount(sessionId: string): Promise<void> {
  await runSessionState(executeResetSessionAutoReplyCount(sessionId));
}

export async function enableOrchestrator(sessionId: string, orchestratorPersonaId: string): Promise<void> {
  await runSessionState(executeEnableSessionOrchestrator(sessionId, orchestratorPersonaId));
}

export async function disableOrchestrator(sessionId: string): Promise<void> {
  await runSessionState(executeDisableSessionOrchestrator(sessionId));
}

// Session archiving
export async function archiveSession(sessionId: string): Promise<void> {
  await runSessionState(executeArchiveSession(sessionId));
}

export async function unarchiveSession(sessionId: string): Promise<void> {
  await runSessionState(executeUnarchiveSession(sessionId));
}

export async function isSessionArchived(sessionId: string): Promise<boolean> {
  return runSessionState(executeIsSessionArchived(sessionId));
}

// Tag operations
export async function createTag(data: TagInput): Promise<Tag> {
  return runSessionTagCatalog(executeCreateSessionTagCatalogEntry(data));
}

export async function getTagByName(name: string): Promise<Tag | null> {
  return runSessionTagCatalog(executeLoadSessionTagByName(name));
}

export async function getAllTags(): Promise<Tag[]> {
  return runSessionTagCatalog(executeLoadActiveSessionTagCatalog());
}

export async function deleteTag(id: number): Promise<void> {
  await runSessionTagCatalog(executeDeleteSessionTagCatalogEntry(id));
}

// Session-Tag operations
export async function addTagToSession(sessionId: string, tagId: number): Promise<void> {
  await runSessionTagCatalog(executeAssignSessionTagCatalogEntryToSession(sessionId, tagId));
}

export async function removeTagFromSession(sessionId: string, tagId: number): Promise<void> {
  await runSessionTagCatalog(executeRemoveSessionTagCatalogEntryFromSession(sessionId, tagId));
}

export async function getTagsBySession(sessionId: string): Promise<string[]> {
  return runSessionTagCatalog(executeLoadSessionTagNames(sessionId));
}

export async function cleanupOrphanedTags(): Promise<number> {
  return runSessionTagCatalog(executeCleanupOrphanedSessionTags());
}
