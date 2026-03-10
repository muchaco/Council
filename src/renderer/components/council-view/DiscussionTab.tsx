import type { JSX } from "react";

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
  autopilotRecoveryNotice: CouncilRuntimeNotice | null;
  availableAgents: ReadonlyArray<CouncilAgentOptionDto>;
  briefing: CouncilRuntimeBriefingDto | null;
  canEditMembers: boolean;
  conductorDisabled: boolean;
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
  onGenerateManualTurn: (memberAgentId: string) => void;
  onMemberColorChange: (params: { memberAgentId: string; color: string }) => void;
  onRequestRemoveMember: (memberAgentId: string) => void;
  onStartDiscussion: () => void;
  onSubmitConductor: (content: string) => Promise<boolean>;
  showEmptyStateStart: boolean;
  showInlineThinkingCancel: boolean;
  startDisabled: boolean;
  startDisabledReason?: string;
  thinkingSpeakerColor: string | null;
  thinkingSpeakerName: string | null;
};

export const DiscussionTab = ({
  autopilotRecoveryNotice,
  availableAgents,
  briefing,
  canEditMembers,
  conductorDisabled,
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
  onGenerateManualTurn,
  onMemberColorChange,
  onRequestRemoveMember,
  onStartDiscussion,
  onSubmitConductor,
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
        councilMode={council.mode}
        isCancellingGeneration={isCancellingGeneration}
        isConfigEditing={isConfigEditing}
        isStarting={isStarting}
        manualRetryNotice={manualRetryNotice}
        memberColorsByAgentId={council.memberColorsByAgentId}
        messages={messages}
        onCancelGeneration={onCancelGeneration}
        onStartDiscussion={onStartDiscussion}
        showEmptyStateStart={showEmptyStateStart}
        showInlineThinkingCancel={showInlineThinkingCancel}
        startDisabled={startDisabled}
        startDisabledReason={startDisabledReason}
        thinkingSpeakerColor={thinkingSpeakerColor}
        thinkingSpeakerName={thinkingSpeakerName}
      />

      <ConductorComposerCard
        key={`${council.id}:${messages.length}:${council.turnCount}`}
        disabled={conductorDisabled}
        isInjectingConductor={isInjectingConductor}
        onSubmit={onSubmitConductor}
      />
    </div>

    <div className="space-y-6">
      <BriefingCard briefing={briefing} />

      <MembersCard
        key={council.memberAgentIds.join("|")}
        availableAgents={availableAgents}
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
        onRequestRemoveMember={onRequestRemoveMember}
      />
    </div>
  </section>
);
