import type { JSX, MutableRefObject, KeyboardEvent as ReactKeyboardEvent } from "react";

import type { CouncilRuntimeNotice } from "../../../shared/council-view-autopilot-recovery.js";
import type {
  CouncilAgentOptionDto,
  CouncilDto,
  CouncilMessageDto,
  CouncilRuntimeBriefingDto,
} from "../../../shared/ipc/dto";
import { BriefingCard } from "./BriefingCard";
import { ConductorComposerCard } from "./ConductorComposerCard";
import { MembersCard } from "./MembersCard";
import { TranscriptCard } from "./TranscriptCard";

type DiscussionTabProps = {
  addMemberEmptyStateMessage: string;
  addMemberSearchText: string;
  addableAgents: ReadonlyArray<CouncilAgentOptionDto>;
  autopilotRecoveryNotice: CouncilRuntimeNotice | null;
  availableAgentById: ReadonlyMap<string, CouncilAgentOptionDto>;
  briefing: CouncilRuntimeBriefingDto | null;
  canEditMembers: boolean;
  chatEndRef: MutableRefObject<HTMLDivElement | null>;
  conductorDisabled: boolean;
  conductorDraft: string;
  council: CouncilDto;
  isCancellingGeneration: boolean;
  isConfigEditing: boolean;
  isGeneratingManualTurn: boolean;
  isInjectingConductor: boolean;
  isSavingMembers: boolean;
  isStarting: boolean;
  manualRetryNotice: CouncilRuntimeNotice | null;
  manualSpeakerDisabledReason: string | null;
  memberIdsWithMessages: ReadonlySet<string>;
  memberNameById: ReadonlyMap<string, string>;
  memberPalette: ReadonlyArray<string>;
  messages: ReadonlyArray<CouncilMessageDto>;
  onAddMember: (memberAgentId: string) => void;
  onCancelGeneration: () => void;
  onChangeConductorDraft: (value: string) => void;
  onGenerateManualTurn: (memberAgentId: string) => void;
  onMemberColorChange: (params: { memberAgentId: string; color: string }) => void;
  onMemberSearchTextChange: (value: string) => void;
  onRequestRemoveMember: (memberAgentId: string) => void;
  onStartDiscussion: () => void;
  onSubmitConductor: () => void;
  onToggleAddMemberPanel: () => void;
  onTranscriptRowKeyDown: (event: ReactKeyboardEvent<HTMLElement>, currentIndex: number) => void;
  registerTranscriptRowRef: (currentIndex: number, element: HTMLElement | null) => void;
  showAddMemberPanel: boolean;
  showEmptyStateStart: boolean;
  showInlineThinkingCancel: boolean;
  startDisabled: boolean;
  startDisabledReason?: string;
  thinkingSpeakerColor: string | null;
  thinkingSpeakerName: string | null;
};

export const DiscussionTab = ({
  addMemberEmptyStateMessage,
  addMemberSearchText,
  addableAgents,
  autopilotRecoveryNotice,
  availableAgentById,
  briefing,
  canEditMembers,
  chatEndRef,
  conductorDisabled,
  conductorDraft,
  council,
  isCancellingGeneration,
  isConfigEditing,
  isGeneratingManualTurn,
  isInjectingConductor,
  isSavingMembers,
  isStarting,
  manualRetryNotice,
  manualSpeakerDisabledReason,
  memberIdsWithMessages,
  memberNameById,
  memberPalette,
  messages,
  onAddMember,
  onCancelGeneration,
  onChangeConductorDraft,
  onGenerateManualTurn,
  onMemberColorChange,
  onMemberSearchTextChange,
  onRequestRemoveMember,
  onStartDiscussion,
  onSubmitConductor,
  onToggleAddMemberPanel,
  onTranscriptRowKeyDown,
  registerTranscriptRowRef,
  showAddMemberPanel,
  showEmptyStateStart,
  showInlineThinkingCancel,
  startDisabled,
  startDisabledReason,
  thinkingSpeakerColor,
  thinkingSpeakerName,
}: DiscussionTabProps): JSX.Element => (
  <section
    aria-labelledby="council-view-tab-discussion"
    className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]"
    id="council-view-panel-discussion"
    role="tabpanel"
  >
    <div className="space-y-6">
      <TranscriptCard
        autopilotRecoveryNotice={autopilotRecoveryNotice}
        chatEndRef={chatEndRef}
        councilMode={council.mode}
        isCancellingGeneration={isCancellingGeneration}
        isConfigEditing={isConfigEditing}
        isStarting={isStarting}
        manualRetryNotice={manualRetryNotice}
        memberColorsByAgentId={council.memberColorsByAgentId}
        messages={messages}
        onCancelGeneration={onCancelGeneration}
        onStartDiscussion={onStartDiscussion}
        onTranscriptRowKeyDown={onTranscriptRowKeyDown}
        registerTranscriptRowRef={registerTranscriptRowRef}
        showEmptyStateStart={showEmptyStateStart}
        showInlineThinkingCancel={showInlineThinkingCancel}
        startDisabled={startDisabled}
        startDisabledReason={startDisabledReason}
        thinkingSpeakerColor={thinkingSpeakerColor}
        thinkingSpeakerName={thinkingSpeakerName}
      />

      <ConductorComposerCard
        conductorDraft={conductorDraft}
        disabled={conductorDisabled}
        isInjectingConductor={isInjectingConductor}
        onChangeDraft={onChangeConductorDraft}
        onSubmit={onSubmitConductor}
      />
    </div>

    <div className="space-y-6">
      <BriefingCard briefing={briefing} />

      <MembersCard
        addMemberEmptyStateMessage={addMemberEmptyStateMessage}
        addMemberSearchText={addMemberSearchText}
        addableAgents={addableAgents}
        availableAgentById={availableAgentById}
        canEditMembers={canEditMembers}
        council={council}
        isGeneratingManualTurn={isGeneratingManualTurn}
        isSavingMembers={isSavingMembers}
        manualSpeakerDisabledReason={manualSpeakerDisabledReason}
        memberIdsWithMessages={memberIdsWithMessages}
        memberNameById={memberNameById}
        memberPalette={memberPalette}
        onAddMember={onAddMember}
        onGenerateManualTurn={onGenerateManualTurn}
        onMemberColorChange={onMemberColorChange}
        onMemberSearchTextChange={onMemberSearchTextChange}
        onRequestRemoveMember={onRequestRemoveMember}
        onToggleAddMemberPanel={onToggleAddMemberPanel}
        showAddMemberPanel={showAddMemberPanel}
      />
    </div>
  </section>
);
