import { Context, Effect } from 'effect';

import type { MessageMetadata } from '../../../types';

export interface PersistedCouncilTranscriptMessageRow {
  readonly id: string;
  readonly sessionId: string;
  readonly personaId: string | null;
  readonly content: string;
  readonly turnNumber: number;
  readonly tokenCount: number;
  readonly metadata: string | null;
  readonly createdAt: string;
}

export interface CouncilTranscriptInfrastructureError {
  readonly _tag: 'CouncilTranscriptInfrastructureError';
  readonly source: 'repository';
  readonly message: string;
}

export interface CreateCouncilTranscriptMessageCommand {
  readonly id: string;
  readonly now: string;
  readonly sessionId: string;
  readonly personaId: string | null;
  readonly content: string;
  readonly turnNumber: number;
  readonly tokenCount: number;
  readonly metadata: MessageMetadata | null;
}

export interface CouncilTranscriptRepositoryService {
  readonly createMessage: (
    command: CreateCouncilTranscriptMessageCommand
  ) => Effect.Effect<void, CouncilTranscriptInfrastructureError>;
  readonly listMessagesBySession: (
    sessionId: string
  ) => Effect.Effect<readonly PersistedCouncilTranscriptMessageRow[], CouncilTranscriptInfrastructureError>;
  readonly listRecentMessagesBySession: (
    sessionId: string,
    limit: number
  ) => Effect.Effect<readonly PersistedCouncilTranscriptMessageRow[], CouncilTranscriptInfrastructureError>;
  readonly readMaxTurnNumber: (sessionId: string) => Effect.Effect<number, CouncilTranscriptInfrastructureError>;
}

export class CouncilTranscriptRepository extends Context.Tag('CouncilTranscriptRepository')<
  CouncilTranscriptRepository,
  CouncilTranscriptRepositoryService
>() {}
