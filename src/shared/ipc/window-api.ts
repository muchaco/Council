import type {
  DeleteAgentRequest,
  DeleteAgentResponse,
  DeleteCouncilRequest,
  DeleteCouncilResponse,
  GetAgentEditorViewRequest,
  GetAgentEditorViewResponse,
  GetCouncilEditorViewRequest,
  GetCouncilEditorViewResponse,
  GetSettingsViewRequest,
  GetSettingsViewResponse,
  HealthPingRequest,
  HealthPingResponse,
  IpcResult,
  ListAgentsRequest,
  ListAgentsResponse,
  ListCouncilsRequest,
  ListCouncilsResponse,
  RefreshModelCatalogRequest,
  RefreshModelCatalogResponse,
  SaveAgentRequest,
  SaveAgentResponse,
  SaveCouncilRequest,
  SaveCouncilResponse,
  SaveProviderConfigRequest,
  SaveProviderConfigResponse,
  SetCouncilArchivedRequest,
  SetCouncilArchivedResponse,
  SetGlobalDefaultModelRequest,
  SetGlobalDefaultModelResponse,
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
  };
  providers: {
    testConnection: (
      request: TestProviderConnectionRequest,
    ) => Promise<IpcResult<TestProviderConnectionResponse>>;
    saveConfig: (
      request: SaveProviderConfigRequest,
    ) => Promise<IpcResult<SaveProviderConfigResponse>>;
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
    refreshModelCatalog: (
      request: RefreshModelCatalogRequest,
    ) => Promise<IpcResult<RefreshModelCatalogResponse>>;
  };
  councils: {
    list: (request: ListCouncilsRequest) => Promise<IpcResult<ListCouncilsResponse>>;
    getEditorView: (
      request: GetCouncilEditorViewRequest,
    ) => Promise<IpcResult<GetCouncilEditorViewResponse>>;
    save: (request: SaveCouncilRequest) => Promise<IpcResult<SaveCouncilResponse>>;
    delete: (request: DeleteCouncilRequest) => Promise<IpcResult<DeleteCouncilResponse>>;
    setArchived: (
      request: SetCouncilArchivedRequest,
    ) => Promise<IpcResult<SetCouncilArchivedResponse>>;
    refreshModelCatalog: (
      request: RefreshModelCatalogRequest,
    ) => Promise<IpcResult<RefreshModelCatalogResponse>>;
  };
}
