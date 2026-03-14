import type { JSX } from "react";

import type { AutopilotLimitModalAction } from "../../../shared/app-ui-helpers.js";
import { ConfigTab } from "./ConfigTab";
import type { CouncilConfigEditState } from "./ConfigTab";
import { CouncilRuntimeAlerts } from "./CouncilRuntimeAlerts";
import { CouncilViewDialogs } from "./CouncilViewDialogs";
import { CouncilViewHeader } from "./CouncilViewHeader";
import { CouncilViewTabs } from "./CouncilViewTabs";
import { DiscussionTab } from "./DiscussionTab";
import { OverviewTab } from "./OverviewTab";
import { deriveCouncilViewScreenState } from "./councilViewScreenDerivedState";
import { type CouncilViewReadyState, MEMBER_COLOR_PALETTE } from "./councilViewScreenState";

type CouncilViewReadyScreenProps = {
  assistantLauncher: JSX.Element;
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
  onSelectTab: (activeTab: "overview" | "config") => void;
  onStart: () => void;
  onSubmitAutopilotDialog: (maxTurns: number | null) => void;
  onSubmitConductor: (content: string) => Promise<boolean>;
  onToggleArchived: (archived: boolean) => Promise<void>;
  onUpdateMemberColor: (params: { memberAgentId: string; color: string }) => void;
  state: CouncilViewReadyState;
};

export const CouncilViewReadyScreen = ({
  assistantLauncher,
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
      <div className="main-content-inner" data-screen="council-view">
        <CouncilViewHeader
          assistantLauncher={assistantLauncher}
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
        <CouncilRuntimeAlerts
          archived={council.archived}
          archivedMemberNames={archivedMemberNames}
          hasArchivedMembers={hasArchivedMembers}
          invalidConfig={council.invalidConfig}
          message={state.message}
          showMessage={state.message.length > 0 && autopilotRecoveryNotice === null}
        />

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] xl:items-start">
          <div className="space-y-4 lg:sticky lg:top-0">
            <CouncilViewTabs
              activeTab={state.activeTab}
              disableConfigTab={state.isConfigEditing && state.activeTab !== "config"}
              disableOverviewTab={state.isConfigEditing && state.activeTab !== "overview"}
              onSelectTab={onSelectTab}
            />

            {state.activeTab === "overview" ? (
              <OverviewTab
                availableAgents={state.source.availableAgents}
                briefing={state.source.briefing}
                canEditMembers={canEditMembers}
                council={council}
                isGeneratingManualTurn={state.isGeneratingManualTurn}
                isSavingMembers={state.isSavingMembers}
                manualSpeakerDisabledReason={manualSpeakerDisabledReason}
                memberIdsWithMessages={memberIdsWithMessages}
                memberNameById={memberNameById}
                memberPalette={MEMBER_COLOR_PALETTE}
                onAddMember={onAddMember}
                onGenerateManualTurn={onGenerateManualTurn}
                onMemberColorChange={onUpdateMemberColor}
                onRequestRemoveMember={onRequestRemoveMember}
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
          </div>

          <DiscussionTab
            autopilotRecoveryNotice={autopilotRecoveryNotice}
            conductorDisabled={generationRunning || council.archived}
            council={council}
            isCancellingGeneration={state.isCancellingGeneration}
            isConfigEditing={state.isConfigEditing}
            isInjectingConductor={state.isInjectingConductor}
            isStarting={state.isStarting}
            manualRetryNotice={manualRetryNotice}
            messages={state.source.messages}
            onCancelGeneration={onCancelGeneration}
            onStartDiscussion={onStart}
            onSubmitConductor={onSubmitConductor}
            showEmptyStateStart={runtimeControls.showEmptyStateStart}
            showInlineThinkingCancel={showInlineThinkingCancel}
            startDisabled={startDisabled}
            startDisabledReason={startDisabledReason}
            thinkingSpeakerColor={thinkingSpeakerColor}
            thinkingSpeakerName={thinkingSpeakerName}
          />
        </section>

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
