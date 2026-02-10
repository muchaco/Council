import type { ConductorBlackboard } from '../../domain/conductor';
import type {
  ConductorSelectionFollowUpEffect,
  MergeBlackboardPlan,
  RecordInterventionMessagePlan,
} from '../../plan/conductor-plan';

export interface SelectorFollowUpInput {
  readonly currentBlackboard: ConductorBlackboard;
  readonly updateBlackboard: Partial<ConductorBlackboard>;
  readonly isIntervention: boolean;
  readonly interventionMessage?: string;
  readonly selectorReasoning: string;
}

export const decideSelectorFollowUpEffects = (
  input: SelectorFollowUpInput
): readonly ConductorSelectionFollowUpEffect[] => {
  const effects: ConductorSelectionFollowUpEffect[] = [];

  if (Object.keys(input.updateBlackboard).length > 0) {
    const mergeBlackboard: MergeBlackboardPlan = {
      _tag: 'MergeBlackboard',
      nextBlackboard: {
        ...input.currentBlackboard,
        ...input.updateBlackboard,
      },
    };
    effects.push(mergeBlackboard);
  }

  if (input.isIntervention && input.interventionMessage) {
    const recordInterventionMessage: RecordInterventionMessagePlan = {
      _tag: 'RecordInterventionMessage',
      messageContent: input.interventionMessage,
      selectorReasoning: input.selectorReasoning,
    };
    effects.push(recordInterventionMessage);
  }

  return effects;
};
