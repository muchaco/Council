import type { CouncilAgentOptionDto } from "../../../shared/ipc/dto";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type AddMemberDialogProps = {
  addableAgents: ReadonlyArray<CouncilAgentOptionDto>;
  canEditMembers: boolean;
  emptyStateMessage: string;
  isOpen: boolean;
  isSavingMembers: boolean;
  onAddMember: (memberAgentId: string) => void;
  onOpenChange: (open: boolean) => void;
  onSearchTextChange: (value: string) => void;
  searchText: string;
};

export const AddMemberDialog = ({
  addableAgents,
  canEditMembers,
  emptyStateMessage,
  isOpen,
  isSavingMembers,
  onAddMember,
  onOpenChange,
  onSearchTextChange,
  searchText,
}: AddMemberDialogProps): JSX.Element => (
  <Dialog onOpenChange={onOpenChange} open={isOpen}>
    <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0 sm:max-w-xl">
      <DialogHeader className="border-b px-6 py-5">
        <DialogTitle>Add Member</DialogTitle>
        <DialogDescription>
          Search active agents by title, description, or tag, then add them.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 px-6 py-5">
        <div className="space-y-2">
          <Label htmlFor="council-view-add-member-search">Search active agents</Label>
          <Input
            autoFocus
            id="council-view-add-member-search"
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="Search by title, description, or tag"
            value={searchText}
          />
        </div>
        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {addableAgents.map((agent) => (
            <div
              className="flex items-start justify-between gap-4 rounded-lg border bg-background px-4 py-3"
              data-add-member-option-id={agent.id}
              key={agent.id}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium leading-5">{agent.name}</p>
                <p className="max-h-10 overflow-hidden text-sm text-muted-foreground">
                  {agent.description}
                </p>
                {agent.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {agent.tags.map((tag) => (
                      <span
                        className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        key={`${agent.id}-${tag}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
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
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {emptyStateMessage}
            </p>
          ) : null}
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
