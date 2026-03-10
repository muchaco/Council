import { useState } from "react";

import type { AutopilotLimitModalAction } from "../../../shared/app-ui-helpers.js";
import { DetailScreenShell } from "../shared/DetailScreenShell";
import { CouncilViewReadyScreen } from "./CouncilViewReadyScreen";
import type { CouncilViewState } from "./councilViewScreenState";
import { useCouncilViewActions } from "./useCouncilViewActions";
import { useCouncilViewDialogHandlers } from "./useCouncilViewDialogHandlers";
import { useCouncilViewScreenLifecycle } from "./useCouncilViewScreenLifecycle";

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
  const [autopilotLimitAction, setAutopilotLimitAction] =
    useState<AutopilotLimitModalAction | null>(null);

  const { loadCouncilView } = useCouncilViewScreenLifecycle({
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

  if (!isActive) {
    return null;
  }
  if (state.status === "loading") {
    return (
      <DetailScreenShell
        onBack={() => void leaveSafely()}
        statusMessage="Loading council view..."
        title="Council View"
      />
    );
  }
  if (state.status === "error") {
    return (
      <DetailScreenShell
        onBack={() => void leaveSafely()}
        statusMessage={`Error: ${state.message}`}
        title="Council View"
      />
    );
  }

  return (
    <CouncilViewReadyScreen
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
