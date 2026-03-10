import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  AUTOPILOT_MAX_TURNS_MAX,
  AUTOPILOT_MAX_TURNS_MIN,
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
  buildManualSpeakerSelectionAriaLabel,
  buildTranscriptMessageAriaLabel,
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
  resolveTranscriptAccentColor,
  resolveTranscriptAvatarInitials,
  resolveTranscriptMessageAlignment,
  shouldRenderInlineThinkingCancel,
} from "../../../shared/council-view-transcript.js";
import type { CouncilDto, GetCouncilViewResponse } from "../../../shared/ipc/dto";
import { ConfirmDialog } from "../../ConfirmDialog";
import { ColorPicker } from "../ColorPicker";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
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
  const autopilotDialogTitle =
    autopilotLimitModal?.action === "start" ? "Start Autopilot" : "Resume Autopilot";
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
        <header className="mb-6">
          <div className="mb-6 flex items-center justify-between">
            <Button
              className="gap-2"
              disabled={state.isLeavingView}
              onClick={() => void leaveSafely()}
              variant="outline"
            >
              <ChevronLeft className="h-4 w-4" />
              {state.isLeavingView ? "Leaving..." : "Back"}
            </Button>
            <div className="flex items-center gap-2">
              {runtimeControls.showTopBarStart ? (
                <Button
                  disabled={startDisabled}
                  onClick={() => void startCouncilRuntime()}
                  title={startDisabledReason}
                >
                  {state.isStarting ? "Starting..." : "Start"}
                </Button>
              ) : null}
              {runtimeControls.canPause ? (
                <Button
                  disabled={state.isPausing || state.configEdit !== null}
                  onClick={() => void pauseCouncilRuntime()}
                  variant="outline"
                >
                  {state.isPausing ? "Pausing..." : "Pause"}
                </Button>
              ) : null}
              {runtimeControls.canResume ? (
                <Button
                  disabled={
                    state.isResuming ||
                    council.invalidConfig ||
                    hasArchivedMembers ||
                    autopilotLimitModal !== null ||
                    state.configEdit !== null
                  }
                  onClick={() => openAutopilotLimitModal("resume")}
                  title={
                    council.invalidConfig
                      ? "Fix the model config before resuming."
                      : hasArchivedMembers
                        ? "Restore or remove archived members before resuming."
                        : undefined
                  }
                >
                  {state.isResuming ? "Resuming..." : "Resume"}
                </Button>
              ) : null}
              {(runtimeControls.canStart || runtimeControls.canResume) &&
              (council.invalidConfig || hasArchivedMembers) ? (
                <Badge
                  title={
                    council.invalidConfig
                      ? "Resolved conductor model is unavailable in this view's model catalog snapshot."
                      : "One or more council members are archived."
                  }
                  variant={council.invalidConfig ? "destructive" : "outline"}
                >
                  {council.invalidConfig ? "Invalid config" : "Archived members"}
                </Badge>
              ) : null}
              {generationActive && !showInlineThinkingCancel ? (
                <Button
                  disabled={state.isCancellingGeneration || state.configEdit !== null}
                  onClick={() => void cancelCouncilGeneration()}
                  variant="outline"
                >
                  {state.isCancellingGeneration ? "Cancelling..." : "Cancel"}
                </Button>
              ) : null}
            </div>
          </div>
          <h1 className="mb-2 text-3xl">{council.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Badge className="capitalize" variant="outline">
              {council.mode}
            </Badge>
            <span>{council.started ? (council.paused ? "Paused" : "Running") : "Stopped"}</span>
            <span>Turn {council.turnCount}</span>
            {council.mode === "autopilot" ? (
              <span>
                {council.autopilotTurnsCompleted}/{council.autopilotMaxTurns ?? "∞"} completed
              </span>
            ) : null}
          </div>
          {pausedNextSpeakerName !== null ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Next speaker: {pausedNextSpeakerName}
            </p>
          ) : null}
          <div
            aria-label="Council view tabs"
            className="mt-6 flex items-center gap-1 border-b"
            role="tablist"
          >
            <Button
              aria-controls="council-view-panel-discussion"
              aria-selected={state.activeTab === "discussion"}
              data-state={state.activeTab === "discussion" ? "active" : "inactive"}
              disabled={state.configEdit !== null && state.activeTab !== "discussion"}
              id="council-view-tab-discussion"
              onClick={() =>
                setState((current) =>
                  current.status !== "ready" ? current : { ...current, activeTab: "discussion" },
                )
              }
              role="tab"
              variant={state.activeTab === "discussion" ? "secondary" : "ghost"}
            >
              Discussion
            </Button>
            <Button
              aria-controls="council-view-panel-config"
              aria-selected={state.activeTab === "config"}
              data-state={state.activeTab === "config" ? "active" : "inactive"}
              disabled={state.configEdit !== null && state.activeTab !== "config"}
              id="council-view-tab-config"
              onClick={() =>
                setState((current) =>
                  current.status !== "ready" ? current : { ...current, activeTab: "config" },
                )
              }
              role="tab"
              variant={state.activeTab === "config" ? "secondary" : "ghost"}
            >
              Config
            </Button>
          </div>
        </header>

        {council.archived ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">Archived councils are read-only.</p>
          </div>
        ) : null}
        {hasArchivedMembers ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              This council includes archived members: {archivedMemberNames.join(", ")}. Restore or
              remove them before starting, resuming, or choosing the next speaker.
            </p>
          </div>
        ) : null}
        {council.invalidConfig ? (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              Invalid config: start/resume is blocked until you select an available Conductor model
              or refresh models in Config.
            </p>
          </div>
        ) : null}
        {state.message.length > 0 && autopilotRecoveryNotice === null ? (
          <div className="mb-4 rounded-lg bg-muted p-3">
            <p className="text-sm">{state.message}</p>
          </div>
        ) : null}

        {state.activeTab === "discussion" ? (
          <section
            aria-labelledby="council-view-tab-discussion"
            className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]"
            id="council-view-panel-discussion"
            role="tabpanel"
          >
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="mb-4 text-xl font-medium">Transcript</h2>
                {autopilotRecoveryNotice !== null ? (
                  <div className="mb-4 rounded-lg bg-muted p-3">
                    <p className="font-medium text-sm">{autopilotRecoveryNotice.title}</p>
                    <p className="text-sm">{autopilotRecoveryNotice.body}</p>
                  </div>
                ) : null}
                {manualRetryNotice !== null ? (
                  <div className="mb-4 rounded-lg bg-muted p-3">
                    <p className="font-medium text-sm">{manualRetryNotice.title}</p>
                    <p className="text-sm">{manualRetryNotice.body}</p>
                  </div>
                ) : null}
                {state.source.messages.length === 0 && thinkingSpeakerName === null ? (
                  <div className="rounded-lg bg-muted/50 py-12 text-center">
                    <p className="mb-4 text-muted-foreground">
                      {council.mode === "manual"
                        ? "No messages yet. Choose the next speaker from Members."
                        : "No messages yet."}
                    </p>
                    {runtimeControls.showEmptyStateStart ? (
                      <Button
                        disabled={startDisabled}
                        onClick={() => void startCouncilRuntime()}
                        title={startDisabledReason}
                      >
                        {state.isStarting ? "Starting..." : "Start Discussion"}
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2">
                    {state.source.messages.map((message, index) => (
                      <button
                        aria-label={buildTranscriptMessageAriaLabel(message)}
                        className={`w-full rounded-lg p-3 text-left transition-colors hover:bg-muted/50 ${resolveTranscriptMessageAlignment(message) === "right" ? "bg-muted/30" : ""}`}
                        data-transcript-row-index={index}
                        key={message.id}
                        onKeyDown={(event) =>
                          handleTranscriptRowKeyDown(event, index, transcriptRowCount)
                        }
                        ref={(element) => {
                          transcriptRowRefs.current[index] = element;
                        }}
                        type="button"
                      >
                        <div className="flex gap-3">
                          <Avatar
                            className="flex-shrink-0"
                            style={{
                              backgroundColor: resolveTranscriptAccentColor(
                                message,
                                state.source.council.memberColorsByAgentId,
                              ),
                            }}
                          >
                            <AvatarFallback className="text-sm font-medium text-white">
                              {resolveTranscriptAvatarInitials(message.senderName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {message.senderName}
                                {message.senderKind === "conductor" ? (
                                  <Badge className="ml-2 text-xs" variant="secondary">
                                    Conductor
                                  </Badge>
                                ) : null}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                #{message.sequenceNumber}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-foreground">
                              {message.content}
                            </p>
                            <p
                              className="mt-1 text-xs text-muted-foreground"
                              title={message.createdAtUtc}
                            >
                              {message.createdAtUtc}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                    {thinkingSpeakerName !== null ? (
                      <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                        <Avatar
                          className="flex-shrink-0"
                          style={{ backgroundColor: thinkingSpeakerColor ?? "#0a5c66" }}
                        >
                          <AvatarFallback className="text-sm font-medium text-white">
                            {resolveTranscriptAvatarInitials(thinkingSpeakerName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-sm font-medium">{thinkingSpeakerName}</span>
                            <span className="text-xs text-muted-foreground">Thinking</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                            <span
                              className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                              style={{ animationDelay: "0.1s" }}
                            />
                            <span
                              className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                              style={{ animationDelay: "0.2s" }}
                            />
                          </div>
                        </div>
                        {showInlineThinkingCancel ? (
                          <Button
                            disabled={state.isCancellingGeneration || state.configEdit !== null}
                            onClick={() => void cancelCouncilGeneration()}
                            size="sm"
                            variant="outline"
                          >
                            {state.isCancellingGeneration ? "Cancelling..." : "Cancel"}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h2 className="mb-4 text-xl font-medium">Conductor Message</h2>
                <Textarea
                  disabled={council.archived}
                  onChange={(event) =>
                    setState((current) =>
                      current.status !== "ready"
                        ? current
                        : { ...current, conductorDraft: event.target.value },
                    )
                  }
                  placeholder="Type your message as conductor..."
                  rows={4}
                  value={state.conductorDraft}
                />
                <div className="mt-4 flex justify-end">
                  <Button
                    disabled={
                      state.isInjectingConductor ||
                      generationRunning ||
                      council.archived ||
                      !state.conductorDraft.trim()
                    }
                    onClick={() => void injectConductorMessage()}
                  >
                    {state.isInjectingConductor ? "Sending..." : "Send as Conductor"}
                  </Button>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="mb-4 text-xl font-medium">Briefing</h2>
                {runtimeBriefing === null ? (
                  <p className="text-sm italic text-muted-foreground">
                    Briefing not generated yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                        Summary
                      </p>
                      <p className="text-sm">{runtimeBriefing.briefing}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Goal status:</span>
                      <Badge variant={runtimeBriefing.goalReached ? "default" : "secondary"}>
                        {runtimeBriefing.goalReached ? "Reached" : "In progress"}
                      </Badge>
                    </div>
                    {runtimeBriefing.goalReached ? (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                        <p className="mb-1 text-sm font-medium text-green-800">Goal reached</p>
                        <p className="text-xs text-green-700">
                          The latest briefing reports this council has reached its stated goal.
                        </p>
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Updated: {runtimeBriefing.updatedAtUtc}
                    </p>
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-medium">Members ({council.memberAgentIds.length})</h2>
                  <Button
                    disabled={state.isSavingMembers || council.archived}
                    onClick={() =>
                      setState((current) =>
                        current.status !== "ready"
                          ? current
                          : { ...current, showAddMemberPanel: !current.showAddMemberPanel },
                      )
                    }
                    size="sm"
                    title={!canEditMembers ? "Members cannot be edited right now." : undefined}
                    variant="outline"
                  >
                    {state.showAddMemberPanel ? "Close" : "Add Member"}
                  </Button>
                </div>
                {state.showAddMemberPanel ? (
                  <div className="mb-4 rounded-lg bg-muted/50 p-4">
                    <Label className="mb-2 block" htmlFor="council-view-add-member-search">
                      Search active agents
                    </Label>
                    <Input
                      className="mb-3"
                      id="council-view-add-member-search"
                      onChange={(event) =>
                        setState((current) =>
                          current.status !== "ready"
                            ? current
                            : { ...current, addMemberSearchText: event.target.value },
                        )
                      }
                      placeholder="Search by name or ID"
                      value={state.addMemberSearchText}
                    />
                    <div className="max-h-[200px] space-y-2 overflow-y-auto">
                      {addableAgents.map((agent) => (
                        <div
                          className="flex items-center justify-between rounded border bg-background p-2"
                          key={agent.id}
                        >
                          <div>
                            <p className="text-sm font-medium">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">{agent.id}</p>
                          </div>
                          <Button
                            disabled={!canEditMembers || state.isSavingMembers}
                            onClick={() => void addCouncilViewMember(agent.id)}
                            size="sm"
                            variant="outline"
                          >
                            Add
                          </Button>
                        </div>
                      ))}
                      {addableAgents.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          {addMemberEmptyStateMessage}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="space-y-3">
                  {council.memberAgentIds.map((memberAgentId) => {
                    const memberName = memberNameById.get(memberAgentId) ?? memberAgentId;
                    const memberAgent = availableAgentById.get(memberAgentId);
                    const memberArchived = memberAgent?.archived === true;
                    const memberHasMessages = memberIdsWithMessages.has(memberAgentId);
                    const memberColor =
                      council.memberColorsByAgentId[memberAgentId] ??
                      MEMBER_COLOR_PALETTE[0] ??
                      "#0a5c66";
                    const removeDisabledReason = council.archived
                      ? "Archived councils are read-only."
                      : !canEditMembers
                        ? "Members cannot be edited right now."
                        : memberHasMessages
                          ? "Members with transcript messages cannot be removed."
                          : council.memberAgentIds.length <= 1
                            ? "Councils must keep at least one member."
                            : state.isSavingMembers
                              ? "Wait for the current save to finish."
                              : null;
                    const removeReasonId = `member-remove-reason-${memberAgentId}`;
                    return (
                      <div
                        className="flex items-center gap-3 rounded-lg bg-muted/30 p-3"
                        key={memberAgentId}
                      >
                        <Avatar style={{ backgroundColor: memberColor }}>
                          <AvatarFallback className="text-xs font-medium text-white">
                            {memberName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{memberName}</p>
                          <p className="truncate text-xs text-muted-foreground">{memberAgentId}</p>
                          {memberArchived ? (
                            <p className="text-xs text-amber-700">
                              Archived - restore or remove before runtime.
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <ColorPicker
                            colors={MEMBER_COLOR_PALETTE}
                            disabled={!canEditMembers || state.isSavingMembers}
                            id={`member-color-${memberAgentId}`}
                            label="Color"
                            onChange={(color) =>
                              void setCouncilViewMemberColor({ memberAgentId, color })
                            }
                            value={memberColor}
                          />
                          {council.mode === "manual" ? (
                            <Button
                              aria-label={buildManualSpeakerSelectionAriaLabel(memberName)}
                              disabled={manualSpeakerDisabledReason !== null}
                              onClick={() => void generateManualTurn(memberAgentId)}
                              size="sm"
                              title={manualSpeakerDisabledReason ?? undefined}
                              variant="outline"
                            >
                              {state.isGeneratingManualTurn ? "Generating..." : "Speak"}
                            </Button>
                          ) : null}
                          <Button
                            aria-describedby={
                              removeDisabledReason === null ? undefined : removeReasonId
                            }
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={removeDisabledReason !== null}
                            onClick={() =>
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
                            size="sm"
                            variant="ghost"
                          >
                            Remove
                          </Button>
                          {removeDisabledReason === null ? null : (
                            <p className="sr-only" id={removeReasonId}>
                              {removeDisabledReason}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </section>
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

        <Dialog
          onOpenChange={() => setAutopilotLimitModal(null)}
          open={autopilotLimitModal !== null}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{autopilotDialogTitle}</DialogTitle>
              <DialogDescription>Set an optional turn limit for this run.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-2">
                <input
                  checked={autopilotLimitModal?.limitTurns ?? false}
                  className="h-4 w-4 rounded border-gray-300"
                  id="autopilot-limit-toggle"
                  onChange={(event) =>
                    setAutopilotLimitModal((current) =>
                      current === null
                        ? current
                        : { ...current, limitTurns: event.target.checked, validationMessage: "" },
                    )
                  }
                  type="checkbox"
                />
                <Label htmlFor="autopilot-limit-toggle">Limit turns</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="autopilot-max-turns-input">
                  Max turns ({AUTOPILOT_MAX_TURNS_MIN}-{AUTOPILOT_MAX_TURNS_MAX})
                </Label>
                <Input
                  disabled={!(autopilotLimitModal?.limitTurns ?? false)}
                  id="autopilot-max-turns-input"
                  min={AUTOPILOT_MAX_TURNS_MIN}
                  onChange={(event) =>
                    setAutopilotLimitModal((current) =>
                      current === null
                        ? current
                        : { ...current, maxTurnsInput: event.target.value, validationMessage: "" },
                    )
                  }
                  placeholder="e.g. 12"
                  type="number"
                  value={autopilotLimitModal?.maxTurnsInput ?? ""}
                />
              </div>
              {autopilotLimitModal?.validationMessage ? (
                <p className="text-sm text-muted-foreground">
                  {autopilotLimitModal.validationMessage}
                </p>
              ) : null}
            </div>
            <DialogFooter className="flex gap-2">
              <Button onClick={() => setAutopilotLimitModal(null)} variant="secondary">
                Cancel
              </Button>
              <Button onClick={() => void submitAutopilotLimitModal()}>
                {autopilotSubmitLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
};
