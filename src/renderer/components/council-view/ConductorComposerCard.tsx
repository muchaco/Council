import { useState } from "react";

import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Textarea } from "../ui/textarea";

type ConductorComposerCardProps = {
  disabled: boolean;
  isInjectingConductor: boolean;
  onSubmit: (content: string) => Promise<boolean>;
};

export const ConductorComposerCard = ({
  disabled,
  isInjectingConductor,
  onSubmit,
}: ConductorComposerCardProps): JSX.Element => {
  const [draft, setDraft] = useState("");

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-xl font-medium">Conductor Message</h2>
      <Textarea
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Type your message as conductor..."
        rows={4}
        value={draft}
      />
      <div className="mt-4 flex justify-end">
        <Button
          disabled={disabled || !draft.trim() || isInjectingConductor}
          onClick={() => {
            void onSubmit(draft).then((submitted) => {
              if (submitted) {
                setDraft("");
              }
            });
          }}
        >
          {isInjectingConductor ? "Sending..." : "Send as Conductor"}
        </Button>
      </div>
    </Card>
  );
};
