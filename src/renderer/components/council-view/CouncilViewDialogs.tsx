import type { AutopilotLimitModalAction } from "../../../shared/app-ui-helpers.js";
import { COUNCIL_VIEW_EXIT_CONFIRMATION_MESSAGE } from "../../../shared/council-view-runtime-guards";
import { ConfirmDialog } from "../../ConfirmDialog";
import { AutopilotLimitDialog } from "./AutopilotLimitDialog";

type CouncilViewDialogsProps = {
  autopilotLimitAction: AutopilotLimitModalAction | null;
  leaveDialogOpen: boolean;
  memberRemoveDialogOpen: boolean;
  memberRemoveMessage: string;
  onCancelLeave: () => void;
  onCancelMemberRemove: () => void;
  onCloseAutopilotDialog: () => void;
  onConfirmLeave: () => void;
  onConfirmMemberRemove: () => void;
  onSubmitAutopilotDialog: (maxTurns: number | null) => void;
  submitLabel: string;
};

export const CouncilViewDialogs = ({
  autopilotLimitAction,
  leaveDialogOpen,
  memberRemoveDialogOpen,
  memberRemoveMessage,
  onCancelLeave,
  onCancelMemberRemove,
  onCloseAutopilotDialog,
  onConfirmLeave,
  onConfirmMemberRemove,
  onSubmitAutopilotDialog,
  submitLabel,
}: CouncilViewDialogsProps): JSX.Element => (
  <>
    <ConfirmDialog
      cancelLabel="Stay"
      confirmLabel="Leave"
      confirmTone="danger"
      message={COUNCIL_VIEW_EXIT_CONFIRMATION_MESSAGE}
      onCancel={onCancelLeave}
      onConfirm={onConfirmLeave}
      open={leaveDialogOpen}
      title="Leave Council View?"
    />
    <ConfirmDialog
      confirmLabel="Remove"
      confirmTone="danger"
      message={memberRemoveMessage}
      onCancel={onCancelMemberRemove}
      onConfirm={onConfirmMemberRemove}
      open={memberRemoveDialogOpen}
      title="Remove member?"
    />
    <AutopilotLimitDialog
      action={autopilotLimitAction}
      onClose={onCloseAutopilotDialog}
      onSubmit={onSubmitAutopilotDialog}
      submitLabel={submitLabel}
    />
  </>
);
