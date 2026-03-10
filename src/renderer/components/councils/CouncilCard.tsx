import { AlertTriangle, Archive, Pause, Play, Square } from "lucide-react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  SyntheticEvent,
} from "react";

import type { CouncilDto } from "../../../shared/ipc/dto";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader } from "../ui/card";
import { CouncilCardMenu } from "./CouncilCardMenu";

type CouncilCardProps = {
  council: CouncilDto;
  exportingCouncilId: string | null;
  onCardClick: (event: ReactMouseEvent<HTMLElement>, councilId: string) => void;
  onCardKeyDown: (event: ReactKeyboardEvent<HTMLElement>, councilId: string) => void;
  onDelete: (council: CouncilDto) => void;
  onExport: (councilId: string) => void;
  onMenuKeyDown: (event: ReactKeyboardEvent<HTMLDetailsElement>) => void;
  onMenuSummaryKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  onMenuToggle: (event: SyntheticEvent<HTMLDetailsElement>) => void;
  onSetArchived: (params: { councilId: string; archived: boolean }) => void;
};

export const CouncilCard = ({
  council,
  exportingCouncilId,
  onCardClick,
  onCardKeyDown,
  onDelete,
  onExport,
  onMenuKeyDown,
  onMenuSummaryKeyDown,
  onMenuToggle,
  onSetArchived,
}: CouncilCardProps): JSX.Element => {
  const runtimeStatus = council.started ? (council.paused ? "paused" : "running") : "stopped";

  return (
    <Card
      aria-label={`Open council ${council.title}`}
      className="council-card home-list-card group overflow-visible"
      data-council-card-id={council.id}
      onClick={(event) => onCardClick(event, council.id)}
      onKeyDown={(event) => onCardKeyDown(event, council.id)}
      tabIndex={0}
    >
      <CardHeader className="pb-3">
        <div className="home-list-card-header">
          <div className="home-list-card-heading">
            <h3 className="home-list-card-title font-semibold text-lg leading-tight">
              {council.title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{council.topic}</p>
          </div>
          <CouncilCardMenu
            council={council}
            exportingCouncilId={exportingCouncilId}
            onDelete={onDelete}
            onExport={onExport}
            onMenuKeyDown={onMenuKeyDown}
            onMenuSummaryKeyDown={onMenuSummaryKeyDown}
            onMenuToggle={onMenuToggle}
            onSetArchived={onSetArchived}
          />
        </div>
      </CardHeader>
      <CardContent className="council-card-content pb-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{council.memberAgentIds.length}</span>{" "}
              {council.memberAgentIds.length === 1 ? "member" : "members"}
            </span>
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{council.turnCount}</span>{" "}
              {council.turnCount === 1 ? "turn" : "turns"}
            </span>
          </div>
          <Badge className="capitalize" variant="outline">
            {council.mode}
          </Badge>
        </div>
        {council.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {council.tags.slice(0, 3).map((tag) => (
              <span
                className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground"
                key={tag}
              >
                {tag}
              </span>
            ))}
            {council.tags.length > 3 ? (
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                +{council.tags.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="council-card-footer">
          <div className="council-card-status-badges">
            {council.archived ? (
              <span className="council-card-status-badge council-card-status-badge-archived">
                <Archive aria-hidden="true" className="h-3 w-3" />
                Archived
              </span>
            ) : null}
            {council.invalidConfig ? (
              <span className="council-card-status-badge council-card-status-badge-invalid">
                <AlertTriangle aria-hidden="true" className="h-3 w-3" />
                Config Error
              </span>
            ) : null}
            <span
              className={`council-card-status-badge ${runtimeStatus === "running" ? "council-card-status-badge-running" : runtimeStatus === "paused" ? "council-card-status-badge-paused" : "council-card-status-badge-stopped"}`}
            >
              {runtimeStatus === "running" ? (
                <Play aria-hidden="true" className="h-3 w-3" />
              ) : runtimeStatus === "paused" ? (
                <Pause aria-hidden="true" className="h-3 w-3" />
              ) : (
                <Square aria-hidden="true" className="h-3 w-3" />
              )}
              {runtimeStatus === "running"
                ? "Running"
                : runtimeStatus === "paused"
                  ? "Paused"
                  : "Stopped"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
