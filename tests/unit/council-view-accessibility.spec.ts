import { describe, expect } from "vitest";
import {
  buildTranscriptMessageAriaLabel,
  resolveInlineConfigEditKeyboardAction,
  resolveTranscriptFocusIndex,
} from "../../src/shared/council-view-accessibility.js";
import { itReq } from "../helpers/requirement-trace";

describe("council view accessibility helpers", () => {
  itReq(["U15.2"], "moves focus down and up within transcript bounds", () => {
    expect(resolveTranscriptFocusIndex({ currentIndex: 0, key: "ArrowDown", totalItems: 2 })).toBe(
      1,
    );
    expect(resolveTranscriptFocusIndex({ currentIndex: 1, key: "ArrowDown", totalItems: 2 })).toBe(
      1,
    );
    expect(resolveTranscriptFocusIndex({ currentIndex: 1, key: "ArrowUp", totalItems: 2 })).toBe(0);
    expect(resolveTranscriptFocusIndex({ currentIndex: 0, key: "ArrowUp", totalItems: 2 })).toBe(0);
  });

  itReq(["U15.2"], "supports Home and End keyboard navigation", () => {
    expect(resolveTranscriptFocusIndex({ currentIndex: 1, key: "Home", totalItems: 3 })).toBe(0);
    expect(resolveTranscriptFocusIndex({ currentIndex: 1, key: "End", totalItems: 3 })).toBe(2);
  });

  itReq(["U15.2"], "returns null for unsupported keys", () => {
    expect(
      resolveTranscriptFocusIndex({ currentIndex: 0, key: "Enter", totalItems: 2 }),
    ).toBeNull();
  });

  itReq(["U10.7", "U15.2"], "maps inline config edit keyboard shortcuts", () => {
    expect(resolveInlineConfigEditKeyboardAction({ key: "Enter", shiftKey: false })).toBe("save");
    expect(resolveInlineConfigEditKeyboardAction({ key: "Enter", shiftKey: true })).toBe("none");
    expect(resolveInlineConfigEditKeyboardAction({ key: "Escape", shiftKey: false })).toBe(
      "cancel",
    );
  });

  itReq(
    ["U15.3", "U15.4"],
    "builds descriptive aria labels with identity and message details",
    () => {
      const label = buildTranscriptMessageAriaLabel({
        id: "msg-1",
        councilId: "council-1",
        sequenceNumber: 3,
        senderKind: "member",
        senderAgentId: "agent-1",
        senderName: "Alex",
        senderColor: "#aabbcc",
        content: "I propose we split the task.",
        createdAtUtc: "2026-02-19T12:00:00.000Z",
      });

      expect(label).toContain("Alex");
      expect(label).toContain("Member");
      expect(label).toContain("message 3");
      expect(label).toContain("I propose we split the task.");
    },
  );
});
