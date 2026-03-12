import { describe, expect } from "vitest";
import {
  buildAssistantPlannerPrompt,
  parseAssistantPlannerResponse,
} from "../../src/shared/assistant/assistant-plan-schema";
import { ASSISTANT_TOOL_DEFINITIONS } from "../../src/shared/assistant/assistant-tool-definitions";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = ["R9.3", "R9.4", "R9.7", "R9.8", "R9.17"] as const;
const TOOL_CONTRACT_REQUIREMENT_IDS = ["R9.9", "R9.11", "R9.13", "R9.14", "R9.22", "A1"] as const;

describe("assistant plan schema", () => {
  itReq(
    FILE_REQUIREMENT_IDS,
    "builds a planner prompt from sanitized context and tool catalog",
    () => {
      const prompt = buildAssistantPlannerPrompt({
        userRequest: "Open the agents tab",
        context: {
          viewKind: "agentsList",
          contextLabel: "Agents",
          activeEntityId: null,
          selectionIds: [],
          listState: {
            searchText: "planner",
            tagFilter: "ops",
            sortBy: "updatedAt",
            sortDirection: "desc",
            archivedFilter: "all",
          },
          draftState: null,
          runtimeState: null,
        },
        tools: ASSISTANT_TOOL_DEFINITIONS,
      });

      expect(prompt).toContain("Open the agents tab");
      expect(prompt).toContain("navigateToHomeTab");
      expect(prompt).toContain('"viewKind": "agentsList"');
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "parses structured confirm responses", () => {
    const parsed = parseAssistantPlannerResponse(`
      {
        "kind": "confirm",
        "summary": "Archive the filtered agents.",
        "confirmation": {
          "summary": "Archive 2 filtered agents",
          "scopeDescription": "The active filtered agents list",
          "affectedCount": 2,
          "examples": ["Planner", "Researcher"],
          "reversible": true,
          "draftImpact": "none"
        },
        "plannedCalls": [
          {
            "callId": "call-1",
            "toolName": "listAgents",
            "rationale": "Review the filtered set first.",
            "input": {
              "searchText": "plan"
            }
          }
        ]
      }
    `);

    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("confirm");
    if (parsed?.kind !== "confirm") {
      return;
    }

    expect(parsed.confirmation.affectedCount).toBe(2);
    expect(parsed.plannedCalls).toHaveLength(1);
  });

  itReq(
    TOOL_CONTRACT_REQUIREMENT_IDS,
    "sanitizes valid planned call payloads before returning them",
    () => {
      const parsed = parseAssistantPlannerResponse(`
      {
        "kind": "execute",
        "summary": "List anything under /tmp/private.txt",
        "plannedCalls": [
          {
            "callId": "call-1",
            "toolName": "listAgents",
            "rationale": "Inspect ../secrets.txt before acting.",
            "input": {
              "searchText": "../secrets.txt"
            }
          }
        ]
      }
    `);

      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe("execute");
      if (parsed?.kind !== "execute") {
        return;
      }

      expect(parsed.summary).toBe("List anything under [redacted]");
      expect(parsed.plannedCalls).toEqual([
        {
          callId: "call-1",
          toolName: "listAgents",
          rationale: "Inspect [redacted] before acting.",
          input: {
            searchText: "[redacted]",
          },
        },
      ]);
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "fails closed on invalid planner output", () => {
    expect(parseAssistantPlannerResponse("not-json")).toBeNull();
    expect(
      parseAssistantPlannerResponse('{"kind":"execute","summary":"x","plannedCalls":"bad"}'),
    ).toBeNull();
    expect(
      parseAssistantPlannerResponse(`
        {
          "kind": "execute",
          "summary": "x",
          "plannedCalls": [
            {
              "callId": "call-1",
              "toolName": "deleteEverything",
              "rationale": "nope",
              "input": {}
            }
          ]
        }
      `),
    ).toBeNull();
  });
});
