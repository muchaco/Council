import { describe, expect, it } from 'vitest';

import { decideSessionUsageUpdate } from './decide-session-usage-update';

describe('decide_session_usage_update_spec', () => {
  it('adds_generated_tokens_and_recomputes_cost_estimate', () => {
    const plan = decideSessionUsageUpdate(
      { tokenCount: 1_000 },
      { tokenCount: 250 },
      { costPerToken: 0.000001 }
    );

    expect(plan).toEqual({
      nextTokenCount: 1_250,
      nextCostEstimate: 0.00125,
    });
  });
});
