import type {
  ConductorBlackboard,
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

export type NextActionPlan = WaitForUserPlan | TriggerPersonaPlan;

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

export const noEligibleSpeakerReasoning =
  'All personas have spoken. Waiting for user input before next cycle.';
