import { type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AssistantPlanResult } from "../shared/ipc/dto.js";
import { ConfirmDialog } from "./ConfirmDialog";
import { AgentEditorScreen } from "./components/agents/AgentEditorScreen";
import { AssistantLauncher } from "./components/assistant/AssistantLauncher";
import { AssistantModal } from "./components/assistant/AssistantModal";
import {
  type AssistantAgentEditorSnapshot,
  type AssistantCouncilEditorSnapshot,
  type AssistantCouncilViewSnapshot,
  type AssistantHomeViewSnapshot,
  buildAssistantAgentEditorContext,
  buildAssistantCouncilEditorContext,
  buildAssistantCouncilViewContext,
  buildAssistantExecutionSnapshot,
  buildAssistantHomeContext,
} from "./components/assistant/assistant-context-builders";
import type {
  AssistantAgentDraftAdapter,
  AssistantAgentDraftPatch,
  AssistantAgentSaveAdapter,
  AssistantCouncilDraftAdapter,
  AssistantCouncilDraftPatch,
  AssistantCouncilSaveAdapter,
} from "./components/assistant/assistant-draft-adapters";
import {
  matchesAgentDraftPatch,
  matchesCouncilDraftPatch,
  matchesSavedAgentFields,
  matchesSavedCouncilFields,
  readSavedAgentFields,
  readSavedCouncilFields,
} from "./components/assistant/assistant-reconciliation-helpers";
import { resolveAssistantScopeKey } from "./components/assistant/assistant-scope";
import { createAssistantShellController } from "./components/assistant/assistant-shell-controller";
import {
  type AssistantUiState,
  closeAssistantUi,
  createInitialAssistantUiState,
  markAssistantPendingSessionRebase,
  openAssistantForScope,
  rebaseAssistantForScopeChange,
  requiresAssistantCloseConfirmation,
} from "./components/assistant/assistant-ui-state";
import { CouncilViewScreen } from "./components/council-view/CouncilViewScreen";
import { CouncilEditorScreen } from "./components/councils/CouncilEditorScreen";
import { HomeScreen } from "./components/home/HomeScreen";
import type { HomeTab } from "./components/navigation/HomeTopBar";
import { useToastQueue } from "./use-toast-queue";

type ScreenState =
  | { kind: "home" }
  | { kind: "agentEditor"; agentId: string | null }
  | { kind: "councilEditor"; councilId: string | null }
  | { kind: "councilView"; councilId: string };

