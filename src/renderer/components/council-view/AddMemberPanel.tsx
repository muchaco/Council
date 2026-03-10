import type { CouncilAgentOptionDto } from "../../../shared/ipc/dto";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type AddMemberPanelProps = {
  addableAgents: ReadonlyArray<CouncilAgentOptionDto>;
  emptyStateMessage: string;
  isSavingMembers: boolean;
  onAddMember: (memberAgentId: string) => void;
  onSearchTextChange: (value: string) => void;
  searchText: string;
  canEditMembers: boolean;
};

export const AddMemberPanel = ({
  addableAgents,
  canEditMembers,
  emptyStateMessage,
  isSavingMembers,
  onAddMember,
  onSearchTextChange,
  searchText,
}: AddMemberPanelProps): JSX.Element => (
  <div className="mb-4 rounded-lg bg-muted/50 p-4">
    <Label className="mb-2 block" htmlFor="council-view-add-member-search">
      Search active agents
    </Label>
    <Input
      className="mb-3"
      id="council-view-add-member-search"
      onChange={(event) => onSearchTextChange(event.target.value)}
      placeholder="Search by name or ID"
      value={searchText}
    />
    <div className="max-h-[200px] space-y-2 overflow-y-auto">
      {addableAgents.map((agent) => (
        <div
          className="flex items-center justify-between rounded border bg-background p-2"
          key={agent.id}
        >
          <div>
            <p className="text-sm font-medium">{agent.name}</p>
            <p className="text-xs text-muted-foreground">{agent.id}</p>
          </div>
          <Button
            disabled={!canEditMembers || isSavingMembers}
            onClick={() => onAddMember(agent.id)}
            size="sm"
            variant="outline"
          >
            Add
          </Button>
        </div>
      ))}
      {addableAgents.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{emptyStateMessage}</p>
      ) : null}
    </div>
  </div>
);
