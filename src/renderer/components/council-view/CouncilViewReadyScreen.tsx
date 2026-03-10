import type { JSX } from "react";

import type { AutopilotLimitModalAction } from "../../../shared/app-ui-helpers.js";
import { ConfigTab } from "./ConfigTab";
import type { CouncilConfigEditState } from "./ConfigTab";
import { CouncilRuntimeAlerts } from "./CouncilRuntimeAlerts";
import { CouncilViewDialogs } from "./CouncilViewDialogs";
import { CouncilViewHeader } from "./CouncilViewHeader";
import { CouncilViewTabs } from "./CouncilViewTabs";
import { DiscussionTab } from "./DiscussionTab";
import { deriveCouncilViewScreenState } from "./councilViewScreenDerivedState";
import { type CouncilViewReadyState, MEMBER_COLOR_PALETTE } from "./councilViewScreenState";

type CouncilViewReadyScreenProps = {
  autopilotLimitAction: AutopilotLimitModalAction | null;
  onAddMember: (memberAgentId: string) => void;
  onBack: () => void;
  onCancelGeneration: () => void;
  onCancelLeave: () => void;
  onCancelMemberRemove: () => void;
  onCloseAutopilotDialog: () => void;
  onConfigEditingChange: (isEditing: boolean) => void;
  onConfirmLeave: () => void;
  onConfirmMemberRemove: () => void;
  onDeleteCouncil: () => Promise<void>;
  onExportTranscript: () => Promise<void>;
  onGenerateManualTurn: (memberAgentId: string) => void;
  onPause: () => void;
  onRefreshModelCatalog: () => Promise<void>;
  onRequestRemoveMember: (memberAgentId: string) => void;
  onResume: () => void;
  onSaveField: (configEdit: CouncilConfigEditState) => Promise<boolean>;
  onSelectTab: (activeTab: "discussion" | "config") => void;
  onStart: () => void;
  onSubmitAutopilotDialog: (maxTurns: number | null) => void;
  onSubmitConductor: (content: string) => Promise<boolean>;
  onToggleArchived: (archived: boolean) => Promise<void>;
  onUpdateMemberColor: (params: { memberAgentId: string; color: string }) => void;
  state: CouncilViewReadyState;
};

export const CouncilViewReadyScreen = ({
  autopilotLimitAction,
  onAddMember,
  onBack,
  onCancelGeneration,
  onCancelLeave,
  onCancelMemberRemove,
  onCloseAutopilotDialog,
  onConfigEditingChange,
  onConfirmLeave,
  onConfirmMemberRemove,
  onDeleteCouncil,
  onExportTranscript,
  onGenerateManualTurn,
  onPause,
  onRefreshModelCatalog,
  onRequestRemoveMember,
  onResume,
  onSaveField,
  onSelectTab,
  onStart,
  onSubmitAutopilotDialog,
  onSubmitConductor,
  onToggleArchived,
  onUpdateMemberColor,
  state,
}: CouncilViewReadyScreenProps): JSX.Element => {
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
          onBack={onBack}
          onCancelGeneration={onCancelGeneration}
          onPause={onPause}
          onResume={onResume}
          onStart={onStart}
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
            briefing={state.source.briefing}
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
            onAddMember={onAddMember}
            onCancelGeneration={onCancelGeneration}
            onGenerateManualTurn={onGenerateManualTurn}
            onMemberColorChange={onUpdateMemberColor}
            onRequestRemoveMember={onRequestRemoveMember}
            onStartDiscussion={onStart}
            onSubmitConductor={onSubmitConductor}
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
            onDeleteCouncil={onDeleteCouncil}
            onEditingChange={onConfigEditingChange}
            onExportTranscript={onExportTranscript}
            onRefreshModelCatalog={onRefreshModelCatalog}
            onSaveField={onSaveField}
            onToggleArchived={onToggleArchived}
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
