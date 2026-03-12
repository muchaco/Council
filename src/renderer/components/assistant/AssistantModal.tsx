import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";

import { summarizeAssistantContext } from "../../../shared/assistant/assistant-context.js";
import type { AssistantContextEnvelope } from "../../../shared/ipc/dto.js";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import type { AssistantConversationMessage, AssistantUiState } from "./assistant-ui-state";
import {
  isAssistantBusy,
  requiresAssistantCloseConfirmation,
  shouldSubmitAssistantInput,
} from "./assistant-ui-state";

type AssistantModalProps = {
  context: AssistantContextEnvelope;
  inputRef: RefObject<HTMLTextAreaElement>;
  onApproveConfirmation: () => void;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onRejectConfirmation: () => void;
  onRequestClose: () => void;
  onSend: () => void;
  onStop: () => void;
  state: AssistantUiState;
};

const EXAMPLE_PROMPTS = [
  "Open the newest council.",
  "Show my archived agents.",
  "Help me review this council draft.",
];

const phaseLabelByStatus: Record<AssistantUiState["phase"]["status"], string> = {
  cancelled: "Cancelled",
  clarify: "Needs input",
  confirm: "Needs confirmation",
  executing: "Executing",
  failure: "Could not complete",
  idle: "Ready",
  partial: "Partially complete",
  planning: "Planning",
  success: "Completed",
};

const messageToneClassName = (tone: AssistantConversationMessage["tone"]): string => {
  switch (tone) {
    case "destructive":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "muted":
      return "border-border/70 bg-muted/60 text-muted-foreground";
    case "success":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    default:
      return "border-border bg-card text-card-foreground";
  }
};

export const AssistantModal = ({
  context,
  inputRef,
  onApproveConfirmation,
  onClose,
  onInputChange,
  onRejectConfirmation,
  onRequestClose,
  onSend,
  onStop,
  state,
}: AssistantModalProps): JSX.Element => {
  const contextSummary = summarizeAssistantContext(context);
  const isBusy = isAssistantBusy(state.phase);
  const canCloseSafely = !requiresAssistantCloseConfirmation(state.phase);
  const canSend = state.inputValue.trim().length > 0 && !isBusy && state.phase.status !== "confirm";

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
    if (!shouldSubmitAssistantInput({ key: event.key, shiftKey: event.shiftKey }) || !canSend) {
      return;
    }

    event.preventDefault();
    onSend();
  };

  return (
    <Dialog open={state.isOpen} onOpenChange={(nextOpen) => !nextOpen && onRequestClose()}>
      <DialogContent
        className="flex h-[min(90vh,44rem)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:w-full"
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          onRequestClose();
        }}
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader className="border-b border-border/70 px-5 py-4 text-left sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <DialogTitle>Assistant</DialogTitle>
              <DialogDescription>
                Plan and execute UI-safe actions with the current app context.
              </DialogDescription>
            </div>
            <Badge className="shrink-0" variant="outline">
              {phaseLabelByStatus[state.phase.status]}
            </Badge>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {contextSummary}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {state.messages.length === 0 ? (
            <div className="space-y-4 rounded-2xl border border-dashed border-border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                Ask the assistant to help with navigation, drafts, or the current council context.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    className="rounded-xl border border-border bg-background px-3 py-3 text-left text-sm transition-colors hover:bg-muted"
                    key={prompt}
                    onClick={() => onInputChange(prompt)}
                    type="button"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div aria-live="polite" className="space-y-3">
              {state.messages.map((message) => (
                <div
                  className={[
                    "max-w-[90%] rounded-2xl border px-4 py-3 text-sm shadow-sm",
                    message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "",
                    message.role !== "user" ? messageToneClassName(message.tone) : "",
                  ].join(" ")}
                  key={message.id}
                >
                  {message.text}
                </div>
              ))}
            </div>
          )}

          {state.phase.status === "confirm" ? (
            <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium text-foreground">{state.phase.summary}</p>
              <p className="mt-2 text-muted-foreground">{state.phase.confirmation.summary}</p>
              <p className="mt-2 text-muted-foreground">
                Scope: {state.phase.confirmation.scopeDescription}
              </p>
            </div>
          ) : null}

          {state.phase.status === "executing" ? (
            <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {state.phase.summary}
            </div>
          ) : null}
        </div>

        <div className="border-t border-border/70 px-5 py-4 sm:px-6">
          <Textarea
            aria-label="Assistant request"
            disabled={isBusy || state.phase.status === "confirm"}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={
              state.phase.status === "clarify"
                ? "Answer the assistant's question"
                : "Ask the assistant to help with this screen"
            }
            ref={inputRef}
            rows={3}
            value={state.inputValue}
          />

          <DialogFooter className="mt-3 flex gap-2 sm:items-center sm:justify-between sm:space-x-0">
            <div className="text-sm text-muted-foreground">
              {canCloseSafely
                ? "Enter sends. Shift+Enter adds a new line."
                : "Closing now stops current assistant work."}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {state.phase.status === "confirm" ? (
                <>
                  <Button onClick={onApproveConfirmation} type="button">
                    Confirm
                  </Button>
                  <Button onClick={onRejectConfirmation} type="button" variant="outline">
                    Cancel
                  </Button>
                </>
              ) : isBusy ? (
                <Button onClick={onStop} type="button" variant="outline">
                  Stop
                </Button>
              ) : (
                <Button onClick={onClose} type="button" variant="outline">
                  Close
                </Button>
              )}
              {state.phase.status === "confirm" ? null : (
                <Button disabled={!canSend} onClick={onSend} type="button">
                  Send
                </Button>
              )}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
