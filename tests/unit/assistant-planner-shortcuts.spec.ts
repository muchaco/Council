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

const councilsListContext = {
  activeEntityId: null,
  contextLabel: "Home / Councils",
  draftState: null,
  listState: {
    archivedFilter: "all" as const,
    page: 1,
    pageSize: 20,
    searchText: "",
    selectedIds: [],
    sortBy: "updatedAt" as const,
    sortDirection: "desc" as const,
    tagFilter: "",
    totalCount: 3,
    visibleCount: 3,
  },
  runtimeState: null,
  selectionIds: [],
  viewKind: "councilsList" as const,
};

const councilEditContext = {
  activeEntityId: "00000000-0000-4000-8000-000000000202",
  contextLabel: "Council editor / Quarterly Council",
  draftState: {
    changedFields: [],
    dirty: false,
    entityId: "00000000-0000-4000-8000-000000000202",
    entityKind: "council" as const,
    summary: "Council draft matches the saved state.",
  },
  listState: null,
  runtimeState: null,
  selectionIds: [],
  viewKind: "councilCreate" as const,
};

const councilViewContext = {
  activeEntityId: "00000000-0000-4000-8000-000000000303",
  contextLabel: "Council view / Quarterly Council",
  draftState: null,
  listState: null,
  runtimeState: null,
  selectionIds: [],
  viewKind: "councilView" as const,
};

