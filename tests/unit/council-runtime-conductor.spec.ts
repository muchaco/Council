import { describe, expect } from "vitest";
import {
  buildAutopilotOpeningPrompt,
  buildConductorDecisionPrompt,
  parseAutopilotOpeningDecision,
  parseConductorDecision,
} from "../../src/shared/council-runtime-conductor";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = ["R3.13", "R3.14", "R3.18", "R3.20", "E1", "E2", "F1"] as const;

describe("council runtime conductor helpers", () => {
  itReq(FILE_REQUIREMENT_IDS, "builds a prompt with strict JSON contract", () => {
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
      omittedMessageCount: 3,
      eligibleMemberAgentIds: ["member-a", "member-b"],
    });

    expect(prompt).toContain("strict JSON");
    expect(prompt).toContain("nextSpeakerAgentId");
    expect(prompt).toContain("member-a,member-b");
    expect(prompt).toContain("Earlier messages omitted: 3");
  });

  itReq(FILE_REQUIREMENT_IDS, "parses valid manual-mode conductor decision", () => {
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

  itReq(FILE_REQUIREMENT_IDS, "rejects invalid autopilot speaker selection", () => {
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

  itReq(FILE_REQUIREMENT_IDS, "builds and parses autopilot opening contract", () => {
    const prompt = buildAutopilotOpeningPrompt({
      topic: "Kickoff",
      goal: "Align on next steps",
      memberAgentIds: ["member-a", "member-b"],
    });

    expect(prompt).toContain("openingMessage");
    expect(prompt).toContain("firstSpeakerAgentId");

    const parsed = parseAutopilotOpeningDecision({
      text: JSON.stringify({
        openingMessage: "Let us begin.",
        briefing: "Initial summary",
        goalReached: false,
        firstSpeakerAgentId: "member-a",
      }),
      memberAgentIds: ["member-a", "member-b"],
    });

    expect(parsed.isOk()).toBe(true);
    if (parsed.isOk()) {
      expect(parsed.value.firstSpeakerAgentId).toBe("member-a");
      expect(parsed.value.openingMessage).toBe("Let us begin.");
    }
  });

  itReq(FILE_REQUIREMENT_IDS, "builds manual-mode prompt fallback sections", () => {
    const prompt = buildConductorDecisionPrompt({
      mode: "manual",
      topic: "Kickoff",
      goal: null,
      previousBriefing: null,
      messages: [],
      omittedMessageCount: 0,
      eligibleMemberAgentIds: [],
    });

    expect(prompt).toContain("Goal: (none)");
    expect(prompt).toContain("Previous briefing: (none)");
    expect(prompt).toContain("Conversation:\n(none)");
    expect(prompt).toContain("Eligible members for next speaker: (manual mode - must return null)");
  });

  itReq(FILE_REQUIREMENT_IDS, "rejects malformed manual and autopilot decision payloads", () => {
    expect(
      parseConductorDecision({
        text: "not-json",
        mode: "manual",
        eligibleMemberAgentIds: [],
      }).isErr(),
    ).toBe(true);

    expect(
      parseConductorDecision({
        text: JSON.stringify([]),
        mode: "manual",
        eligibleMemberAgentIds: [],
      }).isErr(),
    ).toBe(true);

    expect(
      parseConductorDecision({
        text: JSON.stringify({
          briefing: "",
          goalReached: false,
          nextSpeakerAgentId: null,
        }),
        mode: "manual",
        eligibleMemberAgentIds: [],
      }).isErr(),
    ).toBe(true);

    expect(
      parseConductorDecision({
        text: JSON.stringify({
          briefing: "ok",
          goalReached: "false",
          nextSpeakerAgentId: null,
        }),
        mode: "manual",
        eligibleMemberAgentIds: [],
      }).isErr(),
    ).toBe(true);

    expect(
      parseConductorDecision({
        text: JSON.stringify({
          briefing: "ok",
          goalReached: false,
          nextSpeakerAgentId: "member-a",
        }),
        mode: "manual",
        eligibleMemberAgentIds: [],
      }).isErr(),
    ).toBe(true);

    expect(
      parseConductorDecision({
        text: JSON.stringify({
          briefing: "ok",
          goalReached: false,
          nextSpeakerAgentId: "",
        }),
        mode: "autopilot",
        eligibleMemberAgentIds: ["member-a"],
      }).isErr(),
    ).toBe(true);
  });

  itReq(FILE_REQUIREMENT_IDS, "rejects malformed autopilot opening payloads", () => {
    expect(
      parseAutopilotOpeningDecision({
        text: "not-json",
        memberAgentIds: ["member-a"],
      }).isErr(),
    ).toBe(true);

    expect(
      parseAutopilotOpeningDecision({
        text: JSON.stringify([]),
        memberAgentIds: ["member-a"],
      }).isErr(),
    ).toBe(true);

    expect(
      parseAutopilotOpeningDecision({
        text: JSON.stringify({
          openingMessage: "",
          briefing: "briefing",
          goalReached: false,
          firstSpeakerAgentId: "member-a",
        }),
        memberAgentIds: ["member-a"],
      }).isErr(),
    ).toBe(true);

    expect(
      parseAutopilotOpeningDecision({
        text: JSON.stringify({
          openingMessage: "Opening",
          briefing: "",
          goalReached: false,
          firstSpeakerAgentId: "member-a",
        }),
        memberAgentIds: ["member-a"],
      }).isErr(),
    ).toBe(true);

    expect(
      parseAutopilotOpeningDecision({
        text: JSON.stringify({
          openingMessage: "Opening",
          briefing: "Briefing",
          goalReached: "false",
          firstSpeakerAgentId: "member-a",
        }),
        memberAgentIds: ["member-a"],
      }).isErr(),
    ).toBe(true);

    expect(
      parseAutopilotOpeningDecision({
        text: JSON.stringify({
          openingMessage: "Opening",
          briefing: "Briefing",
          goalReached: false,
          firstSpeakerAgentId: "unknown",
        }),
        memberAgentIds: ["member-a"],
      }).isErr(),
    ).toBe(true);
  });
});
