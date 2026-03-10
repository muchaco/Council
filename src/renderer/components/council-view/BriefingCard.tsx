import type { CouncilRuntimeBriefingDto } from "../../../shared/ipc/dto";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";

type BriefingCardProps = {
  briefing: CouncilRuntimeBriefingDto | null;
};

export const BriefingCard = ({ briefing }: BriefingCardProps): JSX.Element => (
  <Card className="p-6">
    <h2 className="mb-4 text-xl font-medium">Briefing</h2>
    {briefing === null ? (
      <p className="text-sm italic text-muted-foreground">Briefing not generated yet.</p>
    ) : (
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Summary</p>
          <p className="text-sm">{briefing.briefing}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Goal status:</span>
          <Badge variant={briefing.goalReached ? "default" : "secondary"}>
            {briefing.goalReached ? "Reached" : "In progress"}
          </Badge>
        </div>
        {briefing.goalReached ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="mb-1 text-sm font-medium text-green-800">Goal reached</p>
            <p className="text-xs text-green-700">
              The latest briefing reports this council has reached its stated goal.
            </p>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">Updated: {briefing.updatedAtUtc}</p>
      </div>
    )}
  </Card>
);
