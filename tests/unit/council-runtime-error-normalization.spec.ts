import { describe, expect } from "vitest";
import {
  normalizeCouncilRuntimeError,
  readCouncilRuntimeErrorDetails,
  toCouncilRuntimeErrorDetails,
} from "../../src/shared/council-runtime-error-normalization.js";
import { itReq } from "../helpers/requirement-trace";

describe("council runtime error normalization", () => {
  itReq(
    ["R8.3", "U12.6", "U13.4"],
    "classifies provider quota errors into concise runtime copy",
    () => {
      const normalized = normalizeCouncilRuntimeError({
        message: "HTTP 429 insufficient_quota: billing hard limit reached",
        providerId: "openrouter",
        modelId: "openai/gpt-4.1-mini",
      });

      expect(normalized.category).toBe("quotaExceeded");
      expect(normalized.message).toContain("quota");
      expect(normalized.message.includes("HTTP 429")).toBe(false);
      expect(normalized.technicalDetails).toContain("Provider: openrouter");
      expect(normalized.technicalDetails).toContain("Model: openai/gpt-4.1-mini");
      expect(normalized.technicalDetails).toContain("Quota or billing limit reached");
    },
  );

  itReq(["A3", "C1", "D5"], "serializes and reads sanitized runtime error details", () => {
    const normalized = normalizeCouncilRuntimeError({
      message: "API key not found",
      providerId: "gemini",
      modelId: "gemini-1.5-flash",
    });

    const details = toCouncilRuntimeErrorDetails(normalized);
    expect(readCouncilRuntimeErrorDetails(details)).toEqual(normalized);
  });
});
