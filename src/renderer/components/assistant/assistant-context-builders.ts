import type {
  AgentHomeListFilters,
  CouncilHomeListFilters,
} from "../../../shared/app-ui-helpers.js";
import { sanitizeAssistantContext } from "../../../shared/assistant/assistant-audit.js";
import type { AssistantContextEnvelope, AssistantListState } from "../../../shared/ipc/dto.js";

export type AssistantHomeTab = "councils" | "agents" | "settings";

export type AssistantHomeListSnapshot<
  TFilters extends AgentHomeListFilters | CouncilHomeListFilters,
> = {
  appliedFilters: TFilters;
  hasPendingChanges: boolean;
  total: number;
};

export type AssistantHomeViewSnapshot = {
  activeTab: AssistantHomeTab;
  agents: AssistantHomeListSnapshot<AgentHomeListFilters>;
  councils: AssistantHomeListSnapshot<CouncilHomeListFilters>;
};

export type AssistantAgentEditorDraftSnapshot = {
  id: string | null;
  modelSelection: string;
  name: string;
  systemPrompt: string;
  tagsInput: string;
  temperature: string;
  verbosity: string;
};

export type AssistantAgentEditorSnapshot = {
  archived: boolean;
  draft: AssistantAgentEditorDraftSnapshot;
  initialDraft: AssistantAgentEditorDraftSnapshot;
};

export type AssistantCouncilEditorDraftSnapshot = {
  conductorModelSelection: string;
  goal: string;
  id: string | null;
  mode: "autopilot" | "manual";
  selectedMemberIds: ReadonlyArray<string>;
  tagsInput: string;
  title: string;
  topic: string;
};

export type AssistantCouncilEditorSnapshot = {
  archived: boolean;
  draft: AssistantCouncilEditorDraftSnapshot;
  initialDraft: AssistantCouncilEditorDraftSnapshot;
};

export type AssistantCouncilViewSnapshot = {
  activeTab: "overview" | "config";
  archived: boolean;
  autopilotMaxTurns: number | null;
  autopilotTurnsCompleted: number;
  councilId: string;
  generationStatus: "idle" | "running";
  hasBriefing: boolean;
  invalidConfig: boolean;
  memberCount: number;
  messageCount: number;
  mode: "autopilot" | "manual";
  paused: boolean;
  plannedNextSpeakerAgentId: string | null;
  started: boolean;
  title: string;
  turnCount: number;
};

const toAssistantListState = (
  filters: AgentHomeListFilters | CouncilHomeListFilters,
): AssistantListState => ({
  archivedFilter: filters.archivedFilter,
  searchText: filters.searchText.trim(),
  sortBy: filters.sortBy,
  sortDirection: filters.sortDirection,
  tagFilter: filters.tagFilter.trim(),
});

const summarizePendingListState = (params: {
  hasPendingChanges: boolean;
  total: number;
}): string => {
  const parts = [`${params.total} visible`];

  if (params.hasPendingChanges) {
    parts.push("query draft pending");
  }

  return parts.join(" - ");
};

const formatChangedFieldSummary = (params: {
  changedFields: ReadonlyArray<string>;
  entityLabel: string;
}): string => {
  if (params.changedFields.length === 0) {
    return `${params.entityLabel} draft matches the saved state.`;
  }

  return `${params.entityLabel} draft has ${params.changedFields.length} unsaved field change${params.changedFields.length === 1 ? "" : "s"}: ${params.changedFields.join(", ")}.`;
};

const areFieldValuesEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const pickChangedFields = <TDraft extends Readonly<Record<string, unknown>>>(params: {
  draft: TDraft;
  fieldLabels: Readonly<Record<keyof TDraft, string>>;
  initialDraft: TDraft;
}): ReadonlyArray<string> => {
  return (Object.keys(params.fieldLabels) as Array<keyof TDraft>).flatMap((field) =>
    areFieldValuesEqual(params.draft[field], params.initialDraft[field])
      ? []
      : [params.fieldLabels[field]],
  );
};

