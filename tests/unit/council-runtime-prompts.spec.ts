import { describe, expect } from "vitest";
import {
  buildAutopilotOpeningPromptBundle,
  buildConductorDecisionPromptBundle,
  buildMemberTurnPromptBundle,
  deriveAgentRoleLabel,
} from "../../src/shared/council-runtime-prompts";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = [
  "R1.3",
  "R1.6",
  "R1.7",
  "R3.13",
  "R3.16",
  "R3.17",
  "R3.18",
  "F1",
  "E1",
  "E2",
  "E4",
] as const;

describe("council runtime prompts", () => {
  itReq(
    FILE_REQUIREMENT_IDS,
    "builds member system message from agent prompt and verbosity",
    () => {
      const prompt = buildMemberTurnPromptBundle({
        councilTitle: "Launch Council",
        topic: "Prepare launch messaging",
        goal: "Agree on a positioning angle",
        memberName: "Planner",
        memberRole: "You are a planning lead.",
        memberSystemPrompt: "You are a planning lead who keeps discussion grounded.",
        memberVerbosity: "Concise but specific",
        otherMembers: [],
        briefing: null,
        recentMessages: [],
        omittedMessageCount: 0,
      });

      expect(prompt.messages).toHaveLength(2);
      expect(prompt.messages[0]).toEqual(
        expect.objectContaining({
          role: "system",
        }),
      );
      expect(prompt.messages[0]?.content).toContain(
        "You are a planning lead who keeps discussion grounded.",
      );
      expect(prompt.messages[0]?.content).toContain("Verbosity requirement: Concise but specific.");
      expect(prompt.messages[0]?.content).toContain(
        "You are participating as a Member of a Council discussion.",
      );
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "omits verbosity instruction when verbosity is blank", () => {
    const prompt = buildMemberTurnPromptBundle({
      councilTitle: "Launch Council",
      topic: "Prepare launch messaging",
      goal: null,
      memberName: "Planner",
      memberRole: null,
      memberSystemPrompt: "You are a planning lead.",
      memberVerbosity: "   ",
      otherMembers: [],
      briefing: null,
      recentMessages: [],
      omittedMessageCount: 0,
    });

    expect(prompt.messages[0]?.content).not.toContain("Verbosity requirement:");
  });

  itReq(
    FILE_REQUIREMENT_IDS,
    "includes fellow member names and roles in member dynamic prompt",
    () => {
      const prompt = buildMemberTurnPromptBundle({
        councilTitle: "Launch Council",
        topic: "Prepare launch messaging",
        goal: "Agree on a positioning angle",
        memberName: "Planner",
        memberRole: "You are a planning lead.",
        memberSystemPrompt: "You are a planning lead.",
        memberVerbosity: null,
        otherMembers: [
          {
            id: "agent-2",
            name: "Researcher",
            role: "You are a research specialist.",
          },
        ],
        briefing: "The group is comparing launch themes.",
        recentMessages: [
          {
            senderName: "Researcher",
            senderKind: "member",
            content: "Customer interviews keep pointing to setup speed.",
          },
        ],
        omittedMessageCount: 2,
      });

      expect(prompt.messages[1]?.content).toContain(
        "Current member role: You are a planning lead.",
      );
      expect(prompt.messages[1]?.content).toContain(
        "- id: agent-2; name: Researcher; role: You are a research specialist.",
      );
      expect(prompt.messages[1]?.content).toContain("Earlier messages omitted: 2");
      expect(prompt.messages[1]?.content).toContain(
        "1. [member] Researcher: Customer interviews keep pointing to setup speed.",
      );
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "builds conductor prompt bundle with stable system instructions and eligible member metadata",
    () => {
      const prompt = buildConductorDecisionPromptBundle({
        mode: "autopilot",
        topic: "Prepare launch messaging",
        goal: "Agree on a positioning angle",
        previousBriefing: "The group is comparing launch themes.",
        recentMessages: [
          {
            senderName: "Planner",
            senderKind: "member",
            content: "We should anchor on faster setup.",
          },
        ],
        omittedMessageCount: 3,
        eligibleMembers: [
          {
            id: "agent-1",
            name: "Planner",
            role: "You are a planning lead.",
          },
          {
            id: "agent-2",
            name: "Researcher",
            role: "You are a research specialist.",
          },
        ],
      });

      expect(prompt.messages[0]?.content).toContain("Return valid JSON only.");
      expect(prompt.messages[0]?.content).toContain("Stay neutral and do not argue as a Member.");
      expect(prompt.messages[1]?.content).toContain("Mode: autopilot");
      expect(prompt.messages[1]?.content).toContain(
        "Previous briefing: The group is comparing launch themes.",
      );
      expect(prompt.messages[1]?.content).toContain(
        "- id: agent-1; name: Planner; role: You are a planning lead.",
      );
      expect(prompt.messages[1]?.content).toContain(
        "- id: agent-2; name: Researcher; role: You are a research specialist.",
      );
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "builds autopilot opening prompt with member metadata", () => {
    const prompt = buildAutopilotOpeningPromptBundle({
      topic: "Prepare launch messaging",
      goal: null,
      members: [
        {
          id: "agent-1",
          name: "Planner",
          role: "You are a planning lead.",
        },
      ],
    });

    expect(prompt.messages[0]?.content).toContain("You are starting an Autopilot Council.");
    expect(prompt.messages[0]?.content).toContain("firstSpeakerAgentId");
    expect(prompt.messages[1]?.content).toContain(
      "- id: agent-1; name: Planner; role: You are a planning lead.",
    );
  });

  itReq(
    FILE_REQUIREMENT_IDS,
    "keeps prompt wording free of legacy persona and blackboard terms",
    () => {
      const memberPrompt = buildMemberTurnPromptBundle({
        councilTitle: "Launch Council",
        topic: "Prepare launch messaging",
        goal: null,
        memberName: "Planner",
        memberRole: null,
        memberSystemPrompt: "You are a planning lead.",
        memberVerbosity: null,
        otherMembers: [],
        briefing: null,
        recentMessages: [],
        omittedMessageCount: 0,
      });
      const conductorPrompt = buildConductorDecisionPromptBundle({
        mode: "manual",
        topic: "Prepare launch messaging",
        goal: null,
        previousBriefing: null,
        recentMessages: [],
        omittedMessageCount: 0,
        eligibleMembers: [],
      });

      const combined = [...memberPrompt.messages, ...conductorPrompt.messages]
        .map((message) => message.content)
        .join("\n");

      expect(combined).not.toMatch(/persona/i);
      expect(combined).not.toMatch(/blackboard/i);
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "derives a concise role label from the agent system prompt", () => {
    expect(
      deriveAgentRoleLabel(
        "You are a skeptical operations strategist. Challenge vague plans and push for measurable follow-through.\n\nKeep tradeoffs visible.",
      ),
    ).toBe("You are a skeptical operations strategist.");
  });
});
