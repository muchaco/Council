import { resolveTranscriptAvatarInitials } from "../../../shared/council-view-transcript.js";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";

type ThinkingMessageRowProps = {
  disabled: boolean;
  isCancellingGeneration: boolean;
  onCancel: () => void;
  showInlineThinkingCancel: boolean;
  thinkingSpeakerColor: string | null;
  thinkingSpeakerName: string;
};

export const ThinkingMessageRow = ({
  disabled,
  isCancellingGeneration,
  onCancel,
  showInlineThinkingCancel,
  thinkingSpeakerColor,
  thinkingSpeakerName,
}: ThinkingMessageRowProps): JSX.Element => (
  <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
    <Avatar
      className="flex-shrink-0"
      style={{ backgroundColor: thinkingSpeakerColor ?? "#0a5c66" }}
    >
      <AvatarFallback className="text-sm font-medium text-white">
        {resolveTranscriptAvatarInitials(thinkingSpeakerName)}
      </AvatarFallback>
    </Avatar>
    <div className="flex-1">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-medium">{thinkingSpeakerName}</span>
        <span className="text-xs text-muted-foreground">Thinking</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: "0.1s" }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: "0.2s" }}
        />
      </div>
    </div>
    {showInlineThinkingCancel ? (
      <Button disabled={disabled} onClick={onCancel} size="sm" variant="outline">
        {isCancellingGeneration ? "Cancelling..." : "Cancel"}
      </Button>
    ) : null}
  </div>
);