const settingsContext = {
  activeEntityId: null,
  contextLabel: "Home / Settings",
  draftState: null,
  listState: null,
  runtimeState: null,
  selectionIds: [],
  viewKind: "settings" as const,
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
    ["R9.11", "R9.14", "R9.17", "R9.22", "U18.13", "A1", "D5"],
    "builds a deterministic create agent shortcut plan for commit flows",
    () => {
      const shortcut = tryBuildAssistantPlannerShortcut({
        context: councilsListContext,
        sessionId: "session-1",
        userRequest:
          "Create an agent named Scenario Commit Agent with system prompt Help with execution planning, concise verbosity, temperature 0.2, and tag ops.",
      });

      expect(shortcut).toEqual({
        summary: "Create agent Scenario Commit Agent.",
        plannedCalls: [
          {
            callId: "create-agent-session-1",
            toolName: "createAgent",
            rationale: "Create the requested agent with the provided saved fields.",
            input: {
              name: "Scenario Commit Agent",
              systemPrompt: "Help with execution planning",
              tags: ["ops"],
              temperature: 0.2,
              verbosity: "concise",
            },
          },
        ],
      });
    },
  );

  itReq(
    ["R9.11", "R9.17", "R9.18", "R9.22", "U18.13", "A1", "D5"],
    "builds a deterministic save current agent draft shortcut plan",
    () => {
      const shortcut = tryBuildAssistantPlannerShortcut({
        context: agentEditContext,
        sessionId: "session-1",
        userRequest: "Save this draft.",
      });

      expect(shortcut).toEqual({
        summary: "Save the current agent draft.",
        plannedCalls: [
          {
            callId: "save-agent-draft-session-1",
            toolName: "saveAgentDraft",
            rationale: "Save the current visible agent draft through the normal editor flow.",
            input: {
              entityId: "00000000-0000-4000-8000-000000000101",
            },
          },
        ],
      });
    },
  );

  itReq(
    ["R9.11", "R9.17", "R9.18", "R9.22", "U18.13", "A1", "D5"],
    "builds a deterministic rename and save current council draft shortcut plan",
    () => {
      const shortcut = tryBuildAssistantPlannerShortcut({
        context: councilEditContext,
        sessionId: "session-1",
        userRequest: "Rename this council draft to Scenario Commit Council and save it.",
      });

      expect(shortcut).toEqual({
        summary: "Rename the current council draft to Scenario Commit Council and save it.",
        plannedCalls: [
          {
            callId: "set-council-draft-fields-session-1",
            toolName: "setCouncilDraftFields",
            rationale: "Apply the requested council title change to the current visible draft.",
            input: {
              title: "Scenario Commit Council",
            },
          },
          {
            callId: "save-council-draft-session-1",
            toolName: "saveCouncilDraft",
            rationale: "Save the current visible council draft after applying the requested title.",
            input: {},
          },
        ],
      });
    },
  );

  itReq(
    ["R9.11", "R9.17", "R9.18", "R9.22", "U18.13", "A1", "D5"],
    "builds a deterministic current council rename shortcut plan",
    () => {
      const shortcut = tryBuildAssistantPlannerShortcut({
        context: councilViewContext,
        sessionId: "session-1",
        userRequest: "Rename this council to Scenario Commit Council.",
      });

      expect(shortcut).toEqual({
        summary: "Rename this council to Scenario Commit Council.",
        plannedCalls: [
          {
            callId: "update-council-config-session-1",
            toolName: "updateCouncilConfig",
            rationale: "Update the current council title through the normal saved config flow.",
            input: {
              councilId: "00000000-0000-4000-8000-000000000303",
              title: "Scenario Commit Council",
            },
          },
        ],
      });
    },
  );

  itReq(
    ["R9.11", "R9.17", "R9.18", "R9.21", "R9.22", "A1", "D5"],
    "builds deterministic council runtime control shortcuts",
    () => {
      expect(
        tryBuildAssistantPlannerShortcut({
          context: councilViewContext,
          sessionId: "session-1",
          userRequest: "Start this council runtime.",
        }),
      ).toEqual({
        summary: "Start this council runtime.",
        plannedCalls: [
          {
            callId: "start-council-runtime-session-1",
            toolName: "startCouncil",
            rationale: "Start the currently leased council runtime view.",
            input: {
              councilId: "00000000-0000-4000-8000-000000000303",
            },
          },
        ],
      });

      expect(
        tryBuildAssistantPlannerShortcut({
          context: councilViewContext,
          sessionId: "session-2",
          userRequest: "Send conductor message Keep the debate concise.",
        }),
      ).toEqual({
        summary: "Send a conductor message.",
        plannedCalls: [
          {
            callId: "send-conductor-message-session-2",
            toolName: "sendConductorMessage",
            rationale: "Inject the requested conductor note into the current council runtime.",
            input: {
              councilId: "00000000-0000-4000-8000-000000000303",
              content: "Keep the debate concise",
            },
          },
        ],
      });
    },
  );

  itReq(
    ["R9.11", "R9.12", "R9.17", "R9.18", "R9.22", "U18.9", "A1", "D5"],
    "builds deterministic phase 4 destructive and settings shortcuts",
    () => {
      expect(
        tryBuildAssistantPlannerShortcut({
          context: councilsListContext,
          sessionId: "session-1",
          userRequest: "Delete agent 00000000-0000-4000-8000-000000000101.",
        }),
      ).toEqual({
        summary: "Delete agent 00000000-0000-4000-8000-000000000101.",
        plannedCalls: [
          {
            callId: "delete-agent-session-1",
            toolName: "deleteAgent",
            rationale: "Delete the explicitly referenced agent.",
            input: {
              agentId: "00000000-0000-4000-8000-000000000101",
            },
          },
        ],
      });

      expect(
        tryBuildAssistantPlannerShortcut({
          context: settingsContext,
          sessionId: "session-2",
          userRequest: "Set the global default model to gemini:gemini-1.5-flash.",
        }),
      ).toEqual({
        summary: "Set global default model to gemini:gemini-1.5-flash.",
        plannedCalls: [
          {
            callId: "set-global-default-model-session-2",
            toolName: "setGlobalDefaultModel",
            rationale: "Set the requested global default model in settings.",
            input: {
              modelRefOrNull: {
                providerId: "gemini",
                modelId: "gemini-1.5-flash",
              },
            },
          },
        ],
      });

      expect(
        tryBuildAssistantPlannerShortcut({
          context: councilsListContext,
          sessionId: "session-3",
          userRequest: "Export council transcript for 00000000-0000-4000-8000-000000000201.",
        }),
      ).toEqual({
        summary: "Export council transcript for 00000000-0000-4000-8000-000000000201.",
        plannedCalls: [
          {
            callId: "export-council-session-3",
            toolName: "exportCouncil",
            rationale: "Export transcript for the explicitly referenced council.",
            input: {
              councilId: "00000000-0000-4000-8000-000000000201",
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
