import { describe, expect } from "vitest";
import {
  isListRowOpenKey,
  resolveHomeTabFocusIndex,
} from "../../src/shared/home-keyboard-accessibility.js";
import { itReq } from "../helpers/requirement-trace";

describe("home keyboard accessibility helpers", () => {
  itReq(["U15.2"], "cycles tab focus index with ArrowRight and ArrowLeft", () => {
    expect(resolveHomeTabFocusIndex({ currentIndex: 0, key: "ArrowRight", totalTabs: 3 })).toBe(1);
    expect(resolveHomeTabFocusIndex({ currentIndex: 2, key: "ArrowRight", totalTabs: 3 })).toBe(0);
    expect(resolveHomeTabFocusIndex({ currentIndex: 0, key: "ArrowLeft", totalTabs: 3 })).toBe(2);
    expect(resolveHomeTabFocusIndex({ currentIndex: 1, key: "ArrowLeft", totalTabs: 3 })).toBe(0);
  });

  itReq(["U15.2"], "supports Home and End for tab keyboard navigation", () => {
    expect(resolveHomeTabFocusIndex({ currentIndex: 1, key: "Home", totalTabs: 3 })).toBe(0);
    expect(resolveHomeTabFocusIndex({ currentIndex: 1, key: "End", totalTabs: 3 })).toBe(2);
  });

  itReq(["U15.2"], "returns null for unsupported tab navigation keys", () => {
    expect(resolveHomeTabFocusIndex({ currentIndex: 1, key: "Enter", totalTabs: 3 })).toBeNull();
  });

  itReq(["U15.2"], "returns null when current tab index is out of bounds", () => {
    expect(
      resolveHomeTabFocusIndex({ currentIndex: -1, key: "ArrowRight", totalTabs: 3 }),
    ).toBeNull();
    expect(
      resolveHomeTabFocusIndex({ currentIndex: 3, key: "ArrowLeft", totalTabs: 3 }),
    ).toBeNull();
  });

  itReq(["U15.2"], "recognizes Enter and Space list-row open keys", () => {
    expect(isListRowOpenKey("Enter")).toBe(true);
    expect(isListRowOpenKey(" ")).toBe(true);
    expect(isListRowOpenKey("Spacebar")).toBe(true);
    expect(isListRowOpenKey("ArrowDown")).toBe(false);
  });
});
