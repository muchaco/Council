import { describe, expect, it } from "vitest";
import { verifyRequiredScripts } from "../../scripts/verify-required-scripts";

describe("required scripts", () => {
  it("contains mandatory quality gates", () => {
    const result = verifyRequiredScripts();
    expect(result.ok).toBe(true);
    expect(result.missing).toHaveLength(0);
  });
});
