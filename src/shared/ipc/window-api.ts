import type {
  AdvanceAutopilotTurnRequest,
  AdvanceAutopilotTurnResponse,
  AssistantCancelSessionRequest,
  AssistantCancelSessionResponse,
  AssistantCloseSessionRequest,
  AssistantCloseSessionResponse,
  AssistantCreateSessionRequest,
  AssistantCreateSessionResponse,
  AssistantSubmitRequest,
  AssistantSubmitResponse,
  CancelCouncilGenerationRequest,
  CancelCouncilGenerationResponse,
  DeleteAgentRequest,
  DeleteAgentResponse,
  DeleteCouncilRequest,
  DeleteCouncilResponse,
  DisconnectProviderRequest,
  DisconnectProviderResponse,
  ExportCouncilTranscriptRequest,
  ExportCouncilTranscriptResponse,
  GenerateManualCouncilTurnRequest,
  GenerateManualCouncilTurnResponse,
  GetAgentEditorViewRequest,
  GetAgentEditorViewResponse,
  GetCouncilEditorViewRequest,
  GetCouncilEditorViewResponse,
  GetCouncilViewRequest,
  GetCouncilViewResponse,
  GetSettingsViewRequest,
  GetSettingsViewResponse,
  HealthPingRequest,
  HealthPingResponse,
  InjectConductorMessageRequest,
  InjectConductorMessageResponse,
  IpcResult,
  ListAgentsRequest,
  ListAgentsResponse,
  ListCouncilsRequest,
  ListCouncilsResponse,
  PauseCouncilAutopilotRequest,
  PauseCouncilAutopilotResponse,
  RefreshModelCatalogRequest,
  RefreshModelCatalogResponse,
  ResumeCouncilAutopilotRequest,
  ResumeCouncilAutopilotResponse,
  SaveAgentRequest,
  SaveAgentResponse,
  SaveCouncilRequest,
  SaveCouncilResponse,
  SaveProviderConfigRequest,
  SaveProviderConfigResponse,
  SetAgentArchivedRequest,
  SetAgentArchivedResponse,
  SetContextLastNRequest,
  SetContextLastNResponse,
  SetCouncilArchivedRequest,
  SetCouncilArchivedResponse,
  SetGlobalDefaultModelRequest,
  SetGlobalDefaultModelResponse,
  StartCouncilRequest,
  StartCouncilResponse,
  TestProviderConnectionRequest,
  TestProviderConnectionResponse,
} from "./dto.js";

export interface WindowApi {
  health: {
    ping: (request: HealthPingRequest) => Promise<IpcResult<HealthPingResponse>>;
  };
  settings: {
    getView: (request: GetSettingsViewRequest) => Promise<IpcResult<GetSettingsViewResponse>>;
    setGlobalDefaultModel: (
      request: SetGlobalDefaultModelRequest,
    ) => Promise<IpcResult<SetGlobalDefaultModelResponse>>;
    setContextLastN: (
      request: SetContextLastNRequest,
    ) => Promise<IpcResult<SetContextLastNResponse>>;
  };
  providers: {
    testConnection: (
      request: TestProviderConnectionRequest,
    ) => Promise<IpcResult<TestProviderConnectionResponse>>;
    saveConfig: (
      request: SaveProviderConfigRequest,
    ) => Promise<IpcResult<SaveProviderConfigResponse>>;
    disconnect: (
      request: DisconnectProviderRequest,
    ) => Promise<IpcResult<DisconnectProviderResponse>>;
    refreshModelCatalog: (
      request: RefreshModelCatalogRequest,
    ) => Promise<IpcResult<RefreshModelCatalogResponse>>;
  };
  agents: {
    list: (request: ListAgentsRequest) => Promise<IpcResult<ListAgentsResponse>>;
    getEditorView: (
      request: GetAgentEditorViewRequest,
    ) => Promise<IpcResult<GetAgentEditorViewResponse>>;
    save: (request: SaveAgentRequest) => Promise<IpcResult<SaveAgentResponse>>;
    delete: (request: DeleteAgentRequest) => Promise<IpcResult<DeleteAgentResponse>>;
    setArchived: (request: SetAgentArchivedRequest) => Promise<IpcResult<SetAgentArchivedResponse>>;
    refreshModelCatalog: (
      request: RefreshModelCatalogRequest,
    ) => Promise<IpcResult<RefreshModelCatalogResponse>>;
  };
  councils: {
    list: (request: ListCouncilsRequest) => Promise<IpcResult<ListCouncilsResponse>>;
    getEditorView: (
      request: GetCouncilEditorViewRequest,
    ) => Promise<IpcResult<GetCouncilEditorViewResponse>>;
    getCouncilView: (request: GetCouncilViewRequest) => Promise<IpcResult<GetCouncilViewResponse>>;
    save: (request: SaveCouncilRequest) => Promise<IpcResult<SaveCouncilResponse>>;
    delete: (request: DeleteCouncilRequest) => Promise<IpcResult<DeleteCouncilResponse>>;
    setArchived: (
      request: SetCouncilArchivedRequest,
    ) => Promise<IpcResult<SetCouncilArchivedResponse>>;
    start: (request: StartCouncilRequest) => Promise<IpcResult<StartCouncilResponse>>;
    pauseAutopilot: (
      request: PauseCouncilAutopilotRequest,
    ) => Promise<IpcResult<PauseCouncilAutopilotResponse>>;
    resumeAutopilot: (
      request: ResumeCouncilAutopilotRequest,
    ) => Promise<IpcResult<ResumeCouncilAutopilotResponse>>;
    generateManualTurn: (
      request: GenerateManualCouncilTurnRequest,
    ) => Promise<IpcResult<GenerateManualCouncilTurnResponse>>;
    injectConductorMessage: (
      request: InjectConductorMessageRequest,
    ) => Promise<IpcResult<InjectConductorMessageResponse>>;
    advanceAutopilotTurn: (
      request: AdvanceAutopilotTurnRequest,
    ) => Promise<IpcResult<AdvanceAutopilotTurnResponse>>;
    cancelGeneration: (
      request: CancelCouncilGenerationRequest,
    ) => Promise<IpcResult<CancelCouncilGenerationResponse>>;
    exportTranscript: (
      request: ExportCouncilTranscriptRequest,
    ) => Promise<IpcResult<ExportCouncilTranscriptResponse>>;
    refreshModelCatalog: (
      request: RefreshModelCatalogRequest,
    ) => Promise<IpcResult<RefreshModelCatalogResponse>>;
  };
  assistant: {
    createSession: (
      request: AssistantCreateSessionRequest,
    ) => Promise<IpcResult<AssistantCreateSessionResponse>>;
    submit: (request: AssistantSubmitRequest) => Promise<IpcResult<AssistantSubmitResponse>>;
    cancelSession: (
      request: AssistantCancelSessionRequest,
    ) => Promise<IpcResult<AssistantCancelSessionResponse>>;
    closeSession: (
      request: AssistantCloseSessionRequest,
    ) => Promise<IpcResult<AssistantCloseSessionResponse>>;
  };
}
