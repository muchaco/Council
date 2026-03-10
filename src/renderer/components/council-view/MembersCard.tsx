import { useMemo, useState } from "react";

import { buildManualSpeakerSelectionAriaLabel } from "../../../shared/council-view-accessibility.js";
import type { CouncilAgentOptionDto, CouncilDto } from "../../../shared/ipc/dto";
import { ColorPicker } from "../ColorPicker";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { AddMemberPanel } from "./AddMemberPanel";

type MembersCardProps = {
  availableAgents: ReadonlyArray<CouncilAgentOptionDto>;
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

export const MembersCard = ({
  availableAgents,
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
}: MembersCardProps): JSX.Element => {
  const [showAddMemberPanel, setShowAddMemberPanel] = useState(false);
  const [searchText, setSearchText] = useState("");
  const availableAgentById = useMemo(
    () => new Map(availableAgents.map((agent) => [agent.id, agent])),
    [availableAgents],
  );
  const normalizedSearchText = searchText.trim().toLowerCase();
  const addableAgents = useMemo(
    () =>
      availableAgents.filter(
        (agent) =>
          !council.memberAgentIds.includes(agent.id) &&
          !agent.archived &&
          (normalizedSearchText.length === 0 ||
            agent.name.toLowerCase().includes(normalizedSearchText) ||
            agent.id.toLowerCase().includes(normalizedSearchText)),
      ),
    [availableAgents, council.memberAgentIds, normalizedSearchText],
  );
  const emptyStateMessage =
    normalizedSearchText.length > 0
      ? "No active agents match that search."
      : "No active agents are available to add.";
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-medium">Members ({council.memberAgentIds.length})</h2>
        <Button
          disabled={isSavingMembers || council.archived}
          onClick={() => setShowAddMemberPanel((current) => !current)}
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
          emptyStateMessage={emptyStateMessage}
          isSavingMembers={isSavingMembers}
          onAddMember={(memberAgentId) => {
            onAddMember(memberAgentId);
            setSearchText("");
          }}
          onSearchTextChange={setSearchText}
          searchText={searchText}
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
};
