import type {
  ConductorBlackboard,
  ConductorSessionSnapshot,
  ConductorSelectorPromptInput,
  EligibleSpeaker,
  MutedSpeaker,
} from '../domain/conductor';

export interface PauseForUserConfirmationPlan {
  readonly _tag: 'PauseForUserConfirmation';
  readonly message: string;
}

export interface ContinueWithBudgetWarningPlan {
  readonly _tag: 'ContinueWithBudgetWarning';
  readonly warning: string;
}

export interface ContinueWithinBudgetPlan {
  readonly _tag: 'ContinueWithinBudget';
}

export type CircuitBreakerDecisionPlan =
  | PauseForUserConfirmationPlan
  | ContinueWithBudgetWarningPlan
  | ContinueWithinBudgetPlan;

export interface SpeakerEligibilityPlan {
  readonly lastSpeakerId: string | null;
  readonly eligibleSpeakers: readonly EligibleSpeaker[];
  readonly mutedSpeakers: readonly MutedSpeaker[];
}

export interface WaitForUserPlan {
  readonly _tag: 'WaitForUser';
  readonly reasoning: string;
}

export interface TriggerPersonaPlan {
  readonly _tag: 'TriggerPersona';
  readonly personaId: string;
  readonly reasoning: string;
  readonly isIntervention: boolean;
}

export interface SuggestPersonaAndWaitForUserPlan {
  readonly _tag: 'SuggestPersonaAndWaitForUser';
  readonly personaId: string;
  readonly reasoning: string;
  readonly isIntervention: boolean;
}

export type NextActionPlan = WaitForUserPlan | TriggerPersonaPlan | SuggestPersonaAndWaitForUserPlan;

export interface MergeBlackboardPlan {
  readonly _tag: 'MergeBlackboard';
  readonly nextBlackboard: ConductorBlackboard;
}

export interface RecordInterventionMessagePlan {
  readonly _tag: 'RecordInterventionMessage';
  readonly messageContent: string;
  readonly selectorReasoning: string;
}

export type ConductorSelectionFollowUpEffect =
  | MergeBlackboardPlan
  | RecordInterventionMessagePlan;

export interface StopForCircuitBreakerPlan {
  readonly _tag: 'StopForCircuitBreaker';
  readonly message: string;
}

export interface ContinueConductorTurnPlan {
  readonly _tag: 'ContinueConductorTurn';
  readonly session: ConductorSessionSnapshot;
  readonly warning?: string;
}

export type ConductorTurnPreflightPlan = StopForCircuitBreakerPlan | ContinueConductorTurnPlan;

export interface WaitForUserBeforeSelectionPlan {
  readonly _tag: 'WaitForUserBeforeSelection';
  readonly reasoning: string;
}

export interface RequestSelectorDecisionPlan {
  readonly _tag: 'RequestSelectorDecision';
  readonly selectorModel: string;
  readonly selectorPromptInput: ConductorSelectorPromptInput;
  readonly currentBlackboard: ConductorBlackboard;
}

export type ConductorSelectorPlan = WaitForUserBeforeSelectionPlan | RequestSelectorDecisionPlan;

export interface WaitForUserAfterSelectionPlan {
  readonly _tag: 'WaitForUserAfterSelection';
  readonly reasoning: string;
  readonly blackboardUpdate: Partial<ConductorBlackboard>;
  readonly followUpEffects: readonly ConductorSelectionFollowUpEffect[];
}

export interface TriggerPersonaAfterSelectionPlan {
  readonly _tag: 'TriggerPersonaAfterSelection';
  readonly personaId: string;
  readonly reasoning: string;
  readonly isIntervention: boolean;
  readonly blackboardUpdate: Partial<ConductorBlackboard>;
  readonly followUpEffects: readonly ConductorSelectionFollowUpEffect[];
}

export interface SuggestNextSpeakerAndWaitForUserPlan {
  readonly _tag: 'SuggestNextSpeakerAndWaitForUser';
  readonly suggestedPersonaId: string;
  readonly reasoning: string;
  readonly isIntervention: boolean;
  readonly blackboardUpdate: Partial<ConductorBlackboard>;
  readonly followUpEffects: readonly ConductorSelectionFollowUpEffect[];
}

export type ConductorTurnOutcomePlan =
  | WaitForUserAfterSelectionPlan
  | SuggestNextSpeakerAndWaitForUserPlan
  | TriggerPersonaAfterSelectionPlan;

export const noEligibleSpeakerReasoning =
  'All personas have spoken. Waiting for user input before next cycle.';
