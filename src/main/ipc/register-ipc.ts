import { randomUUID } from "node:crypto";
import path from "node:path";
import { app, ipcMain } from "electron";
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { domainError } from "../../shared/domain/errors.js";
import { asAgentId, asCouncilId } from "../../shared/domain/ids.js";
import { buildAvailableModelKeys, isModelConfigInvalid } from "../../shared/domain/model-ref.js";
import { createTag } from "../../shared/domain/tag.js";
import type { ProviderId } from "../../shared/ipc/dto.js";
import type { HealthPingResponse, IpcResult } from "../../shared/ipc/dto.js";
import { HEALTH_PING_REQUEST_SCHEMA } from "../../shared/ipc/validators.js";
import { createAgentsIpcHandlers } from "../features/agents/ipc-handlers.js";
import { createAgentsSlice } from "../features/agents/slice.js";
import { createAssistantIpcHandlers } from "../features/assistant/ipc-handlers.js";
import { createAssistantSlice } from "../features/assistant/slice.js";
import { createCouncilsIpcHandlers } from "../features/councils/ipc-handlers.js";
import { createCouncilsSlice } from "../features/councils/slice.js";
import { createSettingsIpcHandlers } from "../features/settings/ipc-handlers.js";
import { createSettingsSlice } from "../features/settings/slice.js";
import { createLogger } from "../logging/index.js";
import { createProviderAiService } from "../services/ai/provider-ai-service.js";
import { createAssistantAuditService } from "../services/assistant/assistant-audit-service.js";
import { createSqlitePersistenceService } from "../services/db/sqlite-persistence-service.js";
import { createElectronExportService } from "../services/export/electron-export-service.js";
import { createKeytarKeychainService } from "../services/keychain/keytar-keychain-service.js";

const toValidationFailure = (devMessage: string): IpcResult<never> => ({
  ok: false,
  error: domainError("ValidationError", devMessage, "Invalid request."),
});

