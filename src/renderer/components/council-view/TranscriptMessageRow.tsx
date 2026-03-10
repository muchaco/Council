import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { buildTranscriptMessageAriaLabel } from "../../../shared/council-view-accessibility.js";
import {
  resolveTranscriptAccentColor,
  resolveTranscriptAvatarInitials,
  resolveTranscriptMessageAlignment,
} from "../../../shared/council-view-transcript.js";
import type { CouncilMessageDto } from "../../../shared/ipc/dto";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";

type TranscriptMessageRowProps = {
  index: number;
  memberColorsByAgentId: Readonly<Record<string, string>>;
  message: CouncilMessageDto;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>, currentIndex: number) => void;
  registerRowRef: (index: number, element: HTMLElement | null) => void;
};

export const TranscriptMessageRow = ({
  index,
  memberColorsByAgentId,
  message,
  onKeyDown,
  registerRowRef,
}: TranscriptMessageRowProps): JSX.Element => (
  <button
    aria-label={buildTranscriptMessageAriaLabel(message)}
    className={`w-full rounded-lg p-3 text-left transition-colors hover:bg-muted/50 ${resolveTranscriptMessageAlignment(message) === "right" ? "bg-muted/30" : ""}`}
    data-transcript-row-index={index}
    onKeyDown={(event) => onKeyDown(event, index)}
    ref={(element) => {
      registerRowRef(index, element);
    }}
    type="button"
  >
    <div className="flex gap-3">
      <Avatar
        className="flex-shrink-0"
        style={{
          backgroundColor: resolveTranscriptAccentColor(message, memberColorsByAgentId),
        }}
      >
        <AvatarFallback className="text-sm font-medium text-white">
          {resolveTranscriptAvatarInitials(message.senderName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-medium">
            {message.senderName}
            {message.senderKind === "conductor" ? (
              <Badge className="ml-2 text-xs" variant="secondary">
                Conductor
              </Badge>
            ) : null}
          </span>
          <span className="text-xs text-muted-foreground">#{message.sequenceNumber}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm text-foreground">{message.content}</p>
        <p className="mt-1 text-xs text-muted-foreground" title={message.createdAtUtc}>
          {message.createdAtUtc}
        </p>
      </div>
    </div>
  </button>
);
