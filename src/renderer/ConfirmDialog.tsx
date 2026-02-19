import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { resolveConfirmDialogKeyboardAction } from "../shared/app-ui-helpers";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmTone?: "danger" | "cta" | "secondary";
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmTone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null => {
  if (!open) {
    return null;
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>): void => {
    const action = resolveConfirmDialogKeyboardAction(event.key);
    if (action === "cancel") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (action === "confirm") {
      event.preventDefault();
      onConfirm();
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <dialog aria-modal="true" className="modal-panel" onKeyDown={handleKeyDown} open>
        <h2>{title}</h2>
        <p className="meta">{message}</p>
        <div className="button-row">
          <button className={confirmTone} onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
          <button className="secondary" onClick={onCancel} type="button">
            {cancelLabel}
          </button>
        </div>
      </dialog>
    </div>
  );
};
