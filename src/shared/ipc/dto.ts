import type { DomainError } from "../domain/errors.js";
import type { ModelCatalogByProvider, ModelRef } from "../domain/model-ref.js";

export const PROVIDER_IDS = ["gemini", "ollama", "openrouter"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const VIEW_KINDS = [
  "settings",
  "agentsList",
  "agentEdit",
  "councilsList",
  "councilCreate",
  "councilView",
] as const;

export type ViewKind = (typeof VIEW_KINDS)[number];

export type IpcResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: DomainError;
    };

export type HealthPingRequest = {
  message: string;
};

export type HealthPingResponse = {
  pong: string;
  timestampUtc: string;
};

export type ProviderDraftDto = {
  providerId: ProviderId;
  endpointUrl: string | null;
  apiKey: string | null;
};

export type ProviderConfigDto = {
  providerId: ProviderId;
  endpointUrl: string | null;
  hasCredential: boolean;
  lastSavedAtUtc: string | null;
};

export type ModelCatalogSnapshotDto = {
  snapshotId: string;
  modelsByProvider: ModelCatalogByProvider;
};

export type GetSettingsViewRequest = {
  viewKind: ViewKind;
};

export type GetSettingsViewResponse = {
  providers: ReadonlyArray<ProviderConfigDto>;
  globalDefaultModelRef: ModelRef | null;
  globalDefaultModelInvalidConfig: boolean;
  contextLastN: number;
  modelCatalog: ModelCatalogSnapshotDto;
  canRefreshModels: boolean;
};

export type TestProviderConnectionRequest = {
  provider: ProviderDraftDto;
};

export type TestProviderConnectionResponse = {
  providerId: ProviderId;
  testToken: string;
  statusText: string;
  modelsByProvider: ModelCatalogByProvider;
};

export type SaveProviderConfigRequest = {
  provider: ProviderDraftDto;
  testToken: string;
};

export type SaveProviderConfigResponse = {
  provider: ProviderConfigDto;
  modelCatalog: ModelCatalogSnapshotDto;
};

export type DisconnectProviderRequest = {
  providerId: ProviderId;
  viewKind: ViewKind;
};

export type DisconnectProviderResponse = {
  provider: ProviderConfigDto;
  modelCatalog: ModelCatalogSnapshotDto;
};

export type RefreshModelCatalogRequest = {
  viewKind: ViewKind;
};

export type RefreshModelCatalogResponse = {
  modelCatalog: ModelCatalogSnapshotDto;
};

export type SetGlobalDefaultModelRequest = {
  viewKind: ViewKind;
  modelRefOrNull: ModelRef | null;
};

export type SetGlobalDefaultModelResponse = {
  globalDefaultModelRef: ModelRef | null;
  globalDefaultModelInvalidConfig: boolean;
};

export type SetContextLastNRequest = {
  viewKind: ViewKind;
  contextLastN: number;
};

export type SetContextLastNResponse = {
  contextLastN: number;
};

export const AGENT_SORT_FIELDS = ["createdAt", "updatedAt"] as const;
export type AgentSortField = (typeof AGENT_SORT_FIELDS)[number];

