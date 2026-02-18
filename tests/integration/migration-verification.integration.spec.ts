import { describe, expect, it } from "vitest";
import { verifyMigrations } from "../../scripts/verify-migrations";

describe("migration verification", () => {
  it("passes with bootstrap migration set", () => {
    const result = verifyMigrations();
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
