import { buildManualSpeakerSelectionAriaLabel } from "../../../shared/council-view-accessibility.js";
import type { CouncilAgentOptionDto, CouncilDto } from "../../../shared/ipc/dto";
import { ColorPicker } from "../ColorPicker";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { AddMemberPanel } from "./AddMemberPanel";

type MembersCardProps = {
  addMemberEmptyStateMessage: string;
  addableAgents: ReadonlyArray<CouncilAgentOptionDto>;
  availableAgentById: ReadonlyMap<string, CouncilAgentOptionDto>;
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
  onMemberSearchTextChange: (value: string) => void;
  onRequestRemoveMember: (memberAgentId: string) => void;
  onToggleAddMemberPanel: () => void;
  showAddMemberPanel: boolean;
  addMemberSearchText: string;
};

export const MembersCard = ({
  addMemberEmptyStateMessage,
  addMemberSearchText,
  addableAgents,
  availableAgentById,
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
  onMemberSearchTextChange,
  onRequestRemoveMember,
  onToggleAddMemberPanel,
  showAddMemberPanel,
}: MembersCardProps): JSX.Element => (
  <Card className="p-6">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-medium">Members ({council.memberAgentIds.length})</h2>
      <Button
        disabled={isSavingMembers || council.archived}
        onClick={onToggleAddMemberPanel}
        size="sm"
        title={!canEditMembers ? "Members cannot be edited right now." : undefined}
        variant="outline"
      >
        {showAddMemberPanel ? "Close" : "Add Member"}
      </Button>
    </div>
    {showAddMemberPanel ? (
      <AddMemberPanel
        addableAgents={addableAgents}
        canEditMembers={canEditMembers}
        emptyStateMessage={addMemberEmptyStateMessage}
        isSavingMembers={isSavingMembers}
        onAddMember={onAddMember}
        onSearchTextChange={onMemberSearchTextChange}
        searchText={addMemberSearchText}
      />
    ) : null}
    <div className="space-y-3">
      {council.memberAgentIds.map((memberAgentId) => {
        const memberName = memberNameById.get(memberAgentId) ?? memberAgentId;
        const memberAgent = availableAgentById.get(memberAgentId);
        const memberArchived = memberAgent?.archived === true;
        const memberHasMessages = memberIdsWithMessages.has(memberAgentId);
        const memberColor =
          council.memberColorsByAgentId[memberAgentId] ?? memberPalette[0] ?? "#0a5c66";
        const removeDisabledReason = council.archived
          ? "Archived councils are read-only."
          : !canEditMembers
            ? "Members cannot be edited right now."
            : memberHasMessages
              ? "Members with transcript messages cannot be removed."
              : council.memberAgentIds.length <= 1
                ? "Councils must keep at least one member."
                : isSavingMembers
                  ? "Wait for the current save to finish."
                  : null;
        const removeReasonId = `member-remove-reason-${memberAgentId}`;

        return (
          <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3" key={memberAgentId}>
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
                colors={memberPalette}
                disabled={!canEditMembers || isSavingMembers}
                id={`member-color-${memberAgentId}`}
                label="Color"
                onChange={(color) => onMemberColorChange({ memberAgentId, color })}
                value={memberColor}
              />
              {council.mode === "manual" ? (
                <Button
                  aria-label={buildManualSpeakerSelectionAriaLabel(memberName)}
                  disabled={manualSpeakerDisabledReason !== null}
                  onClick={() => onGenerateManualTurn(memberAgentId)}
                  size="sm"
                  title={manualSpeakerDisabledReason ?? undefined}
                  variant="outline"
                >
                  {isGeneratingManualTurn ? "Generating..." : "Speak"}
                </Button>
              ) : null}
              <Button
                aria-describedby={removeDisabledReason === null ? undefined : removeReasonId}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={removeDisabledReason !== null}
                onClick={() => onRequestRemoveMember(memberAgentId)}
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
);
