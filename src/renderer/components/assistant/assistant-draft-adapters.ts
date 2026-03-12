export type AssistantDraftReconciliation = {
  completion: {
    output: Readonly<Record<string, unknown>> | null;
    userSummary: string | null;
  } | null;
  failureMessage: string | null;
  status: "completed" | "failed";
};

export type AssistantAgentDraftPatch = {
  modelRefOrNull?: {
    providerId: string;
    modelId: string;
  } | null;
  name?: string;
  systemPrompt?: string;
  verbosity?: string | null;
  temperature?: number | null;
  tags?: ReadonlyArray<string>;
};

export type AssistantCouncilDraftPatch = {
  conductorModelRefOrNull?: {
    providerId: string;
    modelId: string;
  } | null;
  title?: string;
  topic?: string;
  goal?: string | null;
  memberAgentIds?: ReadonlyArray<string>;
  mode?: "autopilot" | "manual";
  tags?: ReadonlyArray<string>;
};

export type AssistantAgentDraftAdapter = (params: {
  entityId: string | null;
  patch: AssistantAgentDraftPatch;
}) => Promise<AssistantDraftReconciliation>;

export type AssistantCouncilDraftAdapter = (params: {
  entityId: string | null;
  patch: AssistantCouncilDraftPatch;
}) => Promise<AssistantDraftReconciliation>;

export type AssistantAgentSaveAdapter = (params: {
  entityId: string | null;
}) => Promise<AssistantDraftReconciliation>;

export type AssistantCouncilSaveAdapter = (params: {
  entityId: string | null;
}) => Promise<AssistantDraftReconciliation>;
