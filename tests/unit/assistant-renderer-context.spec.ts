import { describe, expect } from "vitest";

import {
  buildAssistantAgentEditorContext,
  buildAssistantCouncilViewContext,
  buildAssistantHomeContext,
} from "../../src/renderer/components/assistant/assistant-context-builders";
import { itReq } from "../helpers/requirement-trace";

describe("assistant renderer context builders", () => {
  itReq(
    ["R9.4", "R9.19", "U18.12", "A3", "D5", "F2"],
    "builds sanitized home context from the active list query",
    () => {
      const context = buildAssistantHomeContext({
        activeTab: "agents",
        agents: {
          appliedFilters: {
            archivedFilter: "archived",
            searchText: "reviewer",
            sortBy: "updatedAt",
            sortDirection: "desc",
            tagFilter: "alpha",
          },
          hasPendingChanges: true,
          total: 4,
        },
        councils: {
          appliedFilters: {
            archivedFilter: "all",
            searchText: "",
            sortBy: "updatedAt",
            sortDirection: "desc",
            tagFilter: "",
          },
          hasPendingChanges: false,
          total: 2,
        },
      });

      expect(context.viewKind).toBe("agentsList");
      expect(context.contextLabel).toContain("Home / Agents");
      expect(context.contextLabel).toContain("query draft pending");
      expect(context.listState).toEqual({
        archivedFilter: "archived",
        searchText: "reviewer",
        sortBy: "updatedAt",
        sortDirection: "desc",
        tagFilter: "alpha",
      });
    },
  );

  itReq(
    ["R9.4", "R9.19", "U18.12", "A3", "D5", "F2"],
    "summarizes agent draft changes without exposing prompt bodies or raw paths",
    () => {
      const context = buildAssistantAgentEditorContext({
        archived: false,
        draft: {
          id: "agent-1",
          modelSelection: "",
          name: "/tmp/private agent",
          systemPrompt: "keep Bearer sk-secret safe",
          tagsInput: "analysis",
          temperature: "0.4",
          verbosity: "high",
        },
        initialDraft: {
          id: "agent-1",
          modelSelection: "",
          name: "Existing Agent",
          systemPrompt: "original prompt",
          tagsInput: "analysis",
          temperature: "0.2",
          verbosity: "low",
        },
      });

      expect(context.contextLabel).toContain("[redacted]");
      expect(context.draftState?.dirty).toBe(true);
      expect(context.draftState?.changedFields).toEqual([
        "name",
        "system prompt",
        "temperature",
        "verbosity",
      ]);
      expect(context.draftState?.summary).not.toContain("Bearer");
      expect(context.draftState?.summary).not.toContain("original prompt");
    },
  );

  itReq(
    ["R9.4", "R9.19", "U18.12", "A3", "D5", "F2"],
    "builds council view runtime context without transcript body details",
    () => {
      const context = buildAssistantCouncilViewContext({
        activeTab: "overview",
        assistantExportReconciliation: null,
        archived: false,
        autopilotMaxTurns: 12,
        autopilotTurnsCompleted: 3,
        councilId: "council-1",
        generationStatus: "running",
        hasBriefing: true,
        invalidConfig: false,
        memberCount: 5,
        messageCount: 8,
        mode: "autopilot",
        paused: false,
        plannedNextSpeakerAgentId: "agent-2",
        runtimeLeaseId: "00000000-0000-4000-8000-000000000222",
        started: true,
        title: "Quarterly Council",
        turnCount: 4,
      });

      expect(context.viewKind).toBe("councilView");
      expect(context.runtimeState).toEqual({
        leaseId: "00000000-0000-4000-8000-000000000222",
        councilId: "council-1",
        plannedNextSpeakerAgentId: "agent-2",
        status: "running",
      });
      expect(context.contextLabel).toContain("8 messages");
      expect(context.contextLabel).not.toContain("transcript");
      expect(context.listState).toBeNull();
      expect(context.draftState).toBeNull();
    },
  );

  itReq(
    ["R9.11", "R9.21", "R9.22", "A3", "D5"],
    "omits runtime lease context when council view has no active lease",
    () => {
      const context = buildAssistantCouncilViewContext({
        activeTab: "overview",
        assistantExportReconciliation: null,
        archived: false,
        autopilotMaxTurns: null,
        autopilotTurnsCompleted: 0,
        councilId: "council-1",
        generationStatus: "idle",
        hasBriefing: false,
        invalidConfig: false,
        memberCount: 2,
        messageCount: 3,
        mode: "manual",
        paused: false,
        plannedNextSpeakerAgentId: null,
        runtimeLeaseId: null,
        started: false,
        title: "Council",
        turnCount: 1,
      });

      expect(context.viewKind).toBe("councilView");
      expect(context.runtimeState).toBeNull();
    },
  );
});
