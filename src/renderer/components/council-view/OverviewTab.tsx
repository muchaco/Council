import type { JSX } from "react";

import type {
  CouncilAgentOptionDto,
  CouncilDto,
  CouncilRuntimeBriefingDto,
} from "../../../shared/ipc/dto";
import { BriefingCard } from "./BriefingCard";
import { MembersCard } from "./MembersCard";

type OverviewTabProps = {
  availableAgents: ReadonlyArray<CouncilAgentOptionDto>;
  briefing: CouncilRuntimeBriefingDto | null;
  canEditMembers: boolean;
  council: CouncilDto;
  isGeneratingManualTurn: boolean;
  isSavingMembers: boolean;
  manualSpeakerDisabledReason: string | null;
  memberIdsWithMessages: ReadonlySet<string>;
  memberNameById: ReadonlyMap<string, string>;
  memberPalette: ReadonlyArray<string>;
  onAddMember: (memberAgentId: string) => void;
  onGenerateManualTurn: (memberAgentId: string) => void;
  onMemberColorChange: (params: { memberAgentId: string; color: string }) => void;
  onRequestRemoveMember: (memberAgentId: string) => void;
};

export const OverviewTab = ({
  availableAgents,
  briefing,
  canEditMembers,
  council,
  isGeneratingManualTurn,
  isSavingMembers,
  manualSpeakerDisabledReason,
  memberIdsWithMessages,
  memberNameById,
  memberPalette,
  onAddMember,
  onGenerateManualTurn,
  onMemberColorChange,
  onRequestRemoveMember,
}: OverviewTabProps): JSX.Element => (
  <section
    aria-labelledby="council-view-tab-overview"
    className="space-y-4"
    id="council-view-panel-overview"
    role="tabpanel"
  >
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
  </section>
);
