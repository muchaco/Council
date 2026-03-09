import { describe, expect } from "vitest";
import {
  parseAutopilotOpeningDecision,
  parseConductorDecision,
} from "../../src/shared/council-runtime-conductor";
import {
  buildAutopilotOpeningPromptBundle,
  buildConductorDecisionPromptBundle,
} from "../../src/shared/council-runtime-prompts";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = [
  "R3.13",
  "R3.14",
  "R3.16",
  "R3.17",
  "R3.18",
  "R3.20",
  "E1",
  "E2",
  "F1",
] as const;

describe("council runtime conductor helpers", () => {
  itReq(FILE_REQUIREMENT_IDS, "builds a split prompt bundle with strict JSON contract", () => {
    const prompt = buildConductorDecisionPromptBundle({
      mode: "autopilot",
      topic: "Reduce cycle time",
      goal: "Agree 3 actions",
      previousBriefing: "Previous state",
      recentMessages: [
        {
          senderName: "Planner",
          senderKind: "member",
          content: "We should shorten review queues.",
        },
      ],
      omittedMessageCount: 3,
      eligibleMembers: [
        { id: "member-a", name: "Planner", role: "Operations lead" },
        { id: "member-b", name: "Researcher", role: "User research lead" },
      ],
    });

    expect(prompt.messages[0]?.role).toBe("system");
    expect(prompt.messages[1]?.role).toBe("user");
    expect(prompt.messages[0]?.content).toContain("Return valid JSON only.");
    expect(prompt.messages[0]?.content).toContain("nextSpeakerAgentId");
    expect(prompt.messages[1]?.content).toContain("Earlier messages omitted: 3");
    expect(prompt.messages[1]?.content).toContain(
      "- id: member-a; name: Planner; role: Operations lead",
    );
    expect(prompt.messages[1]?.content).toContain(
      "- id: member-b; name: Researcher; role: User research lead",
    );
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
    const prompt = buildAutopilotOpeningPromptBundle({
      topic: "Kickoff",
      goal: "Align on next steps",
      members: [
        { id: "member-a", name: "Planner", role: "Operations lead" },
        { id: "member-b", name: "Researcher", role: "User research lead" },
      ],
    });

    expect(prompt.messages[0]?.content).toContain("openingMessage");
    expect(prompt.messages[0]?.content).toContain("firstSpeakerAgentId");
    expect(prompt.messages[1]?.content).toContain(
      "- id: member-a; name: Planner; role: Operations lead",
    );

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
    const prompt = buildConductorDecisionPromptBundle({
      mode: "manual",
      topic: "Kickoff",
      goal: null,
      previousBriefing: null,
      recentMessages: [],
      omittedMessageCount: 0,
      eligibleMembers: [],
    });

    expect(prompt.messages[1]?.content).toContain("Goal: (none)");
    expect(prompt.messages[1]?.content).toContain("Previous briefing: (none)");
    expect(prompt.messages[1]?.content).toContain("Recent conversation:\n(none)");
    expect(prompt.messages[1]?.content).toContain(
      "Eligible members for next speaker:\n(manual mode - nextSpeakerAgentId must be null)",
    );
  });

  itReq(FILE_REQUIREMENT_IDS, "unwraps a fully fenced JSON response before parsing", () => {
    const parsed = parseConductorDecision({
      text: '```json\n{"briefing":"ok","goalReached":false,"nextSpeakerAgentId":null}\n```',
      mode: "manual",
      eligibleMemberAgentIds: [],
    });

    expect(parsed.isOk()).toBe(true);
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