export const App = (): JSX.Element => {
  const [homeTab, setHomeTab] = useState<HomeTab>("councils");
  const [screen, setScreen] = useState<ScreenState>({ kind: "home" });
  const [assistantState, setAssistantState] = useState(createInitialAssistantUiState);
  const [homeAssistantSnapshot, setHomeAssistantSnapshot] = useState<AssistantHomeViewSnapshot>({
    activeTab: "councils",
    agents: {
      appliedFilters: {
        archivedFilter: "all",
        searchText: "",
        sortBy: "updatedAt",
        sortDirection: "desc",
        tagFilter: "",
      },
      hasPendingChanges: false,
      total: 0,
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
      total: 0,
    },
  });
  const [agentAssistantSnapshot, setAgentAssistantSnapshot] =
    useState<AssistantAgentEditorSnapshot | null>(null);
  const [councilAssistantSnapshot, setCouncilAssistantSnapshot] =
    useState<AssistantCouncilEditorSnapshot | null>(null);
  const [councilViewAssistantSnapshot, setCouncilViewAssistantSnapshot] =
    useState<AssistantCouncilViewSnapshot | null>(null);
  const [assistantPendingExportReconciliation, setAssistantPendingExportReconciliation] = useState<{
    callId: string;
    councilId: string;
    status: "exported" | "cancelled";
  } | null>(null);
  const [assistantCouncilViewReloadToken, setAssistantCouncilViewReloadToken] = useState(0);
  const assistantInputRef = useRef<HTMLTextAreaElement>(null);
  const assistantStateRef = useRef(assistantState);
  const screenRef = useRef(screen);
  const homeTabRef = useRef(homeTab);
  const homeAssistantSnapshotRef = useRef(homeAssistantSnapshot);
  const agentAssistantSnapshotRef = useRef(agentAssistantSnapshot);
  const councilAssistantSnapshotRef = useRef(councilAssistantSnapshot);
  const councilViewAssistantSnapshotRef = useRef(councilViewAssistantSnapshot);
  const activeAssistantScopeKeyRef = useRef<string | null>(null);
  const lastAssistantLauncherRef = useRef<HTMLButtonElement | null>(null);
  const agentDraftAdapterRef = useRef<AssistantAgentDraftAdapter | null>(null);
  const agentSaveAdapterRef = useRef<AssistantAgentSaveAdapter | null>(null);
  const councilDraftAdapterRef = useRef<AssistantCouncilDraftAdapter | null>(null);
  const councilSaveAdapterRef = useRef<AssistantCouncilSaveAdapter | null>(null);
  const homeTabAtDetailOpenRef = useRef<HomeTab>("councils");
  const { pushToast } = useToastQueue();

  screenRef.current = screen;
  homeTabRef.current = homeTab;
  homeAssistantSnapshotRef.current = homeAssistantSnapshot;
  agentAssistantSnapshotRef.current = agentAssistantSnapshot;
  councilAssistantSnapshotRef.current = councilAssistantSnapshot;
  councilViewAssistantSnapshotRef.current = councilViewAssistantSnapshot;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const root = document.documentElement;

    const applyTheme = (isDark: boolean): void => {
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    };

    applyTheme(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent): void => {
      applyTheme(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const openAgentEditor = useCallback(
    (agentId: string | null): void => {
      if (screen.kind === "home") {
        homeTabAtDetailOpenRef.current = homeTab;
      }
      setScreen({ kind: "agentEditor", agentId });
    },
    [homeTab, screen.kind],
  );

  const openCouncilEditor = useCallback(
    (councilId: string | null): void => {
      if (screen.kind === "home") {
        homeTabAtDetailOpenRef.current = homeTab;
      }
      setScreen({ kind: "councilEditor", councilId });
    },
    [homeTab, screen.kind],
  );

  const openCouncilView = useCallback(
    (councilId: string): void => {
      if (screen.kind === "home") {
        homeTabAtDetailOpenRef.current = homeTab;
      }
      setScreen({ kind: "councilView", councilId });
    },
    [homeTab, screen.kind],
  );

  const closeToHome = (nextTab?: HomeTab): void => {
    setScreen({ kind: "home" });
    setHomeTab(nextTab ?? homeTabAtDetailOpenRef.current);
  };

  const activeAssistantContext = useMemo(() => {
    switch (screen.kind) {
      case "home":
        return buildAssistantHomeContext({
          ...homeAssistantSnapshot,
          activeTab: homeTab,
        });
      case "agentEditor":
        return buildAssistantAgentEditorContext(
          agentAssistantSnapshot ?? {
            archived: false,
            draft: {
              id: screen.agentId,
              modelSelection: "",
              name: "",
              systemPrompt: "",
              tagsInput: "",
              temperature: "",
              verbosity: "",
            },
            initialDraft: {
              id: screen.agentId,
              modelSelection: "",
              name: "",
              systemPrompt: "",
              tagsInput: "",
              temperature: "",
              verbosity: "",
            },
          },
        );
      case "councilEditor":
        return buildAssistantCouncilEditorContext(
          councilAssistantSnapshot ?? {
            archived: false,
            draft: {
              conductorModelSelection: "",
              goal: "",
              id: screen.councilId,
              mode: "manual",
              selectedMemberIds: [],
              tagsInput: "",
              title: "",
              topic: "",
            },
            initialDraft: {
              conductorModelSelection: "",
              goal: "",
              id: screen.councilId,
              mode: "manual",
              selectedMemberIds: [],
              tagsInput: "",
              title: "",
              topic: "",
            },
          },
        );
      case "councilView":
        return buildAssistantCouncilViewContext(
          councilViewAssistantSnapshot ?? {
            activeTab: "overview",
            assistantExportReconciliation: null,
            archived: false,
            autopilotMaxTurns: null,
            autopilotTurnsCompleted: 0,
            councilId: screen.councilId,
            generationStatus: "idle",
            hasBriefing: false,
            invalidConfig: false,
            memberCount: 0,
            messageCount: 0,
            mode: "manual",
            paused: false,
            plannedNextSpeakerAgentId: null,
            runtimeLeaseId: null,
            started: false,
            title: "Council",
            turnCount: 0,
          },
        );
    }
  }, [
    agentAssistantSnapshot,
    councilAssistantSnapshot,
    councilViewAssistantSnapshot,
    homeAssistantSnapshot,
    homeTab,
    screen,
  ]);

  const activeAssistantScopeKey = useMemo(
    () => resolveAssistantScopeKey({ homeTab, screen }),
    [homeTab, screen],
  );

  const activeAssistantContextRef = useRef(activeAssistantContext);
  activeAssistantContextRef.current = activeAssistantContext;
  activeAssistantScopeKeyRef.current = activeAssistantScopeKey;

  const getAssistantStateForScope = useCallback(
    (state: AssistantUiState, scopeKey: string): AssistantUiState =>
      rebaseAssistantForScopeChange({ scopeKey, state }),
    [],
  );

  const getCurrentAssistantState = useCallback(
    (): AssistantUiState =>
      getAssistantStateForScope(
        assistantStateRef.current,
        activeAssistantScopeKeyRef.current ?? activeAssistantScopeKey,
      ),
    [activeAssistantScopeKey, getAssistantStateForScope],
  );

  const getStoredAssistantState = useCallback(
    (): AssistantUiState => assistantStateRef.current,
    [],
  );

  const getActiveAssistantContext = useCallback(() => activeAssistantContextRef.current, []);

  const getActiveAssistantExecutionSnapshot = useCallback(
    () =>
      buildAssistantExecutionSnapshot({
        agentEditorSnapshot: agentAssistantSnapshotRef.current,
        councilEditorSnapshot: councilAssistantSnapshotRef.current,
        viewKind: activeAssistantContextRef.current.viewKind,
      }),
    [],
  );

  const getActiveAssistantScope = useCallback(
    (): string => activeAssistantScopeKeyRef.current ?? activeAssistantScopeKey,
    [activeAssistantScopeKey],
  );

  const updateAssistantState = useCallback(
    (action: SetStateAction<AssistantUiState>): AssistantUiState => {
      const currentState = getCurrentAssistantState();
      const nextState =
        typeof action === "function"
          ? (action as (current: AssistantUiState) => AssistantUiState)(currentState)
          : action;

      assistantStateRef.current = nextState;
      setAssistantState(nextState);
      return nextState;
    },
    [getCurrentAssistantState],
  );

  const renderedAssistantState = useMemo(
    () => getAssistantStateForScope(assistantState, activeAssistantScopeKey),
    [activeAssistantScopeKey, assistantState, getAssistantStateForScope],
  );

  const isFocusableElementVisible = useCallback((element: HTMLElement): boolean => {
    if (!element.isConnected) {
      return false;
    }

    if (element.closest("[hidden]") !== null) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );
  }, []);

  const resolveAssistantFocusTarget = useCallback((): HTMLElement | null => {
    const lastLauncher = lastAssistantLauncherRef.current;
    if (lastLauncher !== null && isFocusableElementVisible(lastLauncher)) {
      return lastLauncher;
    }

    const visibleLauncher = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[data-assistant-launcher='true']"),
    ).find((button) => isFocusableElementVisible(button));

    if (visibleLauncher !== undefined) {
      return visibleLauncher;
    }

    const safeFallback = document.querySelector<HTMLElement>(
      "main button:not([disabled]), main a[href], main input:not([disabled]), main textarea:not([disabled]), main [tabindex]:not([tabindex='-1'])",
    );

    return safeFallback !== null && isFocusableElementVisible(safeFallback) ? safeFallback : null;
  }, [isFocusableElementVisible]);

  const restoreLauncherFocus = useCallback((): void => {
    queueMicrotask(() => {
      resolveAssistantFocusTarget()?.focus();
    });
  }, [resolveAssistantFocusTarget]);

  const waitForAssistantUi = useCallback(
    async (predicate: () => boolean, timeoutMs = 5_000): Promise<boolean> => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (predicate()) {
          return true;
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      return predicate();
    },
    [],
  );

  const applyAssistantPlanResultEffects = useCallback(
    async (result: AssistantPlanResult) => {
      if (result.kind !== "result") {
        return [];
      }

      const reconciliations: Array<{
        callId: string;
        toolName: string;
        status: "completed" | "failed";
        failureMessage: string | null;
        completion: {
          output: Readonly<Record<string, unknown>> | null;
          userSummary: string | null;
        } | null;
      }> = [];

      const markPendingNavigationRebase = (params: {
        destinationScopeKey: string;
        destinationViewKind:
          | "agentEdit"
          | "agentsList"
          | "councilCreate"
          | "councilView"
          | "councilsList"
          | "settings";
      }): void => {
        updateAssistantState((current) => ({
          ...markAssistantPendingSessionRebase({
            destinationScopeKey: params.destinationScopeKey,
            destinationViewKind: params.destinationViewKind,
            sessionId: result.sessionId,
            state: current,
          }),
        }));
      };

      const reconcileRuntimeView = async (params: {
        callId: string;
        expectedCouncilId: string;
        expectedGenerationStatus?: "idle" | "running";
        expectedMessageCount: number;
        expectedRuntimeStatus: "idle" | "running" | "paused";
        expectedTurnCount: number;
        toolName: string;
      }): Promise<void> => {
        setAssistantCouncilViewReloadToken((current) => current + 1);
        const ready = await waitForAssistantUi(() => {
          const snapshot = councilViewAssistantSnapshotRef.current;
          return (
            screenRef.current.kind === "councilView" &&
            screenRef.current.councilId === params.expectedCouncilId &&
            snapshot !== null &&
            snapshot.councilId === params.expectedCouncilId &&
            snapshot.messageCount >= params.expectedMessageCount &&
            snapshot.turnCount >= params.expectedTurnCount &&
            (params.expectedGenerationStatus === undefined ||
              snapshot.generationStatus === params.expectedGenerationStatus) &&
            (params.expectedRuntimeStatus === "running"
              ? snapshot.started && !snapshot.paused
              : params.expectedRuntimeStatus === "paused"
                ? snapshot.started && snapshot.paused
                : !snapshot.started)
          );
        }, 10_000);

        reconciliations.push({
          callId: params.callId,
          completion: null,
          toolName: params.toolName,
          status: ready ? "completed" : "failed",
          failureMessage: ready
            ? null
            : "The active council runtime view did not reflect the assistant runtime action.",
        });
      };

      const ensureHomeTabVisible = async (tab: HomeTab): Promise<boolean> => {
        setScreen({ kind: "home" });
        setHomeTab(tab);
        return waitForAssistantUi(
          () => screenRef.current.kind === "home" && homeTabRef.current === tab,
          10_000,
        );
      };

      const parseListQuery = (
        output: Readonly<Record<string, unknown>>,
      ): {
        archivedFilter: "active" | "archived" | "all";
        searchText: string;
        sortBy: "createdAt" | "updatedAt";
        sortDirection: "asc" | "desc";
        tagFilter: string;
      } | null => {
        const query = output.listQuery;
        if (typeof query !== "object" || query === null) {
          return null;
        }

        const record = query as Record<string, unknown>;
        if (
          (record.archivedFilter !== "active" &&
            record.archivedFilter !== "archived" &&
            record.archivedFilter !== "all") ||
          typeof record.searchText !== "string" ||
          (record.sortBy !== "createdAt" && record.sortBy !== "updatedAt") ||
          (record.sortDirection !== "asc" && record.sortDirection !== "desc") ||
          typeof record.tagFilter !== "string"
        ) {
          return null;
        }

        return {
          archivedFilter: record.archivedFilter,
          searchText: record.searchText,
          sortBy: record.sortBy,
          sortDirection: record.sortDirection,
          tagFilter: record.tagFilter,
        };
      };

      const reconcileAgentsListMutation = async (params: {
        callId: string;
        output: Readonly<Record<string, unknown>>;
        toolName: string;
      }): Promise<void> => {
        const listQuery = parseListQuery(params.output);
        const expectedVisibleTotal = params.output.visibleTotal;
        if (listQuery === null || typeof expectedVisibleTotal !== "number") {
          reconciliations.push({
            callId: params.callId,
            completion: null,
            toolName: params.toolName,
            status: "failed",
            failureMessage: "Agent list reconciliation payload was invalid.",
          });
          return;
        }

        const homeReady = await ensureHomeTabVisible("agents");
        if (!homeReady) {
          reconciliations.push({
            callId: params.callId,
            completion: null,
            toolName: params.toolName,
            status: "failed",
            failureMessage: "Agents list did not become visible for reconciliation.",
          });
          return;
        }

        const listResult = await window.api.agents.list({
          viewKind: "agentsList",
          page: 1,
          ...listQuery,
        });
        const ready =
          listResult.ok &&
          listResult.value.total === expectedVisibleTotal &&
          (await waitForAssistantUi(
            () =>
              homeTabRef.current === "agents" &&
              homeAssistantSnapshotRef.current.agents.total === expectedVisibleTotal,
            10_000,
          ));
        reconciliations.push({
          callId: params.callId,
          completion: null,
          toolName: params.toolName,
          status: ready ? "completed" : "failed",
          failureMessage: ready
            ? null
            : "Visible agents list did not reconcile to the expected filtered state.",
        });
      };

      const reconcileCouncilsListMutation = async (params: {
        callId: string;
        output: Readonly<Record<string, unknown>>;
        toolName: string;
      }): Promise<void> => {
        const listQuery = parseListQuery(params.output);
        const expectedVisibleTotal = params.output.visibleTotal;
        if (listQuery === null || typeof expectedVisibleTotal !== "number") {
          reconciliations.push({
            callId: params.callId,
            completion: null,
            toolName: params.toolName,
            status: "failed",
            failureMessage: "Council list reconciliation payload was invalid.",
          });
          return;
        }

        const homeReady = await ensureHomeTabVisible("councils");
        if (!homeReady) {
          reconciliations.push({
            callId: params.callId,
            completion: null,
            toolName: params.toolName,
            status: "failed",
            failureMessage: "Councils list did not become visible for reconciliation.",
          });
          return;
        }

        const listResult = await window.api.councils.list({
          viewKind: "councilsList",
          page: 1,
          ...listQuery,
        });
        const ready =
          listResult.ok &&
          listResult.value.total === expectedVisibleTotal &&
          (await waitForAssistantUi(
            () =>
              homeTabRef.current === "councils" &&
              homeAssistantSnapshotRef.current.councils.total === expectedVisibleTotal,
            10_000,
          ));
        reconciliations.push({
          callId: params.callId,
          completion: null,
          toolName: params.toolName,
          status: ready ? "completed" : "failed",
          failureMessage: ready
            ? null
            : "Visible councils list did not reconcile to the expected filtered state.",
        });
      };

      const reconcileSettingsView = async (params: {
        callId: string;
        output: Readonly<Record<string, unknown>>;
        toolName: string;
      }): Promise<void> => {
        const homeReady = await ensureHomeTabVisible("settings");
        if (!homeReady) {
          reconciliations.push({
            callId: params.callId,
            completion: null,
            toolName: params.toolName,
            status: "failed",
            failureMessage: "Settings view did not become visible for reconciliation.",
          });
          return;
        }

        const settingsResult = await window.api.settings.getView({ viewKind: "settings" });
        if (!settingsResult.ok) {
          reconciliations.push({
            callId: params.callId,
            completion: null,
            toolName: params.toolName,
            status: "failed",
            failureMessage: settingsResult.error.userMessage,
          });
          return;
        }

        let ready = false;
        switch (params.toolName) {
          case "disconnectProvider": {
            const providerId = params.output.providerId;
            const hasCredential = params.output.hasCredential;
            ready =
              typeof providerId === "string" &&
              typeof hasCredential === "boolean" &&
              settingsResult.value.providers.some(
                (provider) =>
                  provider.providerId === providerId && provider.hasCredential === hasCredential,
              );
            break;
          }
          case "saveProviderConfig": {
            const providerId = params.output.providerId;
            const hasCredential = params.output.hasCredential;
            const endpointUrlConfigured = params.output.endpointUrlConfigured;
            ready =
              typeof providerId === "string" &&
              typeof hasCredential === "boolean" &&
              typeof endpointUrlConfigured === "boolean" &&
              settingsResult.value.providers.some(
                (provider) =>
                  provider.providerId === providerId &&
                  provider.hasCredential === hasCredential &&
                  (provider.endpointUrl !== null) === endpointUrlConfigured,
              );
            break;
          }
          case "setGlobalDefaultModel": {
            const modelRefOrNull = params.output.globalDefaultModelRef;
            ready =
              (modelRefOrNull === null && settingsResult.value.globalDefaultModelRef === null) ||
              (typeof modelRefOrNull === "object" &&
                modelRefOrNull !== null &&
                "providerId" in modelRefOrNull &&
                "modelId" in modelRefOrNull &&
                settingsResult.value.globalDefaultModelRef?.providerId ===
                  modelRefOrNull.providerId &&
                settingsResult.value.globalDefaultModelRef?.modelId === modelRefOrNull.modelId);
            break;
          }
          case "refreshModelCatalog": {
            ready =
              typeof params.output.snapshotId === "string" &&
              settingsResult.value.modelCatalog.snapshotId === params.output.snapshotId;
            break;
          }
          default:
            ready = false;
        }

        reconciliations.push({
          callId: params.callId,
          completion: null,
          toolName: params.toolName,
          status: ready ? "completed" : "failed",
          failureMessage: ready
            ? null
            : "Settings changes were not visible after assistant execution.",
        });
      };

      for (const executionResult of result.executionResults) {
        if (executionResult.status !== "reconciling") {
          continue;
        }

        switch (executionResult.toolName) {
          case "navigateToHomeTab": {
            const nextTab =
              executionResult.output.tab === "agentsList"
                ? "agents"
                : executionResult.output.tab === "councilsList"
                  ? "councils"
                  : "settings";
            markPendingNavigationRebase({
              destinationScopeKey: `home:${nextTab}`,
              destinationViewKind:
                nextTab === "agents"
                  ? "agentsList"
                  : nextTab === "councils"
                    ? "councilsList"
                    : "settings",
            });
            setScreen({ kind: "home" });
            setHomeTab(nextTab);
            const ready = await waitForAssistantUi(
              () => screenRef.current.kind === "home" && homeTabRef.current === nextTab,
            );
            reconciliations.push({
              callId: executionResult.callId,
              completion: null,
              toolName: executionResult.toolName,
              status: ready ? "completed" : "failed",
              failureMessage: ready ? null : "The requested Home tab never became visible.",
            });
            break;
          }
          case "openAgentEditor": {
            const agentId = executionResult.output.agentId;
            if (typeof agentId !== "string") {
              reconciliations.push({
                callId: executionResult.callId,
                completion: null,
                toolName: executionResult.toolName,
                status: "failed",
                failureMessage: "The requested agent editor could not be opened safely.",
              });
              break;
            }

            markPendingNavigationRebase({
              destinationScopeKey: `agentEditor:${agentId}`,
              destinationViewKind: "agentEdit",
            });
            openAgentEditor(agentId);
            const ready = await waitForAssistantUi(
              () =>
                screenRef.current.kind === "agentEditor" &&
                screenRef.current.agentId === agentId &&
                agentAssistantSnapshotRef.current?.draft.id === agentId,
            );
            reconciliations.push({
              callId: executionResult.callId,
              completion: null,
              toolName: executionResult.toolName,
              status: ready ? "completed" : "failed",
              failureMessage: ready ? null : "The requested agent editor never became visible.",
            });
            break;
          }
          case "openCouncilEditor": {
            const councilId = executionResult.output.councilId;
            if (typeof councilId !== "string") {
              reconciliations.push({
                callId: executionResult.callId,
                completion: null,
                toolName: executionResult.toolName,
                status: "failed",
                failureMessage: "The requested council editor could not be opened safely.",
              });
              break;
            }

            markPendingNavigationRebase({
              destinationScopeKey: `councilEditor:${councilId}`,
              destinationViewKind: "councilCreate",
            });
            openCouncilEditor(councilId);
            const ready = await waitForAssistantUi(
              () =>
                screenRef.current.kind === "councilEditor" &&
                screenRef.current.councilId === councilId &&
                councilAssistantSnapshotRef.current?.draft.id === councilId,
            );
            reconciliations.push({
              callId: executionResult.callId,
              completion: null,
              toolName: executionResult.toolName,
              status: ready ? "completed" : "failed",
              failureMessage: ready ? null : "The requested council editor never became visible.",
            });
            break;
          }
          case "openCouncilView": {
            const councilId = executionResult.output.councilId;
            if (typeof councilId !== "string") {
              reconciliations.push({
                callId: executionResult.callId,
                completion: null,
                toolName: executionResult.toolName,
                status: "failed",
                failureMessage: "The requested council view could not be opened safely.",
              });
              break;
            }

            markPendingNavigationRebase({
              destinationScopeKey: `councilView:${councilId}`,
              destinationViewKind: "councilView",
            });
            openCouncilView(councilId);
            const ready = await waitForAssistantUi(
              () =>
                screenRef.current.kind === "councilView" &&
                screenRef.current.councilId === councilId &&
                councilViewAssistantSnapshotRef.current?.councilId === councilId,
            );
            reconciliations.push({
              callId: executionResult.callId,
              completion: null,
              toolName: executionResult.toolName,
              status: ready ? "completed" : "failed",
              failureMessage: ready ? null : "The requested council view never became visible.",
            });
            break;
          }
          case "saveAgentDraft": {
            const agentId = executionResult.output.agentId;
            const savedFields = readSavedAgentFields(executionResult.output);
            if (typeof agentId !== "string") {
              reconciliations.push({
                callId: executionResult.callId,
                completion: null,
                toolName: executionResult.toolName,
                status: "failed",
                failureMessage: "The current visible agent draft could not be reloaded safely.",
              });
              break;
            }

            const needsNavigation =
              screenRef.current.kind !== "agentEditor" || screenRef.current.agentId !== agentId;
            let applied = null;
            if (needsNavigation) {
              markPendingNavigationRebase({
                destinationScopeKey: `agentEditor:${agentId}`,
                destinationViewKind: "agentEdit",
              });
              openAgentEditor(agentId);
            } else {
              if (agentSaveAdapterRef.current === null) {
                reconciliations.push({
                  callId: executionResult.callId,
                  completion: null,
                  toolName: executionResult.toolName,
                  status: "failed",
                  failureMessage: "The current visible agent draft could not be refreshed safely.",
                });
                break;
              }

              applied = await agentSaveAdapterRef.current({ entityId: agentId });
            }

            const ready =
              (applied === null || applied.status === "completed") &&
              (await waitForAssistantUi(
                () =>
                  savedFields !== null &&
                  screenRef.current.kind === "agentEditor" &&
                  screenRef.current.agentId === agentId &&
                  agentAssistantSnapshotRef.current !== null &&
                  agentAssistantSnapshotRef.current.draft.id === agentId &&
                  matchesSavedAgentFields(agentAssistantSnapshotRef.current, savedFields) &&
                  buildAssistantAgentEditorContext(agentAssistantSnapshotRef.current).draftState
                    ?.dirty === false,
              ));
            reconciliations.push({
              callId: executionResult.callId,
              completion: null,
              toolName: executionResult.toolName,
              status: ready ? "completed" : "failed",
              failureMessage: ready
                ? null
                : (applied?.failureMessage ??
                  "The current visible agent draft never reflected the saved state."),
            });
            break;
          }
          case "saveCouncilDraft": {
            const councilId = executionResult.output.councilId;
            const savedFields = readSavedCouncilFields(executionResult.output);
            if (typeof councilId !== "string") {
              reconciliations.push({
                callId: executionResult.callId,
                completion: null,
                toolName: executionResult.toolName,
                status: "failed",
                failureMessage: "The current visible council draft could not be reloaded safely.",
              });
              break;
            }

            const needsNavigation =
              screenRef.current.kind !== "councilEditor" ||
              screenRef.current.councilId !== councilId;
            let applied = null;
            if (needsNavigation) {
              markPendingNavigationRebase({
                destinationScopeKey: `councilEditor:${councilId}`,
                destinationViewKind: "councilCreate",
              });
              openCouncilEditor(councilId);
            } else {
              if (councilSaveAdapterRef.current === null) {
                reconciliations.push({
                  callId: executionResult.callId,
                  completion: null,
                  toolName: executionResult.toolName,
                  status: "failed",
                  failureMessage:
                    "The current visible council draft could not be refreshed safely.",
                });
                break;
              }

              applied = await councilSaveAdapterRef.current({ entityId: councilId });
            }

            const ready =
              (applied === null || applied.status === "completed") &&
              (await waitForAssistantUi(
                () =>
                  savedFields !== null &&
                  screenRef.current.kind === "councilEditor" &&
                  screenRef.current.councilId === councilId &&
                  councilAssistantSnapshotRef.current !== null &&
                  councilAssistantSnapshotRef.current.draft.id === councilId &&
                  matchesSavedCouncilFields(councilAssistantSnapshotRef.current, savedFields) &&
                  buildAssistantCouncilEditorContext(councilAssistantSnapshotRef.current).draftState
                    ?.dirty === false,
              ));
            reconciliations.push({
              callId: executionResult.callId,
              completion: null,
              toolName: executionResult.toolName,
              status: ready ? "completed" : "failed",
              failureMessage: ready
                ? null
                : (applied?.failureMessage ??
                  "The current visible council draft never reflected the saved state."),
            });
            break;
          }
          case "createAgent":
          case "updateAgent": {
            const agentId = executionResult.output.agentId;
            const savedFields = readSavedAgentFields(executionResult.output);
            if (typeof agentId !== "string") {
              reconciliations.push({
                callId: executionResult.callId,
                completion: null,
                toolName: executionResult.toolName,
                status: "failed",
                failureMessage: "The requested agent change could not be opened safely.",
              });
              break;
            }

            markPendingNavigationRebase({
              destinationScopeKey: `agentEditor:${agentId}`,
              destinationViewKind: "agentEdit",
            });
            openAgentEditor(agentId);
            const ready = await waitForAssistantUi(
              () =>
                savedFields !== null &&
                screenRef.current.kind === "agentEditor" &&
                screenRef.current.agentId === agentId &&
                agentAssistantSnapshotRef.current?.draft.id === agentId &&
                matchesSavedAgentFields(agentAssistantSnapshotRef.current, savedFields) &&
                buildAssistantAgentEditorContext(agentAssistantSnapshotRef.current).draftState
                  ?.dirty === false,
            );
            reconciliations.push({
              callId: executionResult.callId,
              completion: null,
              toolName: executionResult.toolName,
              status: ready ? "completed" : "failed",
              failureMessage: ready ? null : "The updated agent never became visibly ready.",
            });
            break;
          }
          case "createCouncil":
          case "updateCouncilConfig": {
            const councilId = executionResult.output.councilId;
            const savedFields = readSavedCouncilFields(executionResult.output);
            if (typeof councilId !== "string") {
              reconciliations.push({
                callId: executionResult.callId,
                completion: null,
                toolName: executionResult.toolName,
                status: "failed",
                failureMessage: "The requested council change could not be opened safely.",
              });
              break;
            }

            markPendingNavigationRebase({
              destinationScopeKey: `councilEditor:${councilId}`,
              destinationViewKind: "councilCreate",
            });
            openCouncilEditor(councilId);
            const ready = await waitForAssistantUi(
              () =>
                savedFields !== null &&
                screenRef.current.kind === "councilEditor" &&
                screenRef.current.councilId === councilId &&
                councilAssistantSnapshotRef.current?.draft.id === councilId &&
                matchesSavedCouncilFields(councilAssistantSnapshotRef.current, savedFields) &&
                buildAssistantCouncilEditorContext(councilAssistantSnapshotRef.current).draftState
                  ?.dirty === false,
            );
            reconciliations.push({
              callId: executionResult.callId,
              completion: null,
              toolName: executionResult.toolName,
              status: ready ? "completed" : "failed",
              failureMessage: ready ? null : "The updated council never became visibly ready.",
            });
            break;
          }
          case "setAgentDraftFields": {
            const patch = executionResult.output.patch;
            if (
              agentDraftAdapterRef.current === null ||
              typeof patch !== "object" ||
              patch === null
            ) {
              reconciliations.push({
                callId: executionResult.callId,
                completion: null,
                toolName: executionResult.toolName,
                status: "failed",
                failureMessage: "The current visible agent draft could not be updated safely.",
              });
              break;
            }

            const applied = await agentDraftAdapterRef.current({
              entityId:
                typeof executionResult.output.entityId === "string"
                  ? executionResult.output.entityId
                  : null,
              patch: patch as AssistantAgentDraftPatch,
            });
            const ready =
              applied.status === "completed" &&
              (await waitForAssistantUi(() =>
                matchesAgentDraftPatch(
                  agentAssistantSnapshotRef.current,
                  patch as AssistantAgentDraftPatch,
                ),
              ));
            reconciliations.push({
              callId: executionResult.callId,
              completion: ready ? applied.completion : null,
              toolName: executionResult.toolName,
              status: ready ? "completed" : "failed",
              failureMessage: ready
                ? null
                : (applied.failureMessage ??
                  "The current visible agent draft never reflected the assistant changes."),
            });
            break;
          }
          case "setCouncilDraftFields": {
            const patch = executionResult.output.patch;
            if (
              councilDraftAdapterRef.current === null ||
              typeof patch !== "object" ||
              patch === null
            ) {
              reconciliations.push({
                callId: executionResult.callId,
                completion: null,
                toolName: executionResult.toolName,
                status: "failed",
                failureMessage: "The current visible council draft could not be updated safely.",
              });
              break;
            }

            const applied = await councilDraftAdapterRef.current({
              entityId:
                typeof executionResult.output.entityId === "string"
                  ? executionResult.output.entityId
                  : null,
              patch: patch as AssistantCouncilDraftPatch,
            });
            const ready =
              applied.status === "completed" &&
              (await waitForAssistantUi(() =>
                matchesCouncilDraftPatch(
                  councilAssistantSnapshotRef.current,
                  patch as AssistantCouncilDraftPatch,
                ),
              ));
            reconciliations.push({
              callId: executionResult.callId,
              completion: ready ? applied.completion : null,
              toolName: executionResult.toolName,
              status: ready ? "completed" : "failed",
              failureMessage: ready
                ? null
                : (applied.failureMessage ??
                  "The current visible council draft never reflected the assistant changes."),
            });
            break;
          }
          case "startCouncil":
          case "pauseCouncil":
          case "resumeCouncil":
          case "cancelCouncilGeneration":
          case "selectManualSpeaker":
          case "sendConductorMessage": {
            const councilId = executionResult.output.councilId;
            const runtimeStatus = executionResult.output.runtimeStatus;
            const turnCount = executionResult.output.turnCount;
            const messageCount = executionResult.output.messageCount;
            if (
              typeof councilId !== "string" ||
              (runtimeStatus !== "idle" &&
                runtimeStatus !== "running" &&
                runtimeStatus !== "paused") ||
              typeof turnCount !== "number" ||
              typeof messageCount !== "number"
            ) {
              reconciliations.push({
                callId: executionResult.callId,
                completion: null,
                toolName: executionResult.toolName,
                status: "failed",
                failureMessage: "The runtime action result could not be reconciled safely.",
              });
              break;
            }

            await reconcileRuntimeView({
              callId: executionResult.callId,
              expectedCouncilId: councilId,
              expectedGenerationStatus:
                executionResult.toolName === "cancelCouncilGeneration" ? "idle" : undefined,
              expectedMessageCount: messageCount,
              expectedRuntimeStatus: runtimeStatus,
              expectedTurnCount: turnCount,
              toolName: executionResult.toolName,
            });
            break;
          }
          case "archiveAgent":
          case "restoreAgent":
          case "deleteAgent": {
            await reconcileAgentsListMutation({
              callId: executionResult.callId,
              output: executionResult.output,
              toolName: executionResult.toolName,
            });
            break;
          }
          case "archiveCouncil":
          case "restoreCouncil":
          case "deleteCouncil": {
            await reconcileCouncilsListMutation({
              callId: executionResult.callId,
              output: executionResult.output,
              toolName: executionResult.toolName,
            });
            break;
          }
          case "saveProviderConfig":
          case "disconnectProvider":
          case "refreshModelCatalog":
          case "setGlobalDefaultModel": {
            await reconcileSettingsView({
              callId: executionResult.callId,
              output: executionResult.output,
              toolName: executionResult.toolName,
            });
            break;
          }
          case "exportCouncil": {
            const councilId = executionResult.output.councilId;
            const status = executionResult.output.status;
            if (
              typeof councilId !== "string" ||
              (status !== "exported" && status !== "cancelled")
            ) {
              reconciliations.push({
                callId: executionResult.callId,
                completion: null,
                toolName: executionResult.toolName,
                status: "failed",
                failureMessage: "Export reconciliation payload was invalid.",
              });
              break;
            }

            setAssistantPendingExportReconciliation({
              callId: executionResult.callId,
              councilId,
              status,
            });
            markPendingNavigationRebase({
              destinationScopeKey: `councilView:${councilId}`,
              destinationViewKind: "councilView",
            });
            openCouncilView(councilId);
            const ready = await waitForAssistantUi(
              () =>
                screenRef.current.kind === "councilView" &&
                screenRef.current.councilId === councilId &&
                councilViewAssistantSnapshotRef.current?.councilId === councilId &&
                councilViewAssistantSnapshotRef.current?.assistantExportReconciliation?.callId ===
                  executionResult.callId &&
                councilViewAssistantSnapshotRef.current?.assistantExportReconciliation?.status ===
                  status,
              10_000,
            );
            reconciliations.push({
              callId: executionResult.callId,
              completion: ready
                ? {
                    output: {
                      councilId,
                      status,
                    },
                    userSummary:
                      status === "exported"
                        ? "Export finished. The transcript is available from your save location."
                        : "Export cancelled.",
                  }
                : null,
              toolName: executionResult.toolName,
              status: ready ? "completed" : "failed",
              failureMessage: ready
                ? null
                : "Export completion was not visibly confirmed in the council view.",
            });
            break;
          }
          default:
            reconciliations.push({
              callId: executionResult.callId,
              completion: null,
              toolName: executionResult.toolName,
              status: "failed",
              failureMessage: "The requested assistant action could not be reconciled safely.",
            });
            break;
        }
      }

      return reconciliations;
    },
    [openAgentEditor, openCouncilEditor, openCouncilView, updateAssistantState, waitForAssistantUi],
  );

  const assistantShellController = useMemo(
    () =>
      createAssistantShellController({
        applyPlanResultEffects: applyAssistantPlanResultEffects,
        api: window.api.assistant,
        getActiveAssistantContext,
        getActiveAssistantExecutionSnapshot,
        getActiveAssistantScopeKey: getActiveAssistantScope,
        getCurrentAssistantState,
        getStoredAssistantState,
        pushErrorToast: (message) => pushToast("error", message),
        restoreLauncherFocus,
        updateAssistantState,
      }),
    [
      applyAssistantPlanResultEffects,
      getActiveAssistantContext,
      getActiveAssistantExecutionSnapshot,
      getActiveAssistantScope,
      getCurrentAssistantState,
      getStoredAssistantState,
      pushToast,
      restoreLauncherFocus,
      updateAssistantState,
    ],
  );

  useEffect(() => {
    void activeAssistantScopeKey;
    void assistantState;
    void assistantShellController.rebaseToActiveScope();
  }, [activeAssistantScopeKey, assistantShellController, assistantState]);

  const closeAssistantSession = useCallback(
    (): Promise<void> => assistantShellController.closeAssistantSession(),
    [assistantShellController],
  );

  const submitAssistant = useCallback(
    (params: {
      response:
        | {
            approved: boolean;
            kind: "confirmation";
          }
        | {
            kind: "clarification";
            text: string;
          }
        | null;
      responseLabel: string | null;
      userMessageText: string | null;
    }): Promise<void> => assistantShellController.submitAssistant(params),
    [assistantShellController],
  );

  const openAssistant = useCallback(
    (triggerElement: HTMLButtonElement): void => {
      lastAssistantLauncherRef.current = triggerElement;
      updateAssistantState((current) =>
        openAssistantForScope({
          scopeKey: activeAssistantScopeKey,
          state: current,
        }),
      );
    },
    [activeAssistantScopeKey, updateAssistantState],
  );

  const requestAssistantClose = useCallback((): void => {
    const currentState = getCurrentAssistantState();

    updateAssistantState((current) =>
      requiresAssistantCloseConfirmation(current.phase)
        ? { ...current, isCloseConfirmOpen: true }
        : current,
    );

    if (!requiresAssistantCloseConfirmation(currentState.phase)) {
      void closeAssistantSession();
    }
  }, [closeAssistantSession, getCurrentAssistantState, updateAssistantState]);

  const stopAssistant = useCallback(
    (): Promise<void> => assistantShellController.stopAssistant(),
    [assistantShellController],
  );

  const renderAssistantLauncher = (): JSX.Element => <AssistantLauncher onOpen={openAssistant} />;

  return (
    <>
      <AssistantModal
        context={activeAssistantContext}
        inputRef={assistantInputRef}
        onApproveConfirmation={() => {
          void submitAssistant({
            response: { approved: true, kind: "confirmation" },
            responseLabel: "You approved the proposed action.",
            userMessageText: null,
          });
        }}
        onClose={() => {
          void closeAssistantSession();
        }}
        onInputChange={(value) =>
          updateAssistantState((current) => ({
            ...current,
            inputValue: value,
          }))
        }
        onRejectConfirmation={() => {
          void submitAssistant({
            response: { approved: false, kind: "confirmation" },
            responseLabel: "You cancelled the proposed action.",
            userMessageText: null,
          });
        }}
        onRequestClose={requestAssistantClose}
        onSend={() => {
          const currentState = getCurrentAssistantState();
          const currentPhase = currentState.phase;

          void submitAssistant({
            response:
              currentPhase.status === "clarify"
                ? {
                    kind: "clarification",
                    text: currentState.inputValue.trim(),
                  }
                : null,
            responseLabel: null,
            userMessageText: currentState.inputValue.trim(),
          });
        }}
        onStop={() => {
          void stopAssistant();
        }}
        state={renderedAssistantState}
      />
      <ConfirmDialog
        cancelLabel="Keep assistant open"
        confirmLabel="Stop and close"
        confirmTone="danger"
        message="Closing the assistant now will stop the current request. Completed work will remain visible."
        onCancel={() =>
          updateAssistantState((current) => ({
            ...current,
            isCloseConfirmOpen: false,
          }))
        }
        onConfirm={() => {
          updateAssistantState((current) => ({
            ...current,
            isCloseConfirmOpen: false,
          }));
          void closeAssistantSession();
        }}
        open={renderedAssistantState.isCloseConfirmOpen}
        title="Stop assistant work?"
      />
      <HomeScreen
        activeTab={homeTab}
        assistantLauncher={renderAssistantLauncher()}
        isActive={screen.kind === "home"}
        onAssistantContextChange={setHomeAssistantSnapshot}
        onOpenAgentEditor={openAgentEditor}
        onOpenCouncilEditor={openCouncilEditor}
        onOpenCouncilView={openCouncilView}
        onTabChange={setHomeTab}
        pushToast={pushToast}
      />

      <AgentEditorScreen
        agentId={screen.kind === "agentEditor" ? screen.agentId : null}
        assistantLauncher={renderAssistantLauncher()}
        isActive={screen.kind === "agentEditor"}
        onAssistantContextChange={setAgentAssistantSnapshot}
        onAssistantDraftAdapterChange={(adapter: AssistantAgentDraftAdapter | null) => {
          agentDraftAdapterRef.current = adapter;
        }}
        onAssistantSaveAdapterChange={(adapter: AssistantAgentSaveAdapter | null) => {
          agentSaveAdapterRef.current = adapter;
        }}
        onClose={(tab) => closeToHome(tab)}
        pushToast={pushToast}
      />

      <CouncilEditorScreen
        assistantLauncher={renderAssistantLauncher()}
        councilId={screen.kind === "councilEditor" ? screen.councilId : null}
        isActive={screen.kind === "councilEditor"}
        onAssistantContextChange={setCouncilAssistantSnapshot}
        onAssistantDraftAdapterChange={(adapter: AssistantCouncilDraftAdapter | null) => {
          councilDraftAdapterRef.current = adapter;
        }}
        onAssistantSaveAdapterChange={(adapter: AssistantCouncilSaveAdapter | null) => {
          councilSaveAdapterRef.current = adapter;
        }}
        onClose={() => closeToHome("councils")}
        pushToast={pushToast}
      />

      <CouncilViewScreen
        assistantExportReconciliation={assistantPendingExportReconciliation}
        assistantReloadToken={assistantCouncilViewReloadToken}
        assistantLauncher={renderAssistantLauncher()}
        councilId={screen.kind === "councilView" ? screen.councilId : ""}
        isActive={screen.kind === "councilView"}
        onAssistantContextChange={setCouncilViewAssistantSnapshot}
        onClose={() => closeToHome()}
        pushToast={pushToast}
      />
    </>
  );
};
