import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Textarea } from "../ui/textarea";

type ConductorComposerCardProps = {
  conductorDraft: string;
  disabled: boolean;
  isInjectingConductor: boolean;
  onChangeDraft: (value: string) => void;
  onSubmit: () => void;
};

export const ConductorComposerCard = ({
  conductorDraft,
  disabled,
  isInjectingConductor,
  onChangeDraft,
  onSubmit,
}: ConductorComposerCardProps): JSX.Element => (
  <Card className="p-6">
    <h2 className="mb-4 text-xl font-medium">Conductor Message</h2>
    <Textarea
      disabled={disabled}
      onChange={(event) => onChangeDraft(event.target.value)}
      placeholder="Type your message as conductor..."
      rows={4}
      value={conductorDraft}
    />
    <div className="mt-4 flex justify-end">
      <Button
        disabled={disabled || !conductorDraft.trim() || isInjectingConductor}
        onClick={onSubmit}
      >
        {isInjectingConductor ? "Sending..." : "Send as Conductor"}
      </Button>
    </div>
  </Card>
);
