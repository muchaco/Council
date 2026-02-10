import type {
  AutoReplySafetyPolicy,
  ConductorSessionSnapshot,
} from '../../domain/conductor';
import { defaultAutoReplySafetyPolicy } from '../../domain/conductor';
import type { CircuitBreakerDecisionPlan } from '../../plan/conductor-plan';

export const decideCircuitBreaker = (
  session: Pick<ConductorSessionSnapshot, 'autoReplyCount' | 'tokenCount'>,
  policy: AutoReplySafetyPolicy = defaultAutoReplySafetyPolicy
): CircuitBreakerDecisionPlan => {
  if (session.autoReplyCount >= policy.maxAutoReplies) {
    return {
      _tag: 'PauseForUserConfirmation',
      message: `Circuit breaker: Maximum ${policy.maxAutoReplies} auto-replies reached. Click continue to proceed.`,
    };
  }

  if (session.tokenCount >= policy.tokenBudgetLimit) {
    return {
      _tag: 'PauseForUserConfirmation',
      message: `Token budget exceeded (${session.tokenCount.toLocaleString()} / ${policy.tokenBudgetLimit.toLocaleString()}). Session paused.`,
    };
  }

  if (session.tokenCount >= policy.tokenBudgetWarning) {
    return {
      _tag: 'ContinueWithBudgetWarning',
      warning: `Warning: Token usage at ${Math.round((session.tokenCount / policy.tokenBudgetLimit) * 100)}% of budget`,
    };
  }

  return { _tag: 'ContinueWithinBudget' };
};
