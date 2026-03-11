import { useMemo, useState } from "react";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { buildManualSpeakerSelectionAriaLabel } from "../../../shared/council-view-accessibility.js";
import {
  filterAddableAgents,
  resolveAddableAgentsEmptyStateMessage,
} from "../../../shared/council-view-add-member-dialog.js";
import { resolveTranscriptAvatarInitials } from "../../../shared/council-view-transcript.js";
import type { CouncilAgentOptionDto, CouncilDto } from "../../../shared/ipc/dto";
import { ColorPicker } from "../ColorPicker";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { AddMemberDialog } from "./AddMemberDialog";

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
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [searchText, setSearchText] = useState("");
  const availableAgentById = useMemo(
    () => new Map(availableAgents.map((agent) => [agent.id, agent])),
    [availableAgents],
  );
  const addableAgents = useMemo(
    () =>
      filterAddableAgents({
        availableAgents,
        memberAgentIds: council.memberAgentIds,
        searchText,
      }),
    [availableAgents, council.memberAgentIds, searchText],
  );
  const emptyStateMessage = resolveAddableAgentsEmptyStateMessage(searchText);

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Members ({council.memberAgentIds.length})</h2>
        <Button
          aria-label="Add member"
          disabled={isSavingMembers || council.archived}
          className="h-9 w-9"
          onClick={() => setShowAddMemberDialog(true)}
          size="icon"
          title={!canEditMembers ? "Members cannot be edited right now." : undefined}
          variant="outline"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <AddMemberDialog
        addableAgents={addableAgents}
        canEditMembers={canEditMembers}
        emptyStateMessage={emptyStateMessage}
        isOpen={showAddMemberDialog}
        isSavingMembers={isSavingMembers}
        onAddMember={(memberAgentId) => {
          onAddMember(memberAgentId);
          setSearchText("");
          setShowAddMemberDialog(false);
        }}
        onOpenChange={(open) => {
          setShowAddMemberDialog(open);
          if (!open) {
            setSearchText("");
          }
        }}
        onSearchTextChange={setSearchText}
        searchText={searchText}
      />
      <div className="space-y-2.5">
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
            <div
              className="flex items-center gap-3 rounded-lg bg-muted/30 p-2.5"
              key={memberAgentId}
            >
              <Avatar
                className="border-2 border-background shadow-sm"
                style={{
                  backgroundColor: memberColor,
                  boxShadow: `0 0 0 2px ${memberColor}33, 0 0 0 4px ${memberColor}14`,
                }}
              >
                <AvatarFallback className="text-xs font-medium text-white">
                  {resolveTranscriptAvatarInitials(memberName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={memberName}>
                  {memberName}
                </p>
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
                    className="h-9 w-9 shrink-0"
                    disabled={manualSpeakerDisabledReason !== null}
                    onClick={() => onGenerateManualTurn(memberAgentId)}
                    size="icon"
                    title={manualSpeakerDisabledReason ?? undefined}
                    variant="outline"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button
                  aria-describedby={removeDisabledReason === null ? undefined : removeReasonId}
                  aria-label={`Remove ${memberName}`}
                  className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={removeDisabledReason !== null}
                  onClick={() => onRequestRemoveMember(memberAgentId)}
                  size="icon"
                  title={removeDisabledReason ?? `Remove ${memberName}`}
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
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
