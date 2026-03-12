import { describe, expect } from "vitest";

import { tryBuildAssistantPlannerShortcut } from "../../src/shared/assistant/assistant-planner-shortcuts";
import { itReq } from "../helpers/requirement-trace";

const agentEditContext = {
  activeEntityId: "00000000-0000-4000-8000-000000000101",
  contextLabel: "Agent editor / Planner",
  draftState: {
    changedFields: [],
    dirty: false,
    entityId: "00000000-0000-4000-8000-000000000101",
    entityKind: "agent" as const,
    summary: "Agent draft matches the saved state.",
  },
  listState: null,
  runtimeState: null,
  selectionIds: [],
  viewKind: "agentEdit" as const,
};

describe("assistant planner shortcuts", () => {
  itReq(
    ["R9.1", "R9.11", "R9.14", "R9.17", "U18.7", "A1", "D5"],
    "builds a deterministic current agent draft shortcut plan",
    () => {
      const shortcut = tryBuildAssistantPlannerShortcut({
        context: agentEditContext,
        sessionId: "session-1",
        userRequest:
          "Rename this draft to Scenario Draft Agent Updated and set tags to ops, ready without saving.",
      });

      expect(shortcut).toEqual({
        summary: "Rename the current draft to Scenario Draft Agent Updated and update its tags.",
        plannedCalls: [
          {
            callId: "set-agent-draft-fields-session-1",
            toolName: "setAgentDraftFields",
            rationale: "Apply the requested rename and tags to the current visible agent draft.",
            input: {
              name: "Scenario Draft Agent Updated",
              tags: ["ops", "ready"],
            },
          },
        ],
      });
    },
  );

  itReq(
    ["R9.1", "R9.11", "R9.14", "R9.17", "U18.7", "A1", "D5"],
    "ignores unsupported shortcut requests",
    () => {
      expect(
        tryBuildAssistantPlannerShortcut({
          context: agentEditContext,
          sessionId: "session-1",
          userRequest: "Summarize this draft",
        }),
      ).toBeNull();
    },
  );
});
