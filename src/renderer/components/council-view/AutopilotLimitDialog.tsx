import type { JSX } from "react";

import {
  AUTOPILOT_MAX_TURNS_MAX,
  AUTOPILOT_MAX_TURNS_MIN,
  type AutopilotLimitModalState,
} from "../../../shared/app-ui-helpers.js";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type AutopilotLimitDialogProps = {
  modal: AutopilotLimitModalState | null;
  onClose: () => void;
  onLimitTurnsChange: (checked: boolean) => void;
  onMaxTurnsInputChange: (value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
};

export const AutopilotLimitDialog = ({
  modal,
  onClose,
  onLimitTurnsChange,
  onMaxTurnsInputChange,
  onSubmit,
  submitLabel,
}: AutopilotLimitDialogProps): JSX.Element => {
  const title = modal?.action === "start" ? "Start Autopilot" : "Resume Autopilot";

  return (
    <Dialog onOpenChange={(open) => (!open ? onClose() : undefined)} open={modal !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Set an optional turn limit for this run.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <input
              checked={modal?.limitTurns ?? false}
              className="h-4 w-4 rounded border-gray-300"
              id="autopilot-limit-toggle"
              onChange={(event) => onLimitTurnsChange(event.target.checked)}
              type="checkbox"
            />
            <Label htmlFor="autopilot-limit-toggle">Limit turns</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="autopilot-max-turns-input">
              Max turns ({AUTOPILOT_MAX_TURNS_MIN}-{AUTOPILOT_MAX_TURNS_MAX})
            </Label>
            <Input
              disabled={!(modal?.limitTurns ?? false)}
              id="autopilot-max-turns-input"
              min={AUTOPILOT_MAX_TURNS_MIN}
              onChange={(event) => onMaxTurnsInputChange(event.target.value)}
              placeholder="e.g. 12"
              type="number"
              value={modal?.maxTurnsInput ?? ""}
            />
          </div>
          {modal?.validationMessage ? (
            <p className="text-sm text-muted-foreground">{modal.validationMessage}</p>
          ) : null}
        </div>
        <DialogFooter className="flex gap-2">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button onClick={onSubmit}>{submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
