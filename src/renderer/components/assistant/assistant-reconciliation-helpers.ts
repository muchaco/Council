import type {
  AssistantAgentEditorSnapshot,
  AssistantCouncilEditorSnapshot,
} from "./assistant-context-builders";
import type {
  AssistantAgentDraftPatch,
  AssistantCouncilDraftPatch,
} from "./assistant-draft-adapters";

type AssistantModelRefOrNull = {
  providerId: string;
  modelId: string;
} | null;

export type AssistantSavedAgentFields = {
  name: string;
  modelRefOrNull: AssistantModelRefOrNull;
  systemPrompt: string;
  tags: ReadonlyArray<string>;
  temperature: number | null;
  verbosity: string | null;
};

export type AssistantSavedCouncilFields = {
  conductorModelRefOrNull: AssistantModelRefOrNull;
  goal: string | null;
  memberAgentIds: ReadonlyArray<string>;
  mode: "autopilot" | "manual";
  tags: ReadonlyArray<string>;
  title: string;
  topic: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isAssistantModelRefOrNull = (value: unknown): value is AssistantModelRefOrNull =>
  value === null ||
  (isRecord(value) && typeof value.providerId === "string" && typeof value.modelId === "string");

const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const toModelSelectionValue = (
  modelRefOrNull: {
    providerId: string;
    modelId: string;
  } | null,
): string =>
  modelRefOrNull === null ? "" : `${modelRefOrNull.providerId}:${modelRefOrNull.modelId}`;

const areStringArraysEqual = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const readSavedAgentFields = (
  output: Readonly<Record<string, unknown>>,
): AssistantSavedAgentFields | null => {
  const savedFields = output.savedFields;
  if (
    !isRecord(savedFields) ||
    typeof savedFields.name !== "string" ||
    !isAssistantModelRefOrNull(savedFields.modelRefOrNull) ||
    typeof savedFields.systemPrompt !== "string" ||
    !isStringArray(savedFields.tags) ||
    !(savedFields.temperature === null || typeof savedFields.temperature === "number") ||
    !(savedFields.verbosity === null || typeof savedFields.verbosity === "string")
  ) {
    return null;
  }

  return {
    name: savedFields.name,
    modelRefOrNull: savedFields.modelRefOrNull,
    systemPrompt: savedFields.systemPrompt,
    tags: savedFields.tags,
    temperature: savedFields.temperature,
    verbosity: savedFields.verbosity,
  };
};

export const readSavedCouncilFields = (
  output: Readonly<Record<string, unknown>>,
): AssistantSavedCouncilFields | null => {
  const savedFields = output.savedFields;
  if (
    !isRecord(savedFields) ||
    !isAssistantModelRefOrNull(savedFields.conductorModelRefOrNull) ||
    !(savedFields.goal === null || typeof savedFields.goal === "string") ||
    !isStringArray(savedFields.memberAgentIds) ||
    (savedFields.mode !== "autopilot" && savedFields.mode !== "manual") ||
    !isStringArray(savedFields.tags) ||
    typeof savedFields.title !== "string" ||
    typeof savedFields.topic !== "string"
  ) {
    return null;
  }

  return {
    conductorModelRefOrNull: savedFields.conductorModelRefOrNull,
    goal: savedFields.goal,
    memberAgentIds: savedFields.memberAgentIds,
    mode: savedFields.mode,
    tags: savedFields.tags,
    title: savedFields.title,
    topic: savedFields.topic,
  };
};

export const matchesAgentDraftPatch = (
  snapshot: AssistantAgentEditorSnapshot | null,
  patch: AssistantAgentDraftPatch,
): boolean => {
  if (snapshot === null) {
    return false;
  }

  return (
    (patch.name === undefined || snapshot.draft.name === patch.name) &&
    (patch.systemPrompt === undefined || snapshot.draft.systemPrompt === patch.systemPrompt) &&
    (patch.verbosity === undefined || snapshot.draft.verbosity === (patch.verbosity ?? "")) &&
    (patch.temperature === undefined ||
      snapshot.draft.temperature ===
        (patch.temperature === null ? "" : String(patch.temperature))) &&
    (patch.tags === undefined || snapshot.draft.tagsInput === patch.tags.join(", ")) &&
    (patch.modelRefOrNull === undefined ||
      snapshot.draft.modelSelection === toModelSelectionValue(patch.modelRefOrNull))
  );
};

export const matchesSavedAgentFields = (
  snapshot: AssistantAgentEditorSnapshot | null,
  savedFields: AssistantSavedAgentFields,
): boolean => {
  if (snapshot === null) {
    return false;
  }

  return (
    snapshot.draft.modelSelection === toModelSelectionValue(savedFields.modelRefOrNull) &&
    snapshot.draft.name === savedFields.name &&
    snapshot.draft.systemPrompt === savedFields.systemPrompt &&
    snapshot.draft.tagsInput === savedFields.tags.join(", ") &&
    snapshot.draft.temperature ===
      (savedFields.temperature === null ? "" : String(savedFields.temperature)) &&
    snapshot.draft.verbosity === (savedFields.verbosity ?? "")
  );
};

export const matchesCouncilDraftPatch = (
  snapshot: AssistantCouncilEditorSnapshot | null,
  patch: AssistantCouncilDraftPatch,
): boolean => {
  if (snapshot === null) {
    return false;
  }

  return (
    (patch.title === undefined || snapshot.draft.title === patch.title) &&
    (patch.topic === undefined || snapshot.draft.topic === patch.topic) &&
    (patch.goal === undefined || snapshot.draft.goal === (patch.goal ?? "")) &&
    (patch.mode === undefined || snapshot.draft.mode === patch.mode) &&
    (patch.tags === undefined || snapshot.draft.tagsInput === patch.tags.join(", ")) &&
    (patch.conductorModelRefOrNull === undefined ||
      snapshot.draft.conductorModelSelection ===
        toModelSelectionValue(patch.conductorModelRefOrNull)) &&
    (patch.memberAgentIds === undefined ||
      areStringArraysEqual(snapshot.draft.selectedMemberIds, patch.memberAgentIds))
  );
};

export const matchesSavedCouncilFields = (
  snapshot: AssistantCouncilEditorSnapshot | null,
  savedFields: AssistantSavedCouncilFields,
): boolean => {
  if (snapshot === null) {
    return false;
  }

  return (
    snapshot.draft.conductorModelSelection ===
      toModelSelectionValue(savedFields.conductorModelRefOrNull) &&
    snapshot.draft.goal === (savedFields.goal ?? "") &&
    areStringArraysEqual(snapshot.draft.selectedMemberIds, savedFields.memberAgentIds) &&
    snapshot.draft.mode === savedFields.mode &&
    snapshot.draft.tagsInput === savedFields.tags.join(", ") &&
    snapshot.draft.title === savedFields.title &&
    snapshot.draft.topic === savedFields.topic
  );
};
