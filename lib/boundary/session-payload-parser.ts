import type { BlackboardState, Session } from '../types';

export interface ParseSessionPayloadOptions {
  readonly fallbackTags?: ReadonlyArray<string>;
  readonly allowMissingTags?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isBlackboardState = (value: unknown): value is BlackboardState => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.consensus === 'string' &&
    typeof value.conflicts === 'string' &&
    typeof value.nextStep === 'string' &&
    typeof value.facts === 'string'
  );
};

const isSessionStatus = (value: unknown): value is Session['status'] =>
  value === 'active' || value === 'completed' || value === 'archived';

const parseStringArray = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : null;

const isSessionBase = (value: unknown): value is Omit<Session, 'tags'> & { readonly tags?: unknown } => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.problemDescription === 'string' &&
    typeof value.outputGoal === 'string' &&
    isSessionStatus(value.status) &&
    typeof value.tokenCount === 'number' &&
    typeof value.costEstimate === 'number' &&
    typeof value.conductorEnabled === 'boolean' &&
    (typeof value.conductorPersonaId === 'string' || value.conductorPersonaId === null) &&
    (value.blackboard === null || isBlackboardState(value.blackboard)) &&
    typeof value.autoReplyCount === 'number' &&
    typeof value.tokenBudget === 'number' &&
    (typeof value.summary === 'string' || value.summary === null) &&
    (typeof value.archivedAt === 'string' || value.archivedAt === null) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
};

export const parseSessionPayload = (
  value: unknown,
  options: ParseSessionPayloadOptions = {}
): Session | null => {
  if (!isSessionBase(value)) {
    return null;
  }

  const parsedTags = parseStringArray(value.tags);
  const nextTags =
    parsedTags ?? (options.allowMissingTags ? [...(options.fallbackTags ?? [])] : null);

  if (nextTags === null) {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    problemDescription: value.problemDescription,
    outputGoal: value.outputGoal,
    status: value.status,
    tokenCount: value.tokenCount,
    costEstimate: value.costEstimate,
    conductorEnabled: value.conductorEnabled,
    conductorPersonaId: value.conductorPersonaId,
    blackboard: value.blackboard,
    autoReplyCount: value.autoReplyCount,
    tokenBudget: value.tokenBudget,
    summary: value.summary,
    archivedAt: value.archivedAt,
    tags: nextTags,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

export const parseSessionPayloadList = (
  value: unknown,
  options: ParseSessionPayloadOptions = {}
): Session[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const sessions: Session[] = [];
  for (const entry of value) {
    const parsedSession = parseSessionPayload(entry, options);
    if (!parsedSession) {
      return null;
    }
    sessions.push(parsedSession);
  }

  return sessions;
};
