import { describe, expect, it } from "vitest";
import {
  buildConductorDecisionPrompt,
  parseConductorDecision,
} from "../../src/shared/council-runtime-conductor";

describe("council runtime conductor helpers", () => {
  it("builds a prompt with strict JSON contract", () => {
    const prompt = buildConductorDecisionPrompt({
      mode: "autopilot",
      topic: "Reduce cycle time",
      goal: "Agree 3 actions",
      previousBriefing: "Previous state",
      messages: [
        {
          senderName: "Planner",
          senderKind: "member",
          content: "We should shorten review queues.",
        },
      ],
      eligibleMemberAgentIds: ["member-a", "member-b"],
    });

    expect(prompt).toContain("strict JSON");
    expect(prompt).toContain("nextSpeakerAgentId");
    expect(prompt).toContain("member-a,member-b");
  });

  it("parses valid manual-mode conductor decision", () => {
    const parsed = parseConductorDecision({
      text: JSON.stringify({
        briefing: "Manual update",
        goalReached: false,
        nextSpeakerAgentId: null,
      }),
      mode: "manual",
      eligibleMemberAgentIds: [],
    });

    expect(parsed.isOk()).toBe(true);
    if (parsed.isOk()) {
      expect(parsed.value.nextSpeakerAgentId).toBeNull();
      expect(parsed.value.briefing).toBe("Manual update");
    }
  });

  it("rejects invalid autopilot speaker selection", () => {
    const parsed = parseConductorDecision({
      text: JSON.stringify({
        briefing: "Autopilot update",
        goalReached: false,
        nextSpeakerAgentId: "unknown-member",
      }),
      mode: "autopilot",
      eligibleMemberAgentIds: ["member-a"],
    });

    expect(parsed.isErr()).toBe(true);
  });
});
