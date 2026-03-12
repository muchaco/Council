export type AssistantDraftReconciliation = {
  completion: {
    output: Readonly<Record<string, unknown>> | null;
    userSummary: string | null;
  } | null;
  failureMessage: string | null;
  status: "completed" | "failed";
};

export type AssistantAgentDraftPatch = {
  name?: string;
  systemPrompt?: string;
  verbosity?: string | null;
  temperature?: number | null;
  tags?: ReadonlyArray<string>;
};

export type AssistantCouncilDraftPatch = {
  title?: string;
  topic?: string;
  goal?: string | null;
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
