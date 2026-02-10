export interface ConductorBlackboard {
  readonly consensus: string;
  readonly conflicts: string;
  readonly nextStep: string;
  readonly facts: string;
}

export interface ConductorSessionSnapshot {
  readonly sessionId: string;
  readonly orchestratorEnabled: boolean;
  readonly orchestratorPersonaId: string | null;
  readonly autoReplyCount: number;
  readonly tokenCount: number;
  readonly problemDescription: string;
  readonly outputGoal: string;
  readonly blackboard: ConductorBlackboard | null;
}

export interface ConductorPersonaSnapshot {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly geminiModel: string;
  readonly hushTurnsRemaining: number;
}

export interface ConductorMessageSnapshot {
  readonly personaId: string | null;
  readonly content: string;
}

export interface SelectorConversationMessage {
  readonly role: 'user' | 'model';
  readonly content: string;
  readonly personaName: string;
}

export interface EligibleSpeaker {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

export interface MutedSpeaker {
  readonly id: string;
  readonly name: string;
  readonly remainingTurns: number;
}

export interface AutoReplySafetyPolicy {
  readonly maxAutoReplies: number;
  readonly tokenBudgetWarning: number;
  readonly tokenBudgetLimit: number;
}

export const defaultAutoReplySafetyPolicy: AutoReplySafetyPolicy = {
  maxAutoReplies: 8,
  tokenBudgetWarning: 50_000,
  tokenBudgetLimit: 100_000,
};

export const emptyConductorBlackboard: ConductorBlackboard = {
  consensus: '',
  conflicts: '',
  nextStep: '',
  facts: '',
};

export const findLastSpeakerId = (
  messages: readonly ConductorMessageSnapshot[]
): string | null => {
  const lastPersonaMessage = [...messages].reverse().find((message) => message.personaId !== null);
  return lastPersonaMessage?.personaId ?? null;
};

export const toSelectorConversationMessages = (
  messages: readonly ConductorMessageSnapshot[],
  personas: readonly Pick<ConductorPersonaSnapshot, 'id' | 'name'>[]
): readonly SelectorConversationMessage[] =>
  messages.map((message) => {
    const persona = personas.find((candidate) => candidate.id === message.personaId);
    return {
      role: message.personaId === null ? ('user' as const) : ('model' as const),
      content: message.content,
      personaName: message.personaId === null ? 'User' : (persona?.name ?? 'Unknown'),
    };
  });
