import { ConfirmDialog } from "../../ConfirmDialog";
import type { CouncilEditorReadyState } from "./councilEditorScreenState";

type CouncilEditorDialogsProps = {
  onCancelDelete: () => void;
  onCancelDiscard: () => void;
  onCancelMemberRemove: () => void;
  onConfirmDelete: () => void;
  onConfirmDiscard: () => void;
  onConfirmMemberRemove: () => void;
  state: CouncilEditorReadyState;
};

export const CouncilEditorDialogs = ({
  onCancelDelete,
  onCancelDiscard,
  onCancelMemberRemove,
  onConfirmDelete,
  onConfirmDiscard,
  onConfirmMemberRemove,
  state,
}: CouncilEditorDialogsProps): JSX.Element => (
  <>
    <ConfirmDialog
      cancelLabel="Keep editing"
      confirmLabel="Discard"
      confirmTone="danger"
      message="Your changes will be lost."
      onCancel={onCancelDiscard}
      onConfirm={onConfirmDiscard}
      open={state.showDiscardDialog}
      title="Discard council changes?"
    />

    <ConfirmDialog
      confirmLabel="Delete"
      confirmTone="danger"
      message={`Delete council "${state.draft.title.trim() || "Untitled council"}" permanently?`}
      onCancel={onCancelDelete}
      onConfirm={onConfirmDelete}
      open={state.showDeleteDialog}
      title="Delete council?"
    />

    <ConfirmDialog
      confirmLabel="Remove"
      confirmTone="danger"
      message={
        state.pendingMemberRemovalId === null
          ? ""
          : `Remove ${state.source.availableAgents.find((agent) => agent.id === state.pendingMemberRemovalId)?.name ?? "this member"}? You can add them again later.`
      }
      onCancel={onCancelMemberRemove}
      onConfirm={onConfirmMemberRemove}
      open={state.showRemoveMemberDialog}
      title="Remove member?"
    />
  </>
);