export const AGENT_ARCHIVED_FILTERS = ["active", "archived", "all"] as const;
export type AgentArchivedFilter = (typeof AGENT_ARCHIVED_FILTERS)[number];

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export type AgentDto = {
  id: string;
  name: string;
  systemPrompt: string;
  verbosity: string | null;
  temperature: number | null;
  tags: ReadonlyArray<string>;
  modelRefOrNull: ModelRef | null;
  invalidConfig: boolean;
  archived: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type ListAgentsRequest = {
  viewKind: "agentsList";
  searchText: string;
  tagFilter: string;
  archivedFilter: AgentArchivedFilter;
  sortBy: AgentSortField;
  sortDirection: SortDirection;
  page: number;
};

export type ListAgentsResponse = {
  items: ReadonlyArray<AgentDto>;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  modelCatalog: ModelCatalogSnapshotDto;
  globalDefaultModelRef: ModelRef | null;
};

export type GetAgentEditorViewRequest = {
  viewKind: "agentEdit";
  agentId: string | null;
};

export type GetAgentEditorViewResponse = {
  agent: AgentDto | null;
  modelCatalog: ModelCatalogSnapshotDto;
  globalDefaultModelRef: ModelRef | null;
  canRefreshModels: boolean;
};

export type SaveAgentRequest = {
  viewKind: "agentEdit";
  id: string | null;
  name: string;
  systemPrompt: string;
  verbosity: string | null;
  temperature: number | null;
  tags: ReadonlyArray<string>;
  modelRefOrNull: ModelRef | null;
};

export type SaveAgentResponse = {
  agent: AgentDto;
};

export type DeleteAgentRequest = {
  id: string;
};

export type DeleteAgentResponse = {
  deletedId: string;
};

export type SetAgentArchivedRequest = {
  id: string;
  archived: boolean;
};

export type SetAgentArchivedResponse = {
  agent: AgentDto;
};

export const COUNCIL_MODES = ["autopilot", "manual"] as const;
export type CouncilMode = (typeof COUNCIL_MODES)[number];

export const COUNCIL_ARCHIVED_FILTERS = ["active", "archived", "all"] as const;
export type CouncilArchivedFilter = (typeof COUNCIL_ARCHIVED_FILTERS)[number];

export const COUNCIL_SORT_FIELDS = ["createdAt", "updatedAt"] as const;
export type CouncilSortField = (typeof COUNCIL_SORT_FIELDS)[number];

export type CouncilAgentOptionDto = {
  id: string;
  name: string;
  invalidConfig: boolean;
  archived: boolean;
};

export type CouncilDto = {
  id: string;
  title: string;
  topic: string;
  goal: string | null;
  tags: ReadonlyArray<string>;
  mode: CouncilMode;
  memberAgentIds: ReadonlyArray<string>;
  memberColorsByAgentId: Readonly<Record<string, string>>;
  conductorModelRefOrNull: ModelRef | null;
  invalidConfig: boolean;
  archived: boolean;
  started: boolean;
  paused: boolean;
  autopilotMaxTurns: number | null;
  autopilotTurnsCompleted: number;
  turnCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type ListCouncilsRequest = {
  viewKind: "councilsList";
  searchText: string;
  tagFilter: string;
  archivedFilter: CouncilArchivedFilter;
  sortBy: CouncilSortField;
  sortDirection: SortDirection;
  page: number;
};

export type ListCouncilsResponse = {
  items: ReadonlyArray<CouncilDto>;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  modelCatalog: ModelCatalogSnapshotDto;
  globalDefaultModelRef: ModelRef | null;
};

export type GetCouncilEditorViewRequest = {
  viewKind: "councilCreate";
  councilId: string | null;
};

export type GetCouncilEditorViewResponse = {
  council: CouncilDto | null;
  availableAgents: ReadonlyArray<CouncilAgentOptionDto>;
  modelCatalog: ModelCatalogSnapshotDto;
  globalDefaultModelRef: ModelRef | null;
  canRefreshModels: boolean;
};

export type GetCouncilViewRequest = {
  viewKind: "councilView";
  councilId: string;
};

export type GetCouncilViewResponse = {
  council: CouncilDto;
  availableAgents: ReadonlyArray<CouncilAgentOptionDto>;
  messages: ReadonlyArray<CouncilMessageDto>;
  briefing: CouncilRuntimeBriefingDto | null;
  generation: CouncilGenerationStateDto;
  modelCatalog: ModelCatalogSnapshotDto;
  globalDefaultModelRef: ModelRef | null;
  canRefreshModels: boolean;
};

export type CouncilMessageDto = {
  id: string;
  councilId: string;
  sequenceNumber: number;
  senderKind: "member" | "conductor";
  senderAgentId: string | null;
  senderName: string;
  senderColor: string | null;
  content: string;
  createdAtUtc: string;
};

export type CouncilRuntimeBriefingDto = {
  briefing: string;
  goalReached: boolean;
  updatedAtUtc: string;
};

export type CouncilGenerationStateDto = {
  status: "idle" | "running";
  kind: "manualMemberTurn" | "autopilotStep" | "conductorBriefing" | "autopilotOpening" | null;
  activeMemberAgentId: string | null;
  plannedNextSpeakerAgentId: string | null;
};

export type SaveCouncilRequest = {
  viewKind: "councilCreate" | "councilView";
  id: string | null;
  title: string;
  topic: string;
  goal: string | null;
  mode: CouncilMode;
  tags: ReadonlyArray<string>;
  memberAgentIds: ReadonlyArray<string>;
  memberColorsByAgentId: Readonly<Record<string, string>>;
  conductorModelRefOrNull: ModelRef | null;
};

export type SaveCouncilResponse = {
  council: CouncilDto;
};

export type DeleteCouncilRequest = {
  id: string;
};

export type DeleteCouncilResponse = {
  deletedId: string;
};

export type SetCouncilArchivedRequest = {
  id: string;
  archived: boolean;
};

export type SetCouncilArchivedResponse = {
  council: CouncilDto;
};

export type StartCouncilRequest = {
  viewKind: "councilView";
  id: string;
  maxTurns: number | null;
};

export type StartCouncilResponse = {
  council: CouncilDto;
};

export type PauseCouncilAutopilotRequest = {
  id: string;
};

export type PauseCouncilAutopilotResponse = {
  council: CouncilDto;
};

export type ResumeCouncilAutopilotRequest = {
  viewKind: "councilView";
  id: string;
  maxTurns: number | null;
};

export type ResumeCouncilAutopilotResponse = {
  council: CouncilDto;
};

export type GenerateManualCouncilTurnRequest = {
  viewKind: "councilView";
  id: string;
  memberAgentId: string;
};

export type GenerateManualCouncilTurnResponse = {
  council: CouncilDto;
  message: CouncilMessageDto;
};

export type InjectConductorMessageRequest = {
  viewKind: "councilView";
  id: string;
  content: string;
};

export type InjectConductorMessageResponse = {
  council: CouncilDto;
  message: CouncilMessageDto;
};

export type AdvanceAutopilotTurnRequest = {
  viewKind: "councilView";
  id: string;
};

export type AdvanceAutopilotTurnResponse = {
  council: CouncilDto;
  message: CouncilMessageDto;
  selectedMemberAgentId: string;
};

export type CancelCouncilGenerationRequest = {
  id: string;
};

export type CancelCouncilGenerationResponse = {
  cancelled: boolean;
};

export type ExportCouncilTranscriptRequest = {
  viewKind: "councilsList" | "councilView";
  id: string;
};

export type ExportCouncilTranscriptResponse =
  | {
      status: "exported";
      filePath: string;
    }
  | {
      status: "cancelled";
      filePath: null;
    };
