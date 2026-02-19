import { describe, expect } from "vitest";
import {
  resolveThinkingPlaceholderSpeakerId,
  resolveTranscriptAccentColor,
  resolveTranscriptAvatarInitials,
  resolveTranscriptMessageAlignment,
  shouldRenderInlineThinkingCancel,
} from "../../src/shared/council-view-transcript.js";
import { itReq } from "../helpers/requirement-trace";

describe("council view transcript helpers", () => {
  itReq(["U8.4", "U13.3"], "renders member and conductor messages on opposite sides", () => {
    expect(resolveTranscriptMessageAlignment({ senderKind: "member" })).toBe("left");
    expect(resolveTranscriptMessageAlignment({ senderKind: "conductor" })).toBe("right");
  });

  itReq(["U8.4"], "uses sender color accents with stable fallbacks", () => {
    expect(
      resolveTranscriptAccentColor({
        senderKind: "member",
        senderColor: "#be123c",
      }),
    ).toBe("#be123c");

    expect(
      resolveTranscriptAccentColor({
        senderKind: "conductor",
        senderColor: "not-a-color",
      }),
    ).toBe("#1d4ed8");
  });

  itReq(["U8.4"], "builds avatar initials from sender names", () => {
    expect(resolveTranscriptAvatarInitials("Alex Johnson")).toBe("AJ");
    expect(resolveTranscriptAvatarInitials("Nora")).toBe("NO");
    expect(resolveTranscriptAvatarInitials("   ")).toBe("??");
  });

  itReq(
    ["U8.6", "U8.8"],
    "resolves thinking speaker for running or pending member generation",
    () => {
      expect(
        resolveThinkingPlaceholderSpeakerId({
          generation: {
            status: "running",
            activeMemberAgentId: "member-1",
          },
          pendingManualMemberAgentId: null,
        }),
      ).toBe("member-1");

      expect(
        resolveThinkingPlaceholderSpeakerId({
          generation: {
            status: "idle",
            activeMemberAgentId: null,
          },
          pendingManualMemberAgentId: "member-2",
        }),
      ).toBe("member-2");

      expect(
        resolveThinkingPlaceholderSpeakerId({
          generation: {
            status: "idle",
            activeMemberAgentId: null,
          },
          pendingManualMemberAgentId: null,
        }),
      ).toBeNull();
    },
  );

  itReq(["U8.7"], "shows inline cancel only when a thinking placeholder is visible", () => {
    expect(
      shouldRenderInlineThinkingCancel({
        generationActive: true,
        thinkingSpeakerId: "member-1",
      }),
    ).toBe(true);
    expect(
      shouldRenderInlineThinkingCancel({
        generationActive: true,
        thinkingSpeakerId: null,
      }),
    ).toBe(false);
    expect(
      shouldRenderInlineThinkingCancel({
        generationActive: false,
        thinkingSpeakerId: "member-1",
      }),
    ).toBe(false);
  });
});
