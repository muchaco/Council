import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  type AutopilotLimitModalAction,
  type AutopilotLimitModalState,
  COUNCIL_CONFIG_MAX_TAGS,
  appendCouncilConfigTag,
  councilModelLabel,
  createAutopilotLimitModalState,
  isModelSelectionInCatalog,
  normalizeTagsDraft,
  parseCouncilConfigTags,
  resolveAutopilotMaxTurns,
  toModelRef,
  toModelSelectionValue,
} from "../../../shared/app-ui-helpers.js";
import {
  type CouncilRuntimeErrorDto,
  readCouncilRuntimeErrorDetails,
} from "../../../shared/council-runtime-error-normalization.js";
import {
  resolveInlineConfigEditKeyboardAction,
  resolveTranscriptFocusIndex,
} from "../../../shared/council-view-accessibility.js";
import {
  buildAutopilotRecoveryNotice,
  buildManualRetryNotice,
} from "../../../shared/council-view-autopilot-recovery";
import { resolveCouncilViewRuntimeControls } from "../../../shared/council-view-runtime-controls.js";
import {
  COUNCIL_VIEW_EXIT_CONFIRMATION_MESSAGE,
  buildCouncilViewExitPlan,
} from "../../../shared/council-view-runtime-guards";
import {
  resolveThinkingPlaceholderSpeakerId,
  shouldRenderInlineThinkingCancel,
} from "../../../shared/council-view-transcript.js";
import type { CouncilDto, GetCouncilViewResponse } from "../../../shared/ipc/dto";
import { ConfirmDialog } from "../../ConfirmDialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { AutopilotLimitDialog } from "./AutopilotLimitDialog";
import { CouncilRuntimeAlerts } from "./CouncilRuntimeAlerts";
import { CouncilViewHeader } from "./CouncilViewHeader";
import { CouncilViewTabs } from "./CouncilViewTabs";
import { DiscussionTab } from "./DiscussionTab";

type CouncilViewTab = "discussion" | "config";
type CouncilConfigField = "topic" | "goal" | "tags" | "conductorModel";
type CouncilConfigEditState = { field: CouncilConfigField; draftValue: string };

type CouncilViewState =
  | { status: "loading" }
  | {
      status: "ready";
      source: GetCouncilViewResponse;
      isStarting: boolean;
      isPausing: boolean;
      isResuming: boolean;
      isGeneratingManualTurn: boolean;
      pendingManualMemberAgentId: string | null;
      isInjectingConductor: boolean;
      isCancellingGeneration: boolean;
      isExportingTranscript: boolean;
      isLeavingView: boolean;
      showLeaveDialog: boolean;
      activeTab: CouncilViewTab;
      configEdit: CouncilConfigEditState | null;
      configTagInput: string;
      showConfigDiscardDialog: boolean;
      showConfigDeleteDialog: boolean;
      isSavingConfigField: boolean;
      isRefreshingConfigModels: boolean;
      isSavingMembers: boolean;
      showAddMemberPanel: boolean;
      addMemberSearchText: string;
      showMemberRemoveDialog: boolean;
      pendingMemberRemovalId: string | null;
      conductorDraft: string;
      runtimeError: CouncilRuntimeErrorDto | null;
      message: string;
    }
  | { status: "error"; message: string };

const MEMBER_COLOR_PALETTE: ReadonlyArray<string> = [
  "#0a5c66",
  "#2563eb",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#0f766e",
  "#166534",
  "#7c2d12",
];

const toCouncilConfigFieldDisplayValue = (params: {
  council: CouncilDto;
  field: CouncilConfigField;
}): string => {
  switch (params.field) {
    case "topic":
      return params.council.topic;
    case "goal":
      return params.council.goal ?? "";
    case "tags":
      return params.council.tags.join(", ");
    case "conductorModel":
      return toModelSelectionValue(params.council.conductorModelRefOrNull);
    default:
      return "";
  }
};

const createReadyCouncilViewState = (
  source: GetCouncilViewResponse,
  options?: { activeTab?: CouncilViewTab; runtimeError?: CouncilRuntimeErrorDto | null },
): Extract<CouncilViewState, { status: "ready" }> => ({
  status: "ready",
  source,
  isStarting: false,
  isPausing: false,
  isResuming: false,
  isGeneratingManualTurn: false,
  pendingManualMemberAgentId: null,
  isInjectingConductor: false,
  isCancellingGeneration: false,
  isExportingTranscript: false,
  isLeavingView: false,
  showLeaveDialog: false,
  activeTab: options?.activeTab ?? "discussion",
  configEdit: null,
  configTagInput: "",
  showConfigDiscardDialog: false,
  showConfigDeleteDialog: false,
  isSavingConfigField: false,
  isRefreshingConfigModels: false,
  isSavingMembers: false,
  showAddMemberPanel: false,
  addMemberSearchText: "",
  showMemberRemoveDialog: false,
  pendingMemberRemovalId: null,
  conductorDraft: "",
  runtimeError: options?.runtimeError ?? null,
  message: "",
});

type CouncilViewScreenProps = {
  councilId: string;
  isActive: boolean;
  onClose: () => void;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
};

