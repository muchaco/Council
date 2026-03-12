import { Sparkles } from "lucide-react";
import type { MouseEvent } from "react";

import { Button } from "../ui/button";

type AssistantLauncherProps = {
  onOpen: (triggerElement: HTMLButtonElement) => void;
};

export const AssistantLauncher = ({ onOpen }: AssistantLauncherProps): JSX.Element => {
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    onOpen(event.currentTarget);
  };

  return (
    <Button
      aria-haspopup="dialog"
      className="shrink-0 gap-2"
      data-assistant-launcher="true"
      onClick={handleClick}
      size="sm"
      type="button"
      variant="outline"
    >
      <Sparkles className="h-4 w-4" />
      Assistant
    </Button>
  );
};
