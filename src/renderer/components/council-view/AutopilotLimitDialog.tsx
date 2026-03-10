import { useEffect, useState } from "react";

import {
  AUTOPILOT_MAX_TURNS_MAX,
  AUTOPILOT_MAX_TURNS_MIN,
  type AutopilotLimitModalAction,
  createAutopilotLimitModalState,
  resolveAutopilotMaxTurns,
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
  action: AutopilotLimitModalAction | null;
  onClose: () => void;
  onSubmit: (maxTurns: number | null) => void;
  submitLabel: string;
};

export const AutopilotLimitDialog = ({
  action,
  onClose,
  onSubmit,
  submitLabel,
}: AutopilotLimitDialogProps): JSX.Element => {
  const [modalState, setModalState] = useState(() => createAutopilotLimitModalState("start"));

  useEffect(() => {
    if (action === null) {
      return;
    }
    setModalState(createAutopilotLimitModalState(action));
  }, [action]);

  useEffect(() => {
    if (action === null) {
      return;
    }
    const focusTarget = document.querySelector<HTMLElement>(
      "#autopilot-max-turns-input:not(:disabled), #autopilot-limit-toggle",
    );
    focusTarget?.focus();
  }, [action]);

  const title = action === "start" ? "Start Autopilot" : "Resume Autopilot";

  return (
    <Dialog onOpenChange={(open) => (!open ? onClose() : undefined)} open={action !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Set an optional turn limit for this run.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <input
              checked={modalState.limitTurns}
              className="h-4 w-4 rounded border-gray-300"
              id="autopilot-limit-toggle"
              onChange={(event) =>
                setModalState((current) => ({
                  ...current,
                  limitTurns: event.target.checked,
                  validationMessage: "",
                }))
              }
              type="checkbox"
            />
            <Label htmlFor="autopilot-limit-toggle">Limit turns</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="autopilot-max-turns-input">
              Max turns ({AUTOPILOT_MAX_TURNS_MIN}-{AUTOPILOT_MAX_TURNS_MAX})
            </Label>
            <Input
              disabled={!modalState.limitTurns}
              id="autopilot-max-turns-input"
              min={AUTOPILOT_MAX_TURNS_MIN}
              onChange={(event) =>
                setModalState((current) => ({
                  ...current,
                  maxTurnsInput: event.target.value,
                  validationMessage: "",
                }))
              }
              placeholder="e.g. 12"
              type="number"
              value={modalState.maxTurnsInput}
            />
          </div>
          {modalState.validationMessage ? (
            <p className="text-sm text-muted-foreground">{modalState.validationMessage}</p>
          ) : null}
        </div>
        <DialogFooter className="flex gap-2">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            onClick={() => {
              const resolved = resolveAutopilotMaxTurns(modalState);
              if (!resolved.ok) {
                setModalState((current) => ({
                  ...current,
                  validationMessage: resolved.validationMessage,
                }));
                return;
              }
              onSubmit(resolved.maxTurns);
            }}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