export const CouncilViewScreen = ({
  councilId,
  isActive,
  onClose,
  pushToast,
}: CouncilViewScreenProps): JSX.Element | null => {
  const [state, setState] = useState<CouncilViewState>({ status: "loading" });
  const [autopilotLimitModal, setAutopilotLimitModal] = useState<AutopilotLimitModalState | null>(
    null,
  );
  const transcriptRowRefs = useRef<Array<HTMLElement | null>>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const councilConfigEditContainerRef = useRef<HTMLDivElement | null>(null);
  const councilConfigEditInputRef = useRef<HTMLElement | null>(null);

  const loadCouncilView = useCallback(
    async (
      nextCouncilId: string,
      options?: {
        preserveActiveTab?: CouncilViewTab;
        runtimeError?: CouncilRuntimeErrorDto | null;
      },
    ): Promise<void> => {
      setState({ status: "loading" });
      const result = await window.api.councils.getCouncilView({
        viewKind: "councilView",
        councilId: nextCouncilId,
      });
      if (!result.ok) {
        setState({ status: "error", message: result.error.userMessage });
        pushToast("error", result.error.userMessage);
        return;
      }
      setState(
        createReadyCouncilViewState(result.value, {
          activeTab: options?.preserveActiveTab,
          runtimeError: options?.runtimeError ?? null,
        }),
      );
    },
    [pushToast],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }
    void loadCouncilView(councilId);
  }, [councilId, isActive, loadCouncilView]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    document.title = `Council: ${state.status === "ready" ? state.source.council.title : "Council View"}`;
  }, [isActive, state]);

  useEffect(() => {
    if (autopilotLimitModal === null) {
      return;
    }
    const focusTarget = document.querySelector<HTMLElement>(
      "#autopilot-max-turns-input:not(:disabled), #autopilot-limit-toggle",
    );
    focusTarget?.focus();
  }, [autopilotLimitModal]);

  useEffect(() => {
    if (state.status !== "ready" || state.configEdit === null) {
      return;
    }
    councilConfigEditInputRef.current?.focus();
  }, [state]);

  useEffect(() => {
    if (
      state.status !== "ready" ||
      state.activeTab !== "config" ||
      state.configEdit === null ||
      state.showConfigDiscardDialog
    ) {
      return;
    }
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (councilConfigEditContainerRef.current?.contains(target) === true) {
        return;
      }
      closeCouncilConfigEdit(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [state]);

  useLayoutEffect(() => {
    if (!isActive || state.status !== "ready") {
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [isActive, state]);

  useEffect(() => {
    if (!isActive || state.status !== "ready") {
      return;
    }
    const council = state.source.council;
    const generation = state.source.generation;
    if (
      council.mode !== "autopilot" ||
      !council.started ||
      council.paused ||
      council.archived ||
      generation.status === "running" ||
      state.configEdit !== null
    ) {
      return;
    }
    window.api.councils
      .advanceAutopilotTurn({ viewKind: "councilView", id: councilId })
      .then((result) => {
        if (!result.ok) {
          pushToast("error", result.error.userMessage);
          const runtimeError = readCouncilRuntimeErrorDetails(result.error.details);
          return loadCouncilView(councilId, { preserveActiveTab: state.activeTab, runtimeError });
        }
        return loadCouncilView(councilId);
      })
      .catch(() => {
        pushToast("error", "Autopilot encountered an error. Check console for details.");
      });
  }, [councilId, isActive, loadCouncilView, pushToast, state]);

  const completeClose = async (): Promise<void> => {
    setAutopilotLimitModal(null);
    onClose();
  };

  const executeLeave = async (params: {
    exitPlan: ReturnType<typeof buildCouncilViewExitPlan>;
  }): Promise<void> => {
    if (state.status !== "ready") {
      await completeClose();
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, isLeavingView: true, showLeaveDialog: false, message: "" },
    );
    if (params.exitPlan.shouldPauseAutopilot) {
      const pauseResult = await window.api.councils.pauseAutopilot({ id: councilId });
      if (!pauseResult.ok) {
        pushToast("error", pauseResult.error.userMessage);
        setState((current) =>
          current.status !== "ready"
            ? current
            : { ...current, isLeavingView: false, message: pauseResult.error.userMessage },
        );
        return;
      }
    }
    if (params.exitPlan.shouldCancelGeneration) {
      const cancelResult = await window.api.councils.cancelGeneration({ id: councilId });
      if (!cancelResult.ok) {
        pushToast("error", cancelResult.error.userMessage);
        setState((current) =>
          current.status !== "ready"
            ? current
            : { ...current, isLeavingView: false, message: cancelResult.error.userMessage },
        );
        return;
      }
    }
    await completeClose();
  };

  const leaveSafely = async (): Promise<void> => {
    if (state.status !== "ready") {
      await completeClose();
      return;
    }
    if (state.isLeavingView) {
      return;
    }
    const exitPlan = buildCouncilViewExitPlan(state.source.council, state.source.generation);
    if (!exitPlan.requiresConfirmation) {
      await executeLeave({ exitPlan });
      return;
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, showLeaveDialog: true },
    );
  };

  const openAutopilotLimitModal = (action: AutopilotLimitModalAction): void => {
    setAutopilotLimitModal(createAutopilotLimitModalState(action));
  };

  const executeStartCouncilRuntime = async (maxTurns: number | null): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, isStarting: true, runtimeError: null, message: "" },
    );
    const result = await window.api.councils.start({
      viewKind: "councilView",
      id: councilId,
      maxTurns,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isStarting: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Council started.");
    await loadCouncilView(councilId);
  };

  const pauseCouncilRuntime = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, isPausing: true, runtimeError: null, message: "" },
    );
    const result = await window.api.councils.pauseAutopilot({ id: councilId });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isPausing: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Autopilot paused.");
    await loadCouncilView(councilId);
  };

  const executeResumeCouncilRuntime = async (maxTurns: number | null): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, isResuming: true, runtimeError: null, message: "" },
    );
    const result = await window.api.councils.resumeAutopilot({
      viewKind: "councilView",
      id: councilId,
      maxTurns,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isResuming: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Autopilot resumed.");
    await loadCouncilView(councilId);
  };

  const submitAutopilotLimitModal = async (): Promise<void> => {
    if (autopilotLimitModal === null) {
      return;
    }
    const resolved = resolveAutopilotMaxTurns(autopilotLimitModal);
    if (!resolved.ok) {
      setAutopilotLimitModal((current) =>
        current === null ? current : { ...current, validationMessage: resolved.validationMessage },
      );
      return;
    }
    const action = autopilotLimitModal.action;
    setAutopilotLimitModal(null);
    if (action === "start") {
      await executeStartCouncilRuntime(resolved.maxTurns);
      return;
    }
    await executeResumeCouncilRuntime(resolved.maxTurns);
  };

  const startCouncilRuntime = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    if (state.source.council.mode === "autopilot") {
      openAutopilotLimitModal("start");
      return;
    }
    await executeStartCouncilRuntime(null);
  };

  const handleTranscriptRowKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
    currentIndex: number,
    totalRows: number,
  ): void => {
    const nextIndex = resolveTranscriptFocusIndex({
      currentIndex,
      key: event.key,
      totalItems: totalRows,
    });
    if (nextIndex === null || nextIndex === currentIndex) {
      return;
    }
    event.preventDefault();
    transcriptRowRefs.current[nextIndex]?.focus();
  };

  const openCouncilConfigEdit = (field: CouncilConfigField): void => {
    setState((current) => {
      if (current.status !== "ready") {
        return current;
      }
      return {
        ...current,
        configEdit: {
          field,
          draftValue: toCouncilConfigFieldDisplayValue({ council: current.source.council, field }),
        },
        configTagInput: "",
        showConfigDiscardDialog: false,
      };
    });
  };

  const hasConfigEditChanges = (current: Extract<CouncilViewState, { status: "ready" }>): boolean =>
    current.configEdit !== null &&
    current.configEdit.draftValue !==
      toCouncilConfigFieldDisplayValue({
        council: current.source.council,
        field: current.configEdit.field,
      });

  const closeCouncilConfigEdit = (forceDiscard: boolean): void => {
    setState((current) => {
      if (current.status !== "ready" || current.configEdit === null) {
        return current;
      }
      if (!forceDiscard && hasConfigEditChanges(current)) {
        return { ...current, showConfigDiscardDialog: true };
      }
      return { ...current, configEdit: null, configTagInput: "", showConfigDiscardDialog: false };
    });
  };

  const saveCouncilConfigEdit = async (): Promise<void> => {
    if (state.status !== "ready" || state.configEdit === null || state.isSavingConfigField) {
      return;
    }
    const currentCouncil = state.source.council;
    const configEdit = state.configEdit;
    const nextTopic = configEdit.field === "topic" ? configEdit.draftValue : currentCouncil.topic;
    const nextGoal =
      configEdit.field === "goal" ? configEdit.draftValue : (currentCouncil.goal ?? "");
    const nextTagsInput =
      configEdit.field === "tags" ? configEdit.draftValue : currentCouncil.tags.join(", ");
    const nextModelSelection =
      configEdit.field === "conductorModel"
        ? configEdit.draftValue
        : toModelSelectionValue(currentCouncil.conductorModelRefOrNull);
    const normalizedTagsResult = normalizeTagsDraft({
      tagsInput: nextTagsInput,
      maxTags: COUNCIL_CONFIG_MAX_TAGS,
    });
    if (!normalizedTagsResult.ok) {
      pushToast("warning", normalizedTagsResult.message);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, message: normalizedTagsResult.message },
      );
      return;
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, isSavingConfigField: true, message: "" },
    );
    const result = await window.api.councils.save({
      viewKind: "councilView",
      id: currentCouncil.id,
      title: currentCouncil.title,
      topic: nextTopic,
      goal: nextGoal.trim().length === 0 ? null : nextGoal,
      mode: currentCouncil.mode,
      tags: normalizedTagsResult.tags,
      memberAgentIds: currentCouncil.memberAgentIds,
      memberColorsByAgentId: currentCouncil.memberColorsByAgentId,
      conductorModelRefOrNull: toModelRef(nextModelSelection),
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isSavingConfigField: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Council config saved.");
    await loadCouncilView(councilId);
    setState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            activeTab: "config",
            configEdit: null,
            configTagInput: "",
            showConfigDiscardDialog: false,
            isSavingConfigField: false,
          },
    );
  };

  const addTagToCouncilConfigEdit = (): void => {
    if (state.status !== "ready" || state.configEdit?.field !== "tags") {
      return;
    }
    const currentTags = parseCouncilConfigTags(state.configEdit.draftValue);
    const result = appendCouncilConfigTag({
      currentTags,
      tagInput: state.configTagInput,
      maxTags: COUNCIL_CONFIG_MAX_TAGS,
    });
    if (!result.ok) {
      pushToast("warning", result.message);
      return;
    }
    setState((current) =>
      current.status !== "ready" || current.configEdit?.field !== "tags"
        ? current
        : {
            ...current,
            configEdit: { ...current.configEdit, draftValue: result.tags.join(", ") },
            configTagInput: "",
          },
    );
  };

  const removeTagFromCouncilConfigEdit = (tagToRemove: string): void => {
    setState((current) => {
      if (current.status !== "ready" || current.configEdit?.field !== "tags") {
        return current;
      }
      const nextTags = parseCouncilConfigTags(current.configEdit.draftValue).filter(
        (tag) => tag.toLowerCase() !== tagToRemove.toLowerCase(),
      );
      return { ...current, configEdit: { ...current.configEdit, draftValue: nextTags.join(", ") } };
    });
  };

  const refreshCouncilViewConfigModels = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, isRefreshingConfigModels: true, message: "" },
    );
    const result = await window.api.councils.refreshModelCatalog({ viewKind: "councilView" });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isRefreshingConfigModels: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Council model options refreshed.");
    await loadCouncilView(councilId);
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, activeTab: "config", isRefreshingConfigModels: false },
    );
  };

  const saveCouncilViewMembers = async (params: {
    memberAgentIds: ReadonlyArray<string>;
    memberColorsByAgentId: Readonly<Record<string, string>>;
    successMessage: string;
    keepAddPanelOpen?: boolean;
  }): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    const currentCouncil = state.source.council;
    setState((current) =>
      current.status !== "ready" ? current : { ...current, isSavingMembers: true, message: "" },
    );
    const result = await window.api.councils.save({
      viewKind: "councilView",
      id: currentCouncil.id,
      title: currentCouncil.title,
      topic: currentCouncil.topic,
      goal: currentCouncil.goal,
      mode: currentCouncil.mode,
      tags: currentCouncil.tags,
      memberAgentIds: params.memberAgentIds,
      memberColorsByAgentId: params.memberColorsByAgentId,
      conductorModelRefOrNull: currentCouncil.conductorModelRefOrNull,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isSavingMembers: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", params.successMessage);
    await loadCouncilView(councilId);
    setState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            activeTab: "discussion",
            isSavingMembers: false,
            showAddMemberPanel: params.keepAddPanelOpen ?? false,
            showMemberRemoveDialog: false,
            pendingMemberRemovalId: null,
          },
    );
  };

  const setCouncilViewMemberColor = async (params: {
    memberAgentId: string;
    color: string;
  }): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    await saveCouncilViewMembers({
      memberAgentIds: state.source.council.memberAgentIds,
      memberColorsByAgentId: {
        ...state.source.council.memberColorsByAgentId,
        [params.memberAgentId]: params.color,
      },
      successMessage: "Member color updated.",
      keepAddPanelOpen: state.showAddMemberPanel,
    });
  };

  const addCouncilViewMember = async (memberAgentId: string): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    const currentCouncil = state.source.council;
    if (currentCouncil.memberAgentIds.includes(memberAgentId)) {
      return;
    }
    const usedColors = new Set(Object.values(currentCouncil.memberColorsByAgentId));
    const defaultColor = MEMBER_COLOR_PALETTE.find((color) => !usedColors.has(color)) ?? "#0a5c66";
    await saveCouncilViewMembers({
      memberAgentIds: [...currentCouncil.memberAgentIds, memberAgentId],
      memberColorsByAgentId: {
        ...currentCouncil.memberColorsByAgentId,
        [memberAgentId]: defaultColor,
      },
      successMessage: "Member added.",
      keepAddPanelOpen: true,
    });
  };

  const generateManualTurn = async (memberAgentId: string): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isGeneratingManualTurn: true,
            pendingManualMemberAgentId: memberAgentId,
            runtimeError: null,
            message: "",
          },
    );
    const result = await window.api.councils.generateManualTurn({
      viewKind: "councilView",
      id: councilId,
      memberAgentId,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      const runtimeError = readCouncilRuntimeErrorDetails(result.error.details);
      setState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isGeneratingManualTurn: false,
              pendingManualMemberAgentId: null,
              runtimeError,
              message: "",
            },
      );
      return;
    }
    pushToast("info", "Manual turn generated.");
    await loadCouncilView(councilId);
  };

  const injectConductorMessage = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    const content = state.conductorDraft.trim();
    if (content.length === 0) {
      pushToast("warning", "Conductor message cannot be empty.");
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, isInjectingConductor: true, runtimeError: null, message: "" },
    );
    const result = await window.api.councils.injectConductorMessage({
      viewKind: "councilView",
      id: councilId,
      content,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isInjectingConductor: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Conductor message added.");
    await loadCouncilView(councilId);
  };

  const cancelCouncilGeneration = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, isCancellingGeneration: true },
    );
    const result = await window.api.councils.cancelGeneration({ id: councilId });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isCancellingGeneration: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast(
      "info",
      result.value.cancelled ? "Generation cancelled." : "No generation in progress.",
    );
    await loadCouncilView(councilId);
  };

  const exportCouncilTranscript = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, isExportingTranscript: true, message: "" },
    );
    const result = await window.api.councils.exportTranscript({
      viewKind: "councilView",
      id: councilId,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isExportingTranscript: false, message: result.error.userMessage },
      );
      return;
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, isExportingTranscript: false },
    );
    if (result.value.status === "cancelled") {
      pushToast("warning", "Export cancelled.");
      return;
    }
    pushToast("info", `Transcript exported to ${result.value.filePath}`);
  };

  const setCouncilArchivedFromView = async (
    council: CouncilDto,
    archived: boolean,
  ): Promise<void> => {
    const result = await window.api.councils.setArchived({ id: council.id, archived });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready" ? current : { ...current, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", archived ? "Council archived." : "Council restored.");
    await loadCouncilView(councilId);
    setState((current) =>
      current.status !== "ready" ? current : { ...current, activeTab: "config" },
    );
  };

  const deleteCouncilFromView = async (council: CouncilDto): Promise<void> => {
    setState((current) =>
      current.status !== "ready" ? current : { ...current, showConfigDeleteDialog: false },
    );
    const result = await window.api.councils.delete({ id: council.id });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready" ? current : { ...current, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Council deleted.");
    onClose();
  };

  if (!isActive) {
    return null;
  }
  if (state.status === "loading") {
    return (
      <main className="shell">
        <header className="section-header">
          <button className="secondary" onClick={() => void leaveSafely()} type="button">
            Back
          </button>
          <h1>Council View</h1>
        </header>
        <p className="status">Loading council view...</p>
      </main>
    );
  }
  if (state.status === "error") {
    return (
      <main className="shell">
        <header className="section-header">
          <button className="secondary" onClick={() => void leaveSafely()} type="button">
            Back
          </button>
          <h1>Council View</h1>
        </header>
        <p className="status">Error: {state.message}</p>
      </main>
    );
  }

  const council = state.source.council;
  const availableAgentById = new Map(
    state.source.availableAgents.map((agent) => [agent.id, agent]),
  );
  const memberNameById = new Map(
    state.source.availableAgents.map((agent) => [agent.id, agent.name]),
  );
  const archivedMemberIds = council.memberAgentIds.filter(
    (memberAgentId) => availableAgentById.get(memberAgentId)?.archived === true,
  );
  const hasArchivedMembers = archivedMemberIds.length > 0;
  const archivedMemberNames = archivedMemberIds.map(
    (memberAgentId) => memberNameById.get(memberAgentId) ?? memberAgentId,
  );
  const runtimeControls = resolveCouncilViewRuntimeControls({
    mode: council.mode,
    started: council.started,
    paused: council.paused,
    archived: council.archived,
    messageCount: state.source.messages.length,
  });
  const generationRunning = state.source.generation.status === "running";
  const generationActive = generationRunning || state.isGeneratingManualTurn;
  const manualSpeakerDisabledReason = council.archived
    ? "Archived councils are read-only."
    : hasArchivedMembers
      ? "Restore or remove archived members before selecting the next speaker."
      : !council.started
        ? "Start the council before selecting the next speaker."
        : generationRunning || state.isGeneratingManualTurn
          ? "Wait for the current generation to finish."
          : null;
  const pausedNextSpeakerId =
    council.mode === "autopilot" && council.paused
      ? state.source.generation.plannedNextSpeakerAgentId
      : null;
  const pausedNextSpeakerName =
    pausedNextSpeakerId === null
      ? null
      : (memberNameById.get(pausedNextSpeakerId) ?? pausedNextSpeakerId);
  const thinkingSpeakerId = resolveThinkingPlaceholderSpeakerId({
    generation: state.source.generation,
    pendingManualMemberAgentId: state.pendingManualMemberAgentId,
  });
  const thinkingSpeakerName =
    thinkingSpeakerId === null
      ? null
      : (memberNameById.get(thinkingSpeakerId) ?? thinkingSpeakerId);
  const thinkingSpeakerColor =
    thinkingSpeakerId === null
      ? null
      : (council.memberColorsByAgentId[thinkingSpeakerId] ?? MEMBER_COLOR_PALETTE[0] ?? "#0a5c66");
  const showInlineThinkingCancel = shouldRenderInlineThinkingCancel({
    generationActive,
    thinkingSpeakerId,
  });
  const autopilotRecoveryNotice = buildAutopilotRecoveryNotice({
    council: { mode: council.mode, started: council.started, paused: council.paused },
    runtimeError: state.runtimeError,
  });
  const manualRetryNotice = buildManualRetryNotice({
    council: { mode: council.mode },
    runtimeError: state.runtimeError,
  });
  const autopilotSubmitLabel =
    autopilotLimitModal?.action === "start"
      ? state.isStarting
        ? "Starting..."
        : "Start"
      : state.isResuming
        ? "Resuming..."
        : "Resume";
  const startDisabled =
    state.isStarting ||
    council.invalidConfig ||
    hasArchivedMembers ||
    autopilotLimitModal !== null ||
    state.configEdit !== null;
  const startDisabledReason = council.invalidConfig
    ? "Fix the model config before starting."
    : hasArchivedMembers
      ? "Restore or remove archived members before starting."
      : undefined;
  const transcriptRowCount = state.source.messages.length + (thinkingSpeakerName === null ? 0 : 1);
  const configEditField = state.configEdit?.field ?? null;
  const configEditDraftValue = state.configEdit?.draftValue ?? "";
  const configEditTags =
    configEditField === "tags" ? parseCouncilConfigTags(configEditDraftValue) : [];
  const councilViewConductorSelectValue =
    configEditDraftValue.length > 0 ? configEditDraftValue : "__global_default__";
  const hasUnavailableConductorSelectionInView = !isModelSelectionInCatalog({
    modelSelection:
      configEditField === "conductorModel"
        ? configEditDraftValue
        : toModelSelectionValue(council.conductorModelRefOrNull),
    modelCatalog: state.source.modelCatalog,
  });
  const runtimeBriefing = state.source.briefing;
  const canEditMembers =
    !council.archived && (!council.started || council.paused || council.mode === "manual");
  const memberIdsWithMessages = new Set(
    state.source.messages
      .filter((message) => message.senderKind === "member" && message.senderAgentId !== null)
      .map((message) => message.senderAgentId as string),
  );
  const addMemberSearch = state.addMemberSearchText.trim().toLowerCase();
  const addableAgents = state.source.availableAgents.filter(
    (agent) =>
      !council.memberAgentIds.includes(agent.id) &&
      !agent.archived &&
      (addMemberSearch.length === 0 ||
        agent.name.toLowerCase().includes(addMemberSearch) ||
        agent.id.toLowerCase().includes(addMemberSearch)),
  );
  const addMemberEmptyStateMessage =
    addMemberSearch.length > 0
      ? "No active agents match that search."
      : "No active agents are available to add.";

  return (
    <main className="main-content">
      <div className="main-content-inner">
        <CouncilViewHeader
          autopilotLimitModalOpen={autopilotLimitModal !== null}
          autopilotMaxTurns={council.autopilotMaxTurns}
          autopilotTurnsCompleted={council.autopilotTurnsCompleted}
          cancelDisabled={state.isCancellingGeneration || state.configEdit !== null}
          canShowRuntimeBlockBadge={
            (runtimeControls.canStart || runtimeControls.canResume) &&
            (council.invalidConfig || hasArchivedMembers)
          }
          invalidConfig={council.invalidConfig}
          isCancellingGeneration={state.isCancellingGeneration}
          isLeavingView={state.isLeavingView}
          isPausing={state.isPausing}
          isResuming={state.isResuming}
          isStarting={state.isStarting}
          mode={council.mode}
          onBack={() => void leaveSafely()}
          onCancelGeneration={() => void cancelCouncilGeneration()}
          onPause={() => void pauseCouncilRuntime()}
          onResume={() => openAutopilotLimitModal("resume")}
          onStart={() => void startCouncilRuntime()}
          pauseDisabled={state.isPausing || state.configEdit !== null}
          paused={council.paused}
          pausedNextSpeakerName={pausedNextSpeakerName}
          resumeDisabledReason={
            council.invalidConfig
              ? "Fix the model config before resuming."
              : hasArchivedMembers
                ? "Restore or remove archived members before resuming."
                : undefined
          }
          runtimeControls={runtimeControls}
          showTopBarCancel={generationActive && !showInlineThinkingCancel}
          startDisabled={startDisabled}
          startDisabledReason={startDisabledReason}
          started={council.started}
          statusBadgeTitle={
            council.invalidConfig
              ? "Resolved conductor model is unavailable in this view's model catalog snapshot."
              : "One or more council members are archived."
          }
          title={council.title}
          turnCount={council.turnCount}
        />
        <CouncilViewTabs
          activeTab={state.activeTab}
          disableConfigTab={state.configEdit !== null && state.activeTab !== "config"}
          disableDiscussionTab={state.configEdit !== null && state.activeTab !== "discussion"}
          onSelectTab={(activeTab) =>
            setState((current) =>
              current.status !== "ready" ? current : { ...current, activeTab },
            )
          }
        />

        <CouncilRuntimeAlerts
          archived={council.archived}
          archivedMemberNames={archivedMemberNames}
          hasArchivedMembers={hasArchivedMembers}
          invalidConfig={council.invalidConfig}
          message={state.message}
          showMessage={state.message.length > 0 && autopilotRecoveryNotice === null}
        />

        {state.activeTab === "discussion" ? (
          <DiscussionTab
            addMemberEmptyStateMessage={addMemberEmptyStateMessage}
            addMemberSearchText={state.addMemberSearchText}
            addableAgents={addableAgents}
            autopilotRecoveryNotice={autopilotRecoveryNotice}
            availableAgentById={availableAgentById}
            briefing={runtimeBriefing}
            canEditMembers={canEditMembers}
            chatEndRef={chatEndRef}
            conductorDisabled={generationRunning || council.archived}
            conductorDraft={state.conductorDraft}
            council={council}
            isCancellingGeneration={state.isCancellingGeneration}
            isConfigEditing={state.configEdit !== null}
            isGeneratingManualTurn={state.isGeneratingManualTurn}
            isInjectingConductor={state.isInjectingConductor}
            isSavingMembers={state.isSavingMembers}
            isStarting={state.isStarting}
            manualRetryNotice={manualRetryNotice}
            manualSpeakerDisabledReason={manualSpeakerDisabledReason}
            memberIdsWithMessages={memberIdsWithMessages}
            memberNameById={memberNameById}
            memberPalette={MEMBER_COLOR_PALETTE}
            messages={state.source.messages}
            onAddMember={(memberAgentId) => void addCouncilViewMember(memberAgentId)}
            onCancelGeneration={() => void cancelCouncilGeneration()}
            onChangeConductorDraft={(value) =>
              setState((current) =>
                current.status !== "ready" ? current : { ...current, conductorDraft: value },
              )
            }
            onGenerateManualTurn={(memberAgentId) => void generateManualTurn(memberAgentId)}
            onMemberColorChange={(params) => void setCouncilViewMemberColor(params)}
            onMemberSearchTextChange={(value) =>
              setState((current) =>
                current.status !== "ready" ? current : { ...current, addMemberSearchText: value },
              )
            }
            onRequestRemoveMember={(memberAgentId) =>
              setState((current) =>
                current.status !== "ready"
                  ? current
                  : {
                      ...current,
                      pendingMemberRemovalId: memberAgentId,
                      showMemberRemoveDialog: true,
                    },
              )
            }
            onStartDiscussion={() => void startCouncilRuntime()}
            onSubmitConductor={() => void injectConductorMessage()}
            onToggleAddMemberPanel={() =>
              setState((current) =>
                current.status !== "ready"
                  ? current
                  : { ...current, showAddMemberPanel: !current.showAddMemberPanel },
              )
            }
            onTranscriptRowKeyDown={(event, currentIndex) =>
              handleTranscriptRowKeyDown(event, currentIndex, transcriptRowCount)
            }
            registerTranscriptRowRef={(currentIndex, element) => {
              transcriptRowRefs.current[currentIndex] = element;
            }}
            showAddMemberPanel={state.showAddMemberPanel}
            showEmptyStateStart={runtimeControls.showEmptyStateStart}
            showInlineThinkingCancel={showInlineThinkingCancel}
            startDisabled={startDisabled}
            startDisabledReason={startDisabledReason}
            thinkingSpeakerColor={thinkingSpeakerColor}
            thinkingSpeakerName={thinkingSpeakerName}
          />
        ) : (
          <section
            aria-labelledby="council-view-tab-config"
            className="space-y-6"
            id="council-view-panel-config"
            role="tabpanel"
          >
            <Card className="p-6">
              <div className="space-y-6" ref={councilConfigEditContainerRef}>
                <h2 className="mb-6 text-xl font-medium">Configuration</h2>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Topic</Label>
                  {configEditField === "topic" ? (
                    <div className="space-y-3">
                      <Textarea
                        onChange={(event) =>
                          setState((current) =>
                            current.status !== "ready" || current.configEdit === null
                              ? current
                              : {
                                  ...current,
                                  configEdit: {
                                    ...current.configEdit,
                                    draftValue: event.target.value,
                                  },
                                },
                          )
                        }
                        onKeyDown={(event) => {
                          const action = resolveInlineConfigEditKeyboardAction({
                            key: event.key,
                            shiftKey: event.shiftKey,
                          });
                          if (action === "none") {
                            return;
                          }
                          event.preventDefault();
                          if (action === "save") {
                            void saveCouncilConfigEdit();
                          } else {
                            closeCouncilConfigEdit(false);
                          }
                        }}
                        ref={(element) => {
                          councilConfigEditInputRef.current = element;
                        }}
                        rows={4}
                        value={configEditDraftValue}
                      />
                      <div className="flex justify-end">
                        <Button
                          disabled={state.isSavingConfigField}
                          onClick={() => void saveCouncilConfigEdit()}
                        >
                          {state.isSavingConfigField ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 p-3">
                      <p className="flex-1 text-sm">{council.topic}</p>
                      <Button
                        aria-label="Edit topic"
                        disabled={state.configEdit !== null || council.archived}
                        onClick={() => openCouncilConfigEdit("topic")}
                        size="sm"
                        variant="ghost"
                      >
                        ✎
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Goal</Label>
                  {configEditField === "goal" ? (
                    <div className="space-y-3">
                      <Textarea
                        onChange={(event) =>
                          setState((current) =>
                            current.status !== "ready" || current.configEdit === null
                              ? current
                              : {
                                  ...current,
                                  configEdit: {
                                    ...current.configEdit,
                                    draftValue: event.target.value,
                                  },
                                },
                          )
                        }
                        onKeyDown={(event) => {
                          const action = resolveInlineConfigEditKeyboardAction({
                            key: event.key,
                            shiftKey: event.shiftKey,
                          });
                          if (action === "none") {
                            return;
                          }
                          event.preventDefault();
                          if (action === "save") {
                            void saveCouncilConfigEdit();
                          } else {
                            closeCouncilConfigEdit(false);
                          }
                        }}
                        ref={(element) => {
                          councilConfigEditInputRef.current = element;
                        }}
                        rows={3}
                        value={configEditDraftValue}
                      />
                      <div className="flex justify-end">
                        <Button
                          disabled={state.isSavingConfigField}
                          onClick={() => void saveCouncilConfigEdit()}
                        >
                          {state.isSavingConfigField ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 p-3">
                      <p className="flex-1 text-sm">{council.goal ?? "None set"}</p>
                      <Button
                        aria-label="Edit goal"
                        disabled={state.configEdit !== null || council.archived}
                        onClick={() => openCouncilConfigEdit("goal")}
                        size="sm"
                        variant="ghost"
                      >
                        ✎
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Tags</Label>
                  {configEditField === "tags" ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {configEditTags.map((tag) => (
                          <Badge className="gap-1" key={tag} variant="secondary">
                            {tag}
                            <button
                              aria-label={`Remove tag ${tag}`}
                              className="ml-1 hover:text-destructive"
                              onClick={() => removeTagFromCouncilConfigEdit(tag)}
                              type="button"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                        {configEditTags.length === 0 ? (
                          <span className="text-sm italic text-muted-foreground">No tags yet</span>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          onChange={(event) =>
                            setState((current) =>
                              current.status !== "ready"
                                ? current
                                : { ...current, configTagInput: event.target.value },
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addTagToCouncilConfigEdit();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              closeCouncilConfigEdit(false);
                            }
                          }}
                          placeholder="Add tag"
                          value={state.configTagInput}
                        />
                        <Button
                          disabled={!state.configTagInput.trim()}
                          onClick={addTagToCouncilConfigEdit}
                          variant="outline"
                        >
                          Add
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Press Enter to add. Max {COUNCIL_CONFIG_MAX_TAGS} tags.
                      </p>
                      <div className="flex justify-end">
                        <Button
                          disabled={state.isSavingConfigField}
                          onClick={() => void saveCouncilConfigEdit()}
                        >
                          {state.isSavingConfigField ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 p-3">
                      <div className="flex flex-1 flex-wrap gap-2">
                        {council.tags.length > 0 ? (
                          council.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm italic text-muted-foreground">None</span>
                        )}
                      </div>
                      <Button
                        aria-label="Edit tags"
                        disabled={state.configEdit !== null || council.archived}
                        onClick={() => openCouncilConfigEdit("tags")}
                        size="sm"
                        variant="ghost"
                      >
                        ✎
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Conductor Model</Label>
                  {configEditField === "conductorModel" ? (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Select
                          onValueChange={(value) =>
                            setState((current) =>
                              current.status !== "ready" || current.configEdit === null
                                ? current
                                : {
                                    ...current,
                                    configEdit: {
                                      ...current.configEdit,
                                      draftValue: value === "__global_default__" ? "" : value,
                                    },
                                  },
                            )
                          }
                          value={councilViewConductorSelectValue}
                        >
                          <SelectTrigger
                            className="flex-1"
                            ref={(element) => {
                              councilConfigEditInputRef.current = element;
                            }}
                          >
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {hasUnavailableConductorSelectionInView ? (
                              <SelectItem value={configEditDraftValue}>
                                Unavailable ({configEditDraftValue})
                              </SelectItem>
                            ) : null}
                            <SelectItem value="__global_default__">Global default</SelectItem>
                            {Object.entries(state.source.modelCatalog.modelsByProvider).map(
                              ([providerId, modelIds]) => (
                                <SelectGroup key={providerId}>
                                  <SelectLabel>{providerId}</SelectLabel>
                                  {modelIds.map((modelId) => (
                                    <SelectItem
                                      key={`${providerId}:${modelId}`}
                                      value={`${providerId}:${modelId}`}
                                    >
                                      {modelId}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          aria-label="Refresh council conductor model options"
                          className="shrink-0"
                          disabled={
                            state.isRefreshingConfigModels || !state.source.canRefreshModels
                          }
                          onClick={() => void refreshCouncilViewConfigModels()}
                          size="icon"
                          title="Refresh models"
                          type="button"
                          variant="ghost"
                        >
                          ⟳
                        </Button>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          disabled={state.isSavingConfigField}
                          onClick={() => void saveCouncilConfigEdit()}
                        >
                          {state.isSavingConfigField ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-3">
                      <div className="flex flex-1 items-center gap-2">
                        <p className="text-sm">
                          {councilModelLabel(council, state.source.globalDefaultModelRef)}
                        </p>
                        {council.invalidConfig ? (
                          <Badge variant="destructive">Invalid config</Badge>
                        ) : null}
                      </div>
                      <Button
                        aria-label="Edit conductor model"
                        disabled={state.configEdit !== null || council.archived}
                        onClick={() => openCouncilConfigEdit("conductorModel")}
                        size="sm"
                        variant="ghost"
                      >
                        ✎
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="mb-4 font-medium">Actions</h3>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={state.configEdit !== null || state.isExportingTranscript}
                  onClick={() => void exportCouncilTranscript()}
                  variant="outline"
                >
                  {state.isExportingTranscript ? "Exporting..." : "Export Transcript"}
                </Button>
                <Button
                  disabled={
                    state.configEdit !== null ||
                    (!council.archived &&
                      council.mode === "autopilot" &&
                      council.started &&
                      !council.paused)
                  }
                  onClick={() => void setCouncilArchivedFromView(council, !council.archived)}
                  title={
                    !council.archived &&
                    council.mode === "autopilot" &&
                    council.started &&
                    !council.paused
                      ? "Pause Autopilot before archiving this council."
                      : undefined
                  }
                  variant="outline"
                >
                  {council.archived ? "Restore Council" : "Archive Council"}
                </Button>
                <Button
                  disabled={state.configEdit !== null}
                  onClick={() =>
                    setState((current) =>
                      current.status !== "ready"
                        ? current
                        : { ...current, showConfigDeleteDialog: true },
                    )
                  }
                  variant="destructive"
                >
                  Delete Council
                </Button>
              </div>
            </Card>
          </section>
        )}

        <ConfirmDialog
          cancelLabel="Stay"
          confirmLabel="Leave"
          confirmTone="danger"
          message={COUNCIL_VIEW_EXIT_CONFIRMATION_MESSAGE}
          onCancel={() =>
            setState((current) =>
              current.status !== "ready" ? current : { ...current, showLeaveDialog: false },
            )
          }
          onConfirm={() => {
            const exitPlan = buildCouncilViewExitPlan(
              state.source.council,
              state.source.generation,
            );
            void executeLeave({ exitPlan });
          }}
          open={state.showLeaveDialog}
          title="Leave Council View?"
        />
        <ConfirmDialog
          cancelLabel="Keep editing"
          confirmLabel="Discard"
          confirmTone="danger"
          message="Your changes will be lost."
          onCancel={() => {
            setState((current) =>
              current.status !== "ready" ? current : { ...current, showConfigDiscardDialog: false },
            );
            window.setTimeout(() => {
              councilConfigEditInputRef.current?.focus();
            }, 0);
          }}
          onConfirm={() => {
            closeCouncilConfigEdit(true);
          }}
          open={state.showConfigDiscardDialog}
          title="Discard changes?"
        />
        <ConfirmDialog
          confirmLabel="Remove"
          confirmTone="danger"
          message={
            state.pendingMemberRemovalId === null
              ? ""
              : `Remove ${memberNameById.get(state.pendingMemberRemovalId) ?? "this member"}? You can add them again later.`
          }
          onCancel={() =>
            setState((current) =>
              current.status !== "ready"
                ? current
                : { ...current, pendingMemberRemovalId: null, showMemberRemoveDialog: false },
            )
          }
          onConfirm={() => {
            if (state.pendingMemberRemovalId === null) {
              return;
            }
            const memberId = state.pendingMemberRemovalId;
            const nextMemberIds = state.source.council.memberAgentIds.filter(
              (id) => id !== memberId,
            );
            const nextColors = { ...state.source.council.memberColorsByAgentId };
            delete nextColors[memberId];
            void saveCouncilViewMembers({
              memberAgentIds: nextMemberIds,
              memberColorsByAgentId: nextColors,
              successMessage: "Member removed.",
            });
          }}
          open={state.showMemberRemoveDialog}
          title="Remove member?"
        />
        <ConfirmDialog
          confirmLabel="Delete"
          confirmTone="danger"
          message={`Delete council "${council.title}" permanently?`}
          onCancel={() =>
            setState((current) =>
              current.status !== "ready" ? current : { ...current, showConfigDeleteDialog: false },
            )
          }
          onConfirm={() => {
            void deleteCouncilFromView(council);
          }}
          open={state.showConfigDeleteDialog}
          title="Delete council?"
        />

        <AutopilotLimitDialog
          modal={autopilotLimitModal}
          onClose={() => setAutopilotLimitModal(null)}
          onLimitTurnsChange={(checked) =>
            setAutopilotLimitModal((current) =>
              current === null
                ? current
                : { ...current, limitTurns: checked, validationMessage: "" },
            )
          }
          onMaxTurnsInputChange={(value) =>
            setAutopilotLimitModal((current) =>
              current === null
                ? current
                : { ...current, maxTurnsInput: value, validationMessage: "" },
            )
          }
          onSubmit={() => void submitAutopilotLimitModal()}
          submitLabel={autopilotSubmitLabel}
        />
      </div>
    </main>
  );
};
