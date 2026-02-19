import { describe, expect } from "vitest";

import { verifyCoverageGuardrails } from "../../scripts/verify-coverage-guardrails";
import { itReq } from "../helpers/requirement-trace";

describe("coverage guardrails", () => {
  itReq(["H3", "IMPL-006"], "keeps architecture-aligned coverage include scopes", () => {
    const result = verifyCoverageGuardrails();
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
