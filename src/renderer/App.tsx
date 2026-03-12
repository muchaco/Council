import { type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  buildAssistantHomeContext,
} from "./components/assistant/assistant-context-builders";
import { createAssistantShellController } from "./components/assistant/assistant-shell-controller";
import {
  type AssistantUiState,
  closeAssistantUi,
  createInitialAssistantUiState,
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
  const assistantInputRef = useRef<HTMLTextAreaElement>(null);
  const assistantStateRef = useRef(assistantState);
  const activeAssistantScopeKeyRef = useRef<string | null>(null);
  const lastAssistantLauncherRef = useRef<HTMLButtonElement | null>(null);
  const homeTabAtDetailOpenRef = useRef<HomeTab>("councils");
  const { pushToast } = useToastQueue();

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

  const openAgentEditor = (agentId: string | null): void => {
    if (screen.kind === "home") {
      homeTabAtDetailOpenRef.current = homeTab;
    }
    setScreen({ kind: "agentEditor", agentId });
  };

  const openCouncilEditor = (councilId: string | null): void => {
    if (screen.kind === "home") {
      homeTabAtDetailOpenRef.current = homeTab;
    }
    setScreen({ kind: "councilEditor", councilId });
  };

  const openCouncilView = (councilId: string): void => {
    if (screen.kind === "home") {
      homeTabAtDetailOpenRef.current = homeTab;
    }
    setScreen({ kind: "councilView", councilId });
  };

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

  const activeAssistantScopeKey = useMemo(() => {
    switch (screen.kind) {
      case "home":
        return `home:${homeTab}`;
      case "agentEditor":
        return `agentEditor:${screen.agentId ?? "new"}`;
      case "councilEditor":
        return `councilEditor:${screen.councilId ?? "new"}`;
      case "councilView":
        return `councilView:${screen.councilId}`;
    }
  }, [homeTab, screen]);

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

  const assistantShellController = useMemo(
    () =>
      createAssistantShellController({
        api: window.api.assistant,
        getActiveAssistantContext,
        getActiveAssistantScopeKey: getActiveAssistantScope,
        getCurrentAssistantState,
        getStoredAssistantState,
        pushErrorToast: (message) => pushToast("error", message),
        restoreLauncherFocus,
        updateAssistantState,
      }),
    [
      getActiveAssistantContext,
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
        onClose={(tab) => closeToHome(tab)}
        pushToast={pushToast}
      />

      <CouncilEditorScreen
        assistantLauncher={renderAssistantLauncher()}
        councilId={screen.kind === "councilEditor" ? screen.councilId : null}
        isActive={screen.kind === "councilEditor"}
        onAssistantContextChange={setCouncilAssistantSnapshot}
        onClose={() => closeToHome("councils")}
        pushToast={pushToast}
      />

      <CouncilViewScreen
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
