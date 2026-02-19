import { describe, expect } from "vitest";
import {
  resolveTranscriptAccentColor,
  resolveTranscriptAvatarInitials,
  resolveTranscriptMessageAlignment,
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
});