export const registerIpcHandlers = (): {
  releaseWebContentsResources: (webContentsId: number) => void;
} => {
  const HOME_LIST_PAGE_SIZE = 12;
  const logger = createLogger();
  const dbFilePath = path.join(app.getPath("userData"), "council3.sqlite3");
  const migrationsDirPath = path.join(process.cwd(), "src", "main", "services", "db", "migrations");
  const persistence = createSqlitePersistenceService({
    dbFilePath,
    migrationsDirPath,
  });
  const initResult = persistence.initialize();
  if (initResult.isErr()) {
    throw new Error(`Database initialization failed: ${initResult.error.message}`);
  }

  const toDomainPersistenceError = (message: string) =>
    domainError("InternalError", message, "Database operation failed.");

  const keychain = createKeytarKeychainService();
  const aiService = createProviderAiService({
    logger,
    loadProviderConfig: (providerId) => {
      const stateResult = persistence.loadSettingsState();
      if (stateResult.isErr()) {
        return errAsync("ProviderError");
      }

      const providerConfig = stateResult.value.providerConfigs.find(
        (config) => config.providerId === (providerId as ProviderId),
      );

      return okAsync(
        providerConfig === undefined
          ? null
          : {
              endpointUrl: providerConfig.endpointUrl,
              credentialRef: providerConfig.credentialRef,
            },
      );
    },
    loadSecret: (account) =>
      keychain.loadSecret({ account }).mapErr(() => "ProviderError" as const),
  });
  const exportService = createElectronExportService();
  const assistantAuditService = createAssistantAuditService(logger);

  const settingsSlice = createSettingsSlice({
    saveSecret: keychain.saveSecret,
    deleteSecret: keychain.deleteSecret,
    loadSecret: ({ account }) => keychain.loadSecret({ account }),
    loadPersistedState: () => {
      const result = persistence.loadSettingsState();
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }
      return okAsync(result.value);
    },
    persistProviderConfig: (params) => {
      const result = persistence.saveProviderConfig(params);
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }
      return okAsync(undefined);
    },
    deleteProviderConfig: (providerId) => {
      const result = persistence.deleteProviderConfig(providerId);
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }
      return okAsync(undefined);
    },
    persistGlobalDefaultModel: ({ modelRefOrNull, updatedAtUtc }) => {
      const result = persistence.saveGlobalDefaultModel(modelRefOrNull, updatedAtUtc);
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }
      return okAsync(undefined);
    },
    persistContextLastN: ({ contextLastN, updatedAtUtc }) => {
      const result = persistence.saveContextLastN(contextLastN, updatedAtUtc);
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }
      return okAsync(undefined);
    },
  });
  const councilsSlice = createCouncilsSlice({
    nowUtc: () => new Date().toISOString(),
    createCouncilId: () => asCouncilId(randomUUID()),
    pageSize: HOME_LIST_PAGE_SIZE,
    logger,
    getModelContext: ({ webContentsId, viewKind }) =>
      settingsSlice
        .getSettingsView({
          webContentsId,
          viewKind,
        })
        .map((view) => ({
          modelCatalog: view.modelCatalog,
          globalDefaultModelRef: view.globalDefaultModelRef,
          canRefreshModels: view.canRefreshModels,
        })),
    refreshModelCatalog: ({ webContentsId, viewKind }) =>
      settingsSlice.refreshModelCatalog({
        webContentsId,
        viewKind,
      }),
    listAvailableAgents: ({ webContentsId, viewKind }) =>
      settingsSlice.getSettingsView({ webContentsId, viewKind }).andThen((view) => {
        const loadAgentsResult = persistence.loadAgents();
        if (loadAgentsResult.isErr()) {
          return errAsync(toDomainPersistenceError(loadAgentsResult.error.message));
        }

        const availableModelKeys = buildAvailableModelKeys(view.modelCatalog.modelsByProvider);
        return okAsync(
          loadAgentsResult.value
            .map((agent) => ({
              description: agent.systemPrompt,
              id: agent.id,
              name: agent.name,
              systemPrompt: agent.systemPrompt,
              tags: agent.tags,
              verbosity: agent.verbosity,
              modelRefOrNull: agent.modelRefOrNull,
              invalidConfig: isModelConfigInvalid({
                modelRefOrNull: agent.modelRefOrNull,
                globalDefaultModelRef: view.globalDefaultModelRef,
                availableModelKeys,
              }),
              archived: agent.archivedAtUtc !== null,
            }))
            .sort((left, right) => left.name.localeCompare(right.name)),
        );
      }),
    loadPersistedCouncils: () => {
      const result = persistence.loadCouncils();
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }

      return okAsync(
        result.value.map((council) => ({
          id: asCouncilId(council.id),
          title: council.title,
          topic: council.topic,
          goal: council.goal,
          mode: council.mode,
          tags: council.tags.flatMap((tag) => {
            const parsed = createTag(tag);
            return parsed.isOk() ? [parsed.value] : [];
          }),
          memberAgentIds: council.memberAgentIds.map((id) => asAgentId(id)),
          memberColorsByAgentId: council.memberColorsByAgentId,
          conductorModelRefOrNull: council.conductorModelRefOrNull,
          archivedAtUtc: council.archivedAtUtc,
          startedAtUtc: council.startedAtUtc,
          autopilotPaused: council.autopilotPaused,
          autopilotMaxTurns: council.autopilotMaxTurns,
          autopilotTurnsCompleted: council.autopilotTurnsCompleted,
          turnCount: council.turnCount,
          createdAtUtc: council.createdAtUtc,
          updatedAtUtc: council.updatedAtUtc,
        })),
      );
    },
    persistCouncil: (council) => {
      const result = persistence.saveCouncil({
        id: council.id,
        title: council.title,
        topic: council.topic,
        goal: council.goal,
        mode: council.mode,
        tags: council.tags,
        memberAgentIds: council.memberAgentIds,
        memberColorsByAgentId: council.memberColorsByAgentId,
        conductorModelRefOrNull: council.conductorModelRefOrNull,
        archivedAtUtc: council.archivedAtUtc,
        startedAtUtc: council.startedAtUtc,
        autopilotPaused: council.autopilotPaused,
        autopilotMaxTurns: council.autopilotMaxTurns,
        autopilotTurnsCompleted: council.autopilotTurnsCompleted,
        turnCount: council.turnCount,
        createdAtUtc: council.createdAtUtc,
        updatedAtUtc: council.updatedAtUtc,
      });
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }
      return okAsync(undefined);
    },
    persistCouncilDeletion: (councilId) => {
      const result = persistence.deleteCouncil(councilId);
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }
      return okAsync(undefined);
    },
    loadCouncilMessages: (councilId) => {
      const result = persistence.loadCouncilMessages(councilId);
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }

      return okAsync(
        result.value.map((message) => ({
          id: message.id,
          councilId: asCouncilId(message.councilId),
          sequenceNumber: message.sequenceNumber,
          senderKind: message.senderKind,
          senderAgentId: message.senderAgentId === null ? null : asAgentId(message.senderAgentId),
          senderName: message.senderName,
          senderColor: message.senderColor,
          content: message.content,
          createdAtUtc: message.createdAtUtc,
        })),
      );
    },
    appendCouncilMessage: (message) => {
      const result = persistence.appendCouncilMessage({
        id: message.id,
        councilId: message.councilId,
        senderKind: message.senderKind,
        senderAgentId: message.senderAgentId,
        senderName: message.senderName,
        senderColor: message.senderColor,
        content: message.content,
        createdAtUtc: message.createdAtUtc,
      });

      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }

      return okAsync({
        id: result.value.id,
        councilId: asCouncilId(result.value.councilId),
        sequenceNumber: result.value.sequenceNumber,
        senderKind: result.value.senderKind,
        senderAgentId:
          result.value.senderAgentId === null ? null : asAgentId(result.value.senderAgentId),
        senderName: result.value.senderName,
        senderColor: result.value.senderColor,
        content: result.value.content,
        createdAtUtc: result.value.createdAtUtc,
      });
    },
    loadCouncilRuntimeBriefing: (councilId) => {
      const result = persistence.loadCouncilRuntimeBriefing(councilId);
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }
      if (result.value === null) {
        return okAsync(null);
      }

      return okAsync({
        councilId: asCouncilId(result.value.councilId),
        briefing: result.value.briefing,
        goalReached: result.value.goalReached,
        updatedAtUtc: result.value.updatedAtUtc,
      });
    },
    persistCouncilRuntimeBriefing: (briefing) => {
      const result = persistence.saveCouncilRuntimeBriefing({
        councilId: briefing.councilId,
        briefing: briefing.briefing,
        goalReached: briefing.goalReached,
        updatedAtUtc: briefing.updatedAtUtc,
      });
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }
      return okAsync(undefined);
    },
    aiService,
    createMessageId: () => randomUUID(),
    createGenerationRequestId: () => randomUUID(),
    getContextLastN: () => settingsSlice.getContextLastN(),
    exportService,
  });
  const agentsSlice = createAgentsSlice({
    nowUtc: () => new Date().toISOString(),
    createAgentId: () => asAgentId(randomUUID()),
    pageSize: HOME_LIST_PAGE_SIZE,
    getModelContext: ({ webContentsId, viewKind }) =>
      settingsSlice
        .getSettingsView({
          webContentsId,
          viewKind,
        })
        .map((view) => ({
          modelCatalog: view.modelCatalog,
          globalDefaultModelRef: view.globalDefaultModelRef,
          canRefreshModels: view.canRefreshModels,
        })),
    refreshModelCatalog: ({ webContentsId, viewKind }) =>
      settingsSlice.refreshModelCatalog({
        webContentsId,
        viewKind,
      }),
    loadPersistedAgents: () => {
      const result = persistence.loadAgents();
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }

      return okAsync(
        result.value.map((agent) => ({
          id: asAgentId(agent.id),
          name: agent.name,
          systemPrompt: agent.systemPrompt,
          verbosity: agent.verbosity,
          temperature: agent.temperature,
          tags: agent.tags.flatMap((tag) => {
            const parsed = createTag(tag);
            return parsed.isOk() ? [parsed.value] : [];
          }),
          modelRefOrNull: agent.modelRefOrNull,
          archivedAtUtc: agent.archivedAtUtc,
          createdAtUtc: agent.createdAtUtc,
          updatedAtUtc: agent.updatedAtUtc,
        })),
      );
    },
    persistAgent: (agent) => {
      const result = persistence.saveAgent({
        id: agent.id,
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        verbosity: agent.verbosity,
        temperature: agent.temperature,
        tags: agent.tags,
        modelRefOrNull: agent.modelRefOrNull,
        archivedAtUtc: agent.archivedAtUtc,
        createdAtUtc: agent.createdAtUtc,
        updatedAtUtc: agent.updatedAtUtc,
      });
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }
      return okAsync(undefined);
    },
    persistAgentDeletion: (agentId) => {
      const result = persistence.deleteAgent(agentId);
      if (result.isErr()) {
        return errAsync(toDomainPersistenceError(result.error.message));
      }
      return okAsync(undefined);
    },
    canDeleteAgent: (agentId) =>
      councilsSlice.countCouncilsUsingAgent(agentId).map((count) => count === 0),
  });
  const settingsHandlers = createSettingsIpcHandlers(settingsSlice);
  const assistantSlice = createAssistantSlice({
    nowUtc: () => new Date().toISOString(),
    createSessionId: () => randomUUID(),
    getSettingsView: ({ webContentsId, viewKind }) =>
      settingsSlice.getSettingsView({
        webContentsId,
        viewKind,
      }),
    auditService: assistantAuditService,
    listAgents: (params) => agentsSlice.listAgents(params),
    getAgentEditorView: (params) => agentsSlice.getEditorView(params),
    listCouncils: (params) => councilsSlice.listCouncils(params),
    getCouncilEditorView: (params) => councilsSlice.getEditorView(params),
    getCouncilView: (params) => councilsSlice.getCouncilView(params),
    planAssistantResponse: (request, abortSignal) =>
      aiService
        .generateText(
          {
            providerId: request.modelRef.providerId,
            modelId: request.modelRef.modelId,
            messages: [
              {
                role: "system",
                content:
                  "You are the Council desktop assistant planner. Reply with exactly one JSON object that matches the provided assistant planning schema. Use only the provided tools, preserve call ids, and prefer clarify over guessing when the request is underspecified.",
              },
              {
                role: "user",
                content: request.prompt,
              },
            ],
            temperature: 0,
          },
          abortSignal,
        )
        .map((response) => response.text)
        .mapErr((error) =>
          domainError(
            "ProviderError",
            `Assistant planner request failed for ${error.providerId}:${error.modelId}: ${error.message}`,
            "Assistant planning could not complete safely.",
          ),
        ),
  });
  const assistantHandlers = createAssistantIpcHandlers(assistantSlice);
  const agentsHandlers = createAgentsIpcHandlers(agentsSlice);
  const councilsHandlers = createCouncilsIpcHandlers(councilsSlice);

  ipcMain.handle("health:ping", async (_event, payload): Promise<IpcResult<HealthPingResponse>> => {
    const parsed = HEALTH_PING_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure(parsed.error.message);
    }

    return {
      ok: true,
      value: {
        pong: `pong:${parsed.data.message}`,
        timestampUtc: new Date().toISOString(),
      },
    };
  });

  ipcMain.handle("settings:get-view", async (event, payload) =>
    settingsHandlers.getSettingsView(payload, event.sender.id),
  );
  ipcMain.handle("providers:test-connection", async (_event, payload) =>
    settingsHandlers.testProviderConnection(payload),
  );
  ipcMain.handle("providers:save-config", async (event, payload) =>
    settingsHandlers.saveProviderConfig(payload, event.sender.id),
  );
  ipcMain.handle("providers:disconnect", async (event, payload) =>
    settingsHandlers.disconnectProvider(payload, event.sender.id),
  );
  ipcMain.handle("providers:refresh-model-catalog", async (event, payload) =>
    settingsHandlers.refreshModelCatalog(payload, event.sender.id),
  );
  ipcMain.handle("settings:set-global-default-model", async (event, payload) =>
    settingsHandlers.setGlobalDefaultModel(payload, event.sender.id),
  );
  ipcMain.handle("settings:set-context-last-n", async (event, payload) =>
    settingsHandlers.setContextLastN(payload, event.sender.id),
  );
  ipcMain.handle("agents:list", async (event, payload) =>
    agentsHandlers.listAgents(payload, event.sender.id),
  );
  ipcMain.handle("agents:get-editor-view", async (event, payload) =>
    agentsHandlers.getEditorView(payload, event.sender.id),
  );
  ipcMain.handle("agents:save", async (event, payload) =>
    agentsHandlers.saveAgent(payload, event.sender.id),
  );
  ipcMain.handle("agents:delete", async (_event, payload) => agentsHandlers.deleteAgent(payload));
  ipcMain.handle("agents:set-archived", async (event, payload) =>
    agentsHandlers.setArchived(payload, event.sender.id),
  );
  ipcMain.handle("agents:refresh-model-catalog", async (event, payload) =>
    agentsHandlers.refreshModelCatalog(payload, event.sender.id),
  );
  ipcMain.handle("councils:list", async (event, payload) =>
    councilsHandlers.listCouncils(payload, event.sender.id),
  );
  ipcMain.handle("councils:get-editor-view", async (event, payload) =>
    councilsHandlers.getEditorView(payload, event.sender.id),
  );
  ipcMain.handle("councils:get-view", async (event, payload) =>
    councilsHandlers.getCouncilView(payload, event.sender.id),
  );
  ipcMain.handle("councils:save", async (event, payload) =>
    councilsHandlers.saveCouncil(payload, event.sender.id),
  );
  ipcMain.handle("councils:delete", async (_event, payload) =>
    councilsHandlers.deleteCouncil(payload),
  );
  ipcMain.handle("councils:set-archived", async (event, payload) =>
    councilsHandlers.setArchived(payload, event.sender.id),
  );
  ipcMain.handle("councils:start", async (event, payload) =>
    councilsHandlers.startCouncil(payload, event.sender.id),
  );
  ipcMain.handle("councils:pause-autopilot", async (event, payload) =>
    councilsHandlers.pauseCouncilAutopilot(payload, event.sender.id),
  );
  ipcMain.handle("councils:resume-autopilot", async (event, payload) =>
    councilsHandlers.resumeCouncilAutopilot(payload, event.sender.id),
  );
  ipcMain.handle("councils:generate-manual-turn", async (event, payload) =>
    councilsHandlers.generateManualTurn(payload, event.sender.id),
  );
  ipcMain.handle("councils:inject-conductor-message", async (event, payload) =>
    councilsHandlers.injectConductorMessage(payload, event.sender.id),
  );
  ipcMain.handle("councils:advance-autopilot-turn", async (event, payload) =>
    councilsHandlers.advanceAutopilotTurn(payload, event.sender.id),
  );
  ipcMain.handle("councils:cancel-generation", async (_event, payload) =>
    councilsHandlers.cancelGeneration(payload),
  );
  ipcMain.handle("councils:export-transcript", async (event, payload) =>
    councilsHandlers.exportTranscript(payload, event.sender.id),
  );
  ipcMain.handle("councils:refresh-model-catalog", async (event, payload) =>
    councilsHandlers.refreshModelCatalog(payload, event.sender.id),
  );
  ipcMain.handle("assistant:create-session", async (event, payload) =>
    assistantHandlers.createSession(payload, event.sender.id),
  );
  ipcMain.handle("assistant:submit", async (event, payload) =>
    assistantHandlers.submit(payload, event.sender.id),
  );
  ipcMain.handle("assistant:cancel-session", async (event, payload) =>
    assistantHandlers.cancelSession(payload, event.sender.id),
  );
  ipcMain.handle("assistant:close-session", async (event, payload) =>
    assistantHandlers.closeSession(payload, event.sender.id),
  );
  ipcMain.handle("assistant:complete-reconciliation", async (event, payload) =>
    assistantHandlers.completeReconciliation(payload, event.sender.id),
  );

  return {
    releaseWebContentsResources: (webContentsId: number): void => {
      settingsSlice.releaseViewSnapshots(webContentsId);
      assistantSlice.releaseWebContentsSessions(webContentsId);
    },
  };
};
