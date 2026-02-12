export interface ConductorBlackboard {
  readonly consensus: string;
  readonly conflicts: string;
  readonly nextStep: string;
  readonly facts: string;
}

export type ConductorControlMode = 'automatic' | 'manual';

export interface ConductorSessionSnapshot {
  readonly sessionId: string;
  readonly conductorEnabled: boolean;
  readonly controlMode: ConductorControlMode;
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
  readonly source: 'user' | 'persona' | 'conductor';
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

export interface ConductorSelectorPromptInput {
  readonly problemDescription: string;
  readonly outputGoal: string;
  readonly blackboard: ConductorBlackboard;
  readonly recentConversation: readonly SelectorConversationMessage[];
  readonly availablePersonas: readonly EligibleSpeaker[];
  readonly hushedPersonas: readonly MutedSpeaker[];
  readonly lastSpeakerId: string | null;
}

export interface ConductorSelectorDecision {
  readonly selectedPersonaId: string | 'WAIT_FOR_USER';
  readonly reasoning: string;
  readonly isIntervention: boolean;
  readonly interventionMessage?: string;
  readonly updateBlackboard: Partial<ConductorBlackboard>;
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
  const lastPersonaMessage = [...messages]
    .reverse()
    .find((message) => message.source === 'persona' && message.personaId !== null);
  return lastPersonaMessage?.personaId ?? null;
};

export const toSelectorConversationMessages = (
  messages: readonly ConductorMessageSnapshot[],
  personas: readonly Pick<ConductorPersonaSnapshot, 'id' | 'name'>[]
): readonly SelectorConversationMessage[] =>
  messages.map((message) => {
    const persona = personas.find((candidate) => candidate.id === message.personaId);

    const isPersonaMessage = message.source === 'persona' && message.personaId !== null;
    const personaName = (() => {
      if (message.source === 'conductor') {
        return 'Conductor';
      }

      if (!isPersonaMessage) {
        return 'User';
      }

      return persona?.name ?? 'Unknown';
    })();

    return {
      role: isPersonaMessage ? ('model' as const) : ('user' as const),
      content: message.content,
      personaName,
    };
  });
