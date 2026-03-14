import { useEffect, useState } from "react";

import type { AutopilotLimitModalAction } from "../../../shared/app-ui-helpers.js";
import { DetailScreenShell } from "../shared/DetailScreenShell";
import { CouncilViewReadyScreen } from "./CouncilViewReadyScreen";
import type { CouncilViewState } from "./councilViewScreenState";
import { useCouncilViewActions } from "./useCouncilViewActions";
import { useCouncilViewDialogHandlers } from "./useCouncilViewDialogHandlers";
import { useCouncilViewScreenLifecycle } from "./useCouncilViewScreenLifecycle";

type CouncilViewScreenProps = {
  assistantExportReconciliation: {
    callId: string;
    councilId: string;
    status: "exported" | "cancelled";
  } | null;
  assistantReloadToken: number;
  assistantLauncher: JSX.Element;
  councilId: string;
  isActive: boolean;
  onAssistantContextChange: (
    snapshot: import("../assistant/assistant-context-builders").AssistantCouncilViewSnapshot | null,
  ) => void;
  onClose: () => void;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
};

export const CouncilViewScreen = ({
  assistantExportReconciliation,
  assistantReloadToken,
  assistantLauncher,
  councilId,
  isActive,
  onAssistantContextChange,
  onClose,
  pushToast,
}: CouncilViewScreenProps): JSX.Element | null => {
  const [state, setState] = useState<CouncilViewState>({ status: "loading" });
  const [autopilotLimitAction, setAutopilotLimitAction] =
    useState<AutopilotLimitModalAction | null>(null);
  const { loadCouncilView } = useCouncilViewScreenLifecycle({
    assistantReloadToken,
    councilId,
    isActive,
    pushToast,
    setState,
    state,
  });

  const {
    addCouncilViewMember,
    cancelCouncilGeneration,
    deleteCouncilFromView,
    executeLeave,
    exportCouncilTranscript,
    generateManualTurn,
    injectConductorMessage,
    leaveSafely,
    openAutopilotLimitModal,
    pauseCouncilRuntime,
    refreshCouncilViewConfigModels,
    saveCouncilConfigEdit,
    saveCouncilViewMembers,
    setCouncilArchivedFromView,
    setCouncilViewMemberColor,
    startCouncilRuntime,
    submitAutopilotLimitModal,
  } = useCouncilViewActions({
    autopilotLimitAction,
    councilId,
    loadCouncilView,
    onClose,
    pushToast,
    setAutopilotLimitAction,
    setState,
    state,
  });
  const {
    onCancelLeave,
    onCancelMemberRemove,
    onCloseAutopilotDialog,
    onConfigEditingChange,
    onConfirmLeave,
    onConfirmMemberRemove,
    onRequestRemoveMember,
    onSelectTab,
    onSubmitAutopilotDialog,
  } = useCouncilViewDialogHandlers({
    executeLeave,
    saveCouncilViewMembers,
    setAutopilotLimitAction,
    setState,
    state,
    submitAutopilotLimitModal,
  });

  useEffect(() => {
    if (state.status !== "ready" || assistantExportReconciliation === null) {
      return;
    }

    if (
      assistantExportReconciliation.councilId !== state.source.council.id ||
      state.assistantExportReconciliation?.callId === assistantExportReconciliation.callId
    ) {
      return;
    }

    setState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            assistantExportReconciliation: {
              callId: assistantExportReconciliation.callId,
              status: assistantExportReconciliation.status,
            },
            message:
              assistantExportReconciliation.status === "exported"
                ? "Transcript export completed."
                : "Export cancelled.",
          },
    );
  }, [assistantExportReconciliation, state]);

  useEffect(() => {
    if (!isActive) {
      onAssistantContextChange(null);
      return;
    }

    if (state.status !== "ready") {
      onAssistantContextChange(null);
      return;
    }

    onAssistantContextChange({
      activeTab: state.activeTab,
      assistantExportReconciliation: state.assistantExportReconciliation,
      archived: state.source.council.archived,
      autopilotMaxTurns: state.source.council.autopilotMaxTurns,
      autopilotTurnsCompleted: state.source.council.autopilotTurnsCompleted,
      councilId: state.source.council.id,
      generationStatus: state.source.generation.status,
      hasBriefing: state.source.briefing !== null,
      invalidConfig: state.source.council.invalidConfig,
      memberCount: state.source.council.memberAgentIds.length,
      messageCount: state.source.messages.length,
      mode: state.source.council.mode,
      paused: state.source.council.paused,
      plannedNextSpeakerAgentId: state.source.generation.plannedNextSpeakerAgentId,
      runtimeLeaseEpoch: assistantReloadToken,
      runtimeLeaseId: state.source.assistantRuntimeLeaseId,
      started: state.source.council.started,
      title: state.source.council.title,
      turnCount: state.source.council.turnCount,
    });
  }, [assistantReloadToken, isActive, onAssistantContextChange, state]);

  if (!isActive) {
    return null;
  }
  if (state.status === "loading") {
    return (
      <DetailScreenShell
        assistantLauncher={assistantLauncher}
        onBack={() => void leaveSafely()}
        statusMessage="Loading council view..."
        title="Council View"
      />
    );
  }
  if (state.status === "error") {
    return (
      <DetailScreenShell
        assistantLauncher={assistantLauncher}
        onBack={() => void leaveSafely()}
        statusMessage={`Error: ${state.message}`}
        title="Council View"
      />
    );
  }

  return (
    <CouncilViewReadyScreen
      assistantLauncher={assistantLauncher}
      autopilotLimitAction={autopilotLimitAction}
      onAddMember={(memberAgentId) => void addCouncilViewMember(memberAgentId)}
      onBack={() => void leaveSafely()}
      onCancelGeneration={() => void cancelCouncilGeneration()}
      onCancelLeave={onCancelLeave}
      onCancelMemberRemove={onCancelMemberRemove}
      onCloseAutopilotDialog={onCloseAutopilotDialog}
      onConfigEditingChange={onConfigEditingChange}
      onConfirmLeave={onConfirmLeave}
      onConfirmMemberRemove={onConfirmMemberRemove}
      onDeleteCouncil={() => deleteCouncilFromView(state.source.council)}
      onExportTranscript={exportCouncilTranscript}
      onGenerateManualTurn={(memberAgentId) => void generateManualTurn(memberAgentId)}
      onPause={() => void pauseCouncilRuntime()}
      onRefreshModelCatalog={refreshCouncilViewConfigModels}
      onRequestRemoveMember={onRequestRemoveMember}
      onResume={() => openAutopilotLimitModal("resume")}
      onSaveField={saveCouncilConfigEdit}
      onSelectTab={onSelectTab}
      onStart={() => void startCouncilRuntime()}
      onSubmitAutopilotDialog={onSubmitAutopilotDialog}
      onSubmitConductor={injectConductorMessage}
      onToggleArchived={(archived) => setCouncilArchivedFromView(state.source.council, archived)}
      onUpdateMemberColor={(params) => void setCouncilViewMemberColor(params)}
      state={state}
    />
  );
};
