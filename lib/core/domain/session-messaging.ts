export interface SessionUsagePricingPolicy {
  readonly costPerToken: number;
}

export interface SessionUsageSnapshot {
  readonly tokenCount: number;
}

export interface GeneratedPersonaTurn {
  readonly tokenCount: number;
}

export const defaultSessionUsagePricingPolicy: SessionUsagePricingPolicy = {
  costPerToken: 0.000001,
};
