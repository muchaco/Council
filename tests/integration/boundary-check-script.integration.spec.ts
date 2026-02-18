import { describe, expect, it } from "vitest";
import { runBoundaryCheck } from "../../scripts/check-boundaries";

describe("architecture boundary script", () => {
  it("passes for baseline source tree", () => {
    const result = runBoundaryCheck();
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
