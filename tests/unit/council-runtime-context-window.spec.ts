import { describe, expect } from "vitest";
import {
  DEFAULT_CONTEXT_LAST_N,
  MAX_CONTEXT_LAST_N,
  MIN_CONTEXT_LAST_N,
  normalizeContextLastN,
  selectLastNContextMessages,
} from "../../src/shared/council-runtime-context-window";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = ["F1", "E1", "R3.29", "R3.30", "R3.31"] as const;

describe("council runtime context window", () => {
  itReq(FILE_REQUIREMENT_IDS, "normalizes out-of-range values", () => {
    expect(normalizeContextLastN(Number.NaN)).toBe(DEFAULT_CONTEXT_LAST_N);
    expect(normalizeContextLastN(0)).toBe(MIN_CONTEXT_LAST_N);
    expect(normalizeContextLastN(9999)).toBe(MAX_CONTEXT_LAST_N);
    expect(normalizeContextLastN(6.8)).toBe(6);
  });

  itReq(FILE_REQUIREMENT_IDS, "keeps default N within explicit settings bounds", () => {
    expect(DEFAULT_CONTEXT_LAST_N).toBeGreaterThanOrEqual(MIN_CONTEXT_LAST_N);
    expect(DEFAULT_CONTEXT_LAST_N).toBeLessThanOrEqual(MAX_CONTEXT_LAST_N);
    expect(DEFAULT_CONTEXT_LAST_N).toBe(12);
  });

  itReq(FILE_REQUIREMENT_IDS, "selects only the last N messages with omitted count", () => {
    const selected = selectLastNContextMessages(["m1", "m2", "m3", "m4"], 2);
    expect(selected.messages).toEqual(["m3", "m4"]);
    expect(selected.omittedCount).toBe(2);
  });

  itReq(FILE_REQUIREMENT_IDS, "returns full history when N covers all messages", () => {
    const selected = selectLastNContextMessages(["m1", "m2", "m3"], 12);
    expect(selected.messages).toEqual(["m1", "m2", "m3"]);
    expect(selected.omittedCount).toBe(0);
  });
});
