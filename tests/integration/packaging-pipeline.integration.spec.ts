import { describe, expect } from "vitest";

import { verifyPackagingPipeline } from "../../scripts/verify-packaging-pipeline";
import { itReq } from "../helpers/requirement-trace";

describe("packaging pipeline", () => {
  itReq(
    ["G1", "G3", "H2", "H3", "IMPL-001"],
    "enforces Linux AppImage packaging and native rebuild automation",
    () => {
      const result = verifyPackagingPipeline();
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    },
  );
});
