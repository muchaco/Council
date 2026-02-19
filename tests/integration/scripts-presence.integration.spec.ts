import { describe, expect } from "vitest";
import { verifyRequiredScripts } from "../../scripts/verify-required-scripts";
import { itReq } from "../helpers/requirement-trace";

describe("required scripts", () => {
  itReq(["H1", "H3", "IMPL-001"], "contains mandatory quality gates", () => {
    const result = verifyRequiredScripts();
    expect(result.ok).toBe(true);
    expect(result.missing).toHaveLength(0);
  });
});
