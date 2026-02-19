import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTEXT_LAST_N,
  MAX_CONTEXT_LAST_N,
  MIN_CONTEXT_LAST_N,
  normalizeContextLastN,
  selectLastNContextMessages,
} from "../../src/shared/council-runtime-context-window";

describe("council runtime context window", () => {
  it("normalizes out-of-range values", () => {
    expect(normalizeContextLastN(Number.NaN)).toBe(DEFAULT_CONTEXT_LAST_N);
    expect(normalizeContextLastN(0)).toBe(MIN_CONTEXT_LAST_N);
    expect(normalizeContextLastN(9999)).toBe(MAX_CONTEXT_LAST_N);
    expect(normalizeContextLastN(6.8)).toBe(6);
  });

  it("selects only the last N messages with omitted count", () => {
    const selected = selectLastNContextMessages(["m1", "m2", "m3", "m4"], 2);
    expect(selected.messages).toEqual(["m3", "m4"]);
    expect(selected.omittedCount).toBe(2);
  });
});
