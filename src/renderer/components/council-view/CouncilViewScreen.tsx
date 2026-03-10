import { useState } from "react";

import type { AutopilotLimitModalAction } from "../../../shared/app-ui-helpers.js";
import { DetailScreenShell } from "../shared/DetailScreenShell";
import { ConfigTab } from "./ConfigTab";
import { CouncilRuntimeAlerts } from "./CouncilRuntimeAlerts";
import { CouncilViewDialogs } from "./CouncilViewDialogs";
import { CouncilViewHeader } from "./CouncilViewHeader";
import { CouncilViewTabs } from "./CouncilViewTabs";
import { DiscussionTab } from "./DiscussionTab";
import { deriveCouncilViewScreenState } from "./councilViewScreenDerivedState";
import { type CouncilViewState, MEMBER_COLOR_PALETTE } from "./councilViewScreenState";
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

  const council = state.source.council;
  const {
    archivedMemberNames,
    autopilotRecoveryNotice,
    autopilotSubmitLabel,
    canEditMembers,
    generationActive,
    generationRunning,
    hasArchivedMembers,
    manualRetryNotice,
    manualSpeakerDisabledReason,
    memberIdsWithMessages,
    memberNameById,
    pausedNextSpeakerName,
    runtimeControls,
    showInlineThinkingCancel,
    startDisabled,
    startDisabledReason,
    thinkingSpeakerColor,
    thinkingSpeakerName,
  } = deriveCouncilViewScreenState({
    autopilotLimitAction,
    availableAgents: state.source.availableAgents,
    council,
    generation: state.source.generation,
    isConfigEditing: state.isConfigEditing,
    isGeneratingManualTurn: state.isGeneratingManualTurn,
    isResuming: state.isResuming,
    isStarting: state.isStarting,
    memberPalette: MEMBER_COLOR_PALETTE,
    messages: state.source.messages,
    pendingManualMemberAgentId: state.pendingManualMemberAgentId,
    runtimeError: state.runtimeError,
  });
  const runtimeBriefing = state.source.briefing;

  return (
    <main className="main-content">
      <div className="main-content-inner">
        <CouncilViewHeader
          autopilotLimitModalOpen={autopilotLimitAction !== null}
          autopilotMaxTurns={council.autopilotMaxTurns}
          autopilotTurnsCompleted={council.autopilotTurnsCompleted}
          cancelDisabled={state.isCancellingGeneration || state.isConfigEditing}
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
          pauseDisabled={state.isPausing || state.isConfigEditing}
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
          disableConfigTab={state.isConfigEditing && state.activeTab !== "config"}
          disableDiscussionTab={state.isConfigEditing && state.activeTab !== "discussion"}
          onSelectTab={onSelectTab}
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
            autopilotRecoveryNotice={autopilotRecoveryNotice}
            availableAgents={state.source.availableAgents}
            briefing={runtimeBriefing}
            canEditMembers={canEditMembers}
            conductorDisabled={generationRunning || council.archived}
            council={council}
            isCancellingGeneration={state.isCancellingGeneration}
            isConfigEditing={state.isConfigEditing}
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
            onGenerateManualTurn={(memberAgentId) => void generateManualTurn(memberAgentId)}
            onMemberColorChange={(params) => void setCouncilViewMemberColor(params)}
            onRequestRemoveMember={onRequestRemoveMember}
            onStartDiscussion={() => void startCouncilRuntime()}
            onSubmitConductor={injectConductorMessage}
            showEmptyStateStart={runtimeControls.showEmptyStateStart}
            showInlineThinkingCancel={showInlineThinkingCancel}
            startDisabled={startDisabled}
            startDisabledReason={startDisabledReason}
            thinkingSpeakerColor={thinkingSpeakerColor}
            thinkingSpeakerName={thinkingSpeakerName}
          />
        ) : (
          <ConfigTab
            archiveDisabled={
              !council.archived &&
              council.mode === "autopilot" &&
              council.started &&
              !council.paused
            }
            archiveDisabledReason={
              !council.archived &&
              council.mode === "autopilot" &&
              council.started &&
              !council.paused
                ? "Pause Autopilot before archiving this council."
                : undefined
            }
            canRefreshModels={state.source.canRefreshModels}
            council={council}
            globalDefaultModelRef={state.source.globalDefaultModelRef}
            isExportingTranscript={state.isExportingTranscript}
            modelCatalog={state.source.modelCatalog}
            onDeleteCouncil={() => deleteCouncilFromView(council)}
            onEditingChange={onConfigEditingChange}
            onExportTranscript={exportCouncilTranscript}
            onRefreshModelCatalog={refreshCouncilViewConfigModels}
            onSaveField={saveCouncilConfigEdit}
            onToggleArchived={(archived) => setCouncilArchivedFromView(council, archived)}
          />
        )}

        <CouncilViewDialogs
          autopilotLimitAction={autopilotLimitAction}
          leaveDialogOpen={state.showLeaveDialog}
          memberRemoveDialogOpen={state.showMemberRemoveDialog}
          memberRemoveMessage={
            state.pendingMemberRemovalId === null
              ? ""
              : `Remove ${memberNameById.get(state.pendingMemberRemovalId) ?? "this member"}? You can add them again later.`
          }
          onCancelLeave={onCancelLeave}
          onCancelMemberRemove={onCancelMemberRemove}
          onCloseAutopilotDialog={onCloseAutopilotDialog}
          onConfirmLeave={onConfirmLeave}
          onConfirmMemberRemove={onConfirmMemberRemove}
          onSubmitAutopilotDialog={onSubmitAutopilotDialog}
          submitLabel={autopilotSubmitLabel}
        />
      </div>
    </main>
  );
};
