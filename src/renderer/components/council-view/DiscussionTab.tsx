import type { JSX } from "react";

import type { CouncilRuntimeNotice } from "../../../shared/council-view-autopilot-recovery.js";
import type { CouncilDto, CouncilMessageDto } from "../../../shared/ipc/dto";
import { ConductorComposerCard } from "./ConductorComposerCard";
import { TranscriptCard } from "./TranscriptCard";

type DiscussionTabProps = {
  autopilotRecoveryNotice: CouncilRuntimeNotice | null;
  conductorDisabled: boolean;
  council: CouncilDto;
  isCancellingGeneration: boolean;
  isConfigEditing: boolean;
  isInjectingConductor: boolean;
  isStarting: boolean;
  manualRetryNotice: CouncilRuntimeNotice | null;
  messages: ReadonlyArray<CouncilMessageDto>;
  onCancelGeneration: () => void;
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
  conductorDisabled,
  council,
  isCancellingGeneration,
  isConfigEditing,
  isInjectingConductor,
  isStarting,
  manualRetryNotice,
  messages,
  onCancelGeneration,
  onStartDiscussion,
  onSubmitConductor,
  showEmptyStateStart,
  showInlineThinkingCancel,
  startDisabled,
  startDisabledReason,
  thinkingSpeakerColor,
  thinkingSpeakerName,
}: DiscussionTabProps): JSX.Element => (
  <section className="space-y-4" id="council-view-panel-chat">
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
  </section>
);
