import type { GeneratedPersonaTurn, SessionUsagePricingPolicy, SessionUsageSnapshot } from '../domain/session-messaging';
import { defaultSessionUsagePricingPolicy } from '../domain/session-messaging';
import type { UpdateSessionUsagePlan } from '../plan/session-messaging-plan';

export const decideSessionUsageUpdate = (
  snapshot: SessionUsageSnapshot,
  generatedTurn: GeneratedPersonaTurn,
  pricingPolicy: SessionUsagePricingPolicy = defaultSessionUsagePricingPolicy
): UpdateSessionUsagePlan => {
  const nextTokenCount = snapshot.tokenCount + generatedTurn.tokenCount;

  return {
    nextTokenCount,
    nextCostEstimate: nextTokenCount * pricingPolicy.costPerToken,
  };
};