export const buildAssistantHomeContext = (
  snapshot: AssistantHomeViewSnapshot,
): AssistantContextEnvelope => {
  if (snapshot.activeTab === "settings") {
    return sanitizeAssistantContext({
      activeEntityId: null,
      contextLabel: "Home / Settings",
      draftState: null,
      listState: null,
      runtimeState: null,
      selectionIds: [],
      viewKind: "settings",
    });
  }

  const listSnapshot = snapshot.activeTab === "agents" ? snapshot.agents : snapshot.councils;
  const contextLabel =
    snapshot.activeTab === "agents"
      ? `Home / Agents - ${summarizePendingListState(listSnapshot)}`
      : `Home / Councils - ${summarizePendingListState(listSnapshot)}`;

  return sanitizeAssistantContext({
    activeEntityId: null,
    contextLabel,
    draftState: null,
    listState: toAssistantListState(listSnapshot.appliedFilters),
    runtimeState: null,
    selectionIds: [],
    viewKind: snapshot.activeTab === "agents" ? "agentsList" : "councilsList",
  });
};

export const buildAssistantAgentEditorContext = (
  snapshot: AssistantAgentEditorSnapshot,
): AssistantContextEnvelope => {
  const changedFields = pickChangedFields({
    draft: snapshot.draft,
    fieldLabels: {
      id: "identity",
      modelSelection: "model",
      name: "name",
      systemPrompt: "system prompt",
      tagsInput: "tags",
      temperature: "temperature",
      verbosity: "verbosity",
    },
    initialDraft: snapshot.initialDraft,
  });
  const displayName =
    snapshot.draft.name.trim().length > 0 ? snapshot.draft.name.trim() : "New Agent";

  return sanitizeAssistantContext({
    activeEntityId: snapshot.draft.id,
    contextLabel: `Agent editor / ${displayName}${snapshot.archived ? " - archived" : ""}`,
    draftState: {
      changedFields,
      dirty: changedFields.length > 0,
      entityId: snapshot.draft.id,
      entityKind: "agent",
      summary: formatChangedFieldSummary({
        changedFields,
        entityLabel: "Agent",
      }),
    },
    listState: null,
    runtimeState: null,
    selectionIds: [],
    viewKind: "agentEdit",
  });
};

export const buildAssistantCouncilEditorContext = (
  snapshot: AssistantCouncilEditorSnapshot,
): AssistantContextEnvelope => {
  const changedFields = pickChangedFields({
    draft: snapshot.draft,
    fieldLabels: {
      conductorModelSelection: "conductor model",
      goal: "goal",
      id: "identity",
      mode: "mode",
      selectedMemberIds: "members",
      tagsInput: "tags",
      title: "title",
      topic: "topic",
    },
    initialDraft: snapshot.initialDraft,
  });
  const displayName =
    snapshot.draft.title.trim().length > 0 ? snapshot.draft.title.trim() : "New Council";

  return sanitizeAssistantContext({
    activeEntityId: snapshot.draft.id,
    contextLabel: `Council editor / ${displayName}${snapshot.archived ? " - archived" : ""}`,
    draftState: {
      changedFields,
      dirty: changedFields.length > 0,
      entityId: snapshot.draft.id,
      entityKind: "council",
      summary: formatChangedFieldSummary({
        changedFields,
        entityLabel: "Council",
      }),
    },
    listState: null,
    runtimeState: null,
    selectionIds: snapshot.draft.selectedMemberIds,
    viewKind: "councilCreate",
  });
};

export const buildAssistantCouncilViewContext = (
  snapshot: AssistantCouncilViewSnapshot,
): AssistantContextEnvelope => {
  const runtimeStatus = snapshot.started ? (snapshot.paused ? "paused" : "running") : "idle";

  return sanitizeAssistantContext({
    activeEntityId: snapshot.councilId,
    contextLabel: `Council view / ${snapshot.title} / ${snapshot.activeTab} - ${snapshot.messageCount} messages, ${snapshot.memberCount} members${snapshot.archived ? ", archived" : ""}${snapshot.invalidConfig ? ", invalid config" : ""}${snapshot.hasBriefing ? ", briefing ready" : ""}`,
    draftState: null,
    listState: null,
    runtimeState: {
      councilId: snapshot.councilId,
      plannedNextSpeakerAgentId: snapshot.plannedNextSpeakerAgentId,
      status: runtimeStatus,
    },
    selectionIds: [],
    viewKind: "councilView",
  });
};
