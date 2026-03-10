import type { JSX, MutableRefObject, KeyboardEvent as ReactKeyboardEvent } from "react";

import type { CouncilRuntimeNotice } from "../../../shared/council-view-autopilot-recovery.js";
import type { CouncilDto, CouncilMessageDto } from "../../../shared/ipc/dto";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ThinkingMessageRow } from "./ThinkingMessageRow";
import { TranscriptMessageRow } from "./TranscriptMessageRow";

type TranscriptCardProps = {
  autopilotRecoveryNotice: CouncilRuntimeNotice | null;
  chatEndRef: MutableRefObject<HTMLDivElement | null>;
  councilMode: CouncilDto["mode"];
  isCancellingGeneration: boolean;
  isConfigEditing: boolean;
  isStarting: boolean;
  manualRetryNotice: CouncilRuntimeNotice | null;
  memberColorsByAgentId: CouncilDto["memberColorsByAgentId"];
  messages: ReadonlyArray<CouncilMessageDto>;
  onCancelGeneration: () => void;
  onStartDiscussion: () => void;
  onTranscriptRowKeyDown: (event: ReactKeyboardEvent<HTMLElement>, currentIndex: number) => void;
  registerTranscriptRowRef: (currentIndex: number, element: HTMLElement | null) => void;
  showEmptyStateStart: boolean;
  showInlineThinkingCancel: boolean;
  startDisabled: boolean;
  startDisabledReason?: string;
  thinkingSpeakerColor: string | null;
  thinkingSpeakerName: string | null;
};

export const TranscriptCard = ({
  autopilotRecoveryNotice,
  chatEndRef,
  councilMode,
  isCancellingGeneration,
  isConfigEditing,
  isStarting,
  manualRetryNotice,
  memberColorsByAgentId,
  messages,
  onCancelGeneration,
  onStartDiscussion,
  onTranscriptRowKeyDown,
  registerTranscriptRowRef,
  showEmptyStateStart,
  showInlineThinkingCancel,
  startDisabled,
  startDisabledReason,
  thinkingSpeakerColor,
  thinkingSpeakerName,
}: TranscriptCardProps): JSX.Element => (
  <Card className="p-6">
    <h2 className="mb-4 text-xl font-medium">Transcript</h2>
    {autopilotRecoveryNotice !== null ? (
      <div className="mb-4 rounded-lg bg-muted p-3">
        <p className="font-medium text-sm">{autopilotRecoveryNotice.title}</p>
        <p className="text-sm">{autopilotRecoveryNotice.body}</p>
      </div>
    ) : null}
    {manualRetryNotice !== null ? (
      <div className="mb-4 rounded-lg bg-muted p-3">
        <p className="font-medium text-sm">{manualRetryNotice.title}</p>
        <p className="text-sm">{manualRetryNotice.body}</p>
      </div>
    ) : null}
    {messages.length === 0 && thinkingSpeakerName === null ? (
      <div className="rounded-lg bg-muted/50 py-12 text-center">
        <p className="mb-4 text-muted-foreground">
          {councilMode === "manual"
            ? "No messages yet. Choose the next speaker from Members."
            : "No messages yet."}
        </p>
        {showEmptyStateStart ? (
          <Button disabled={startDisabled} onClick={onStartDiscussion} title={startDisabledReason}>
            {isStarting ? "Starting..." : "Start Discussion"}
          </Button>
        ) : null}
      </div>
    ) : (
      <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2">
        {messages.map((message, index) => (
          <TranscriptMessageRow
            index={index}
            key={message.id}
            memberColorsByAgentId={memberColorsByAgentId}
            message={message}
            onKeyDown={onTranscriptRowKeyDown}
            registerRowRef={registerTranscriptRowRef}
          />
        ))}
        {thinkingSpeakerName !== null ? (
          <ThinkingMessageRow
            disabled={isCancellingGeneration || isConfigEditing}
            isCancellingGeneration={isCancellingGeneration}
            onCancel={onCancelGeneration}
            showInlineThinkingCancel={showInlineThinkingCancel}
            thinkingSpeakerColor={thinkingSpeakerColor}
            thinkingSpeakerName={thinkingSpeakerName}
          />
        ) : null}
        <div ref={chatEndRef} />
      </div>
    )}
  </Card>
);
