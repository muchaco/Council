import { describe, expect } from "vitest";
import { verifyMigrations } from "../../scripts/verify-migrations";
import { itReq } from "../helpers/requirement-trace";

describe("migration verification", () => {
  itReq(["B3", "H3"], "passes with bootstrap migration set", () => {
    const result = verifyMigrations();
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
