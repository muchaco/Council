import { describe, expect } from "vitest";
import { runBoundaryCheck } from "../../scripts/check-boundaries";
import { itReq } from "../helpers/requirement-trace";

describe("architecture boundary script", () => {
  itReq(["A3", "IMPL-005"], "passes for baseline source tree", () => {
    const result = runBoundaryCheck();
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
