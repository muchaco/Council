import { AlertTriangle, Archive } from "lucide-react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  SyntheticEvent,
} from "react";

import { modelLabel } from "../../../shared/app-ui-helpers.js";
import type { ModelRef } from "../../../shared/domain/model-ref";
import type { AgentDto } from "../../../shared/ipc/dto";
import { Card } from "../ui/card";
import { AgentCardMenu } from "./AgentCardMenu";

type AgentCardProps = {
  agent: AgentDto;
  globalDefaultModel: ModelRef | null;
  onCardClick: (event: ReactMouseEvent<HTMLElement>, agentId: string) => void;
  onCardKeyDown: (event: ReactKeyboardEvent<HTMLElement>, agentId: string) => void;
  onDelete: (agent: AgentDto) => void;
  onMenuToggle: (event: SyntheticEvent<HTMLDetailsElement>) => void;
  onSetArchived: (params: { agentId: string; archived: boolean }) => void;
};

export const AgentCard = ({
  agent,
  globalDefaultModel,
  onCardClick,
  onCardKeyDown,
  onDelete,
  onMenuToggle,
  onSetArchived,
}: AgentCardProps): JSX.Element => (
  <Card
    aria-label={`Open agent ${agent.name}`}
    className="agent-card home-list-card overflow-visible"
    data-agent-card-id={agent.id}
    onClick={(event) => onCardClick(event, agent.id)}
    onKeyDown={(event) => onCardKeyDown(event, agent.id)}
    tabIndex={0}
  >
    <div className="agent-card-header">
      <div className="agent-card-header-main">
        <h3 className="agent-card-title">{agent.name}</h3>
      </div>
      <AgentCardMenu
        agent={agent}
        onDelete={onDelete}
        onMenuToggle={onMenuToggle}
        onSetArchived={onSetArchived}
      />
    </div>

    <p className="agent-card-prompt">{agent.systemPrompt}</p>

    <div className="agent-card-stats">
      <div className="agent-stat">
        <span className="agent-stat-label">Model:</span>
        <span className="agent-stat-value">{modelLabel(agent, globalDefaultModel)}</span>
      </div>
    </div>

    {agent.tags.length > 0 ? (
      <div className="agent-card-tags">
        {agent.tags.slice(0, 3).map((tag) => (
          <span className="agent-tag" key={tag}>
            {tag}
          </span>
        ))}
        {agent.tags.length > 3 ? (
          <span className="agent-tag council-tag-more">+{agent.tags.length - 3}</span>
        ) : null}
      </div>
    ) : null}

    {agent.archived || agent.invalidConfig ? (
      <div className="council-card-footer">
        <div className="council-card-status-badges">
          {agent.archived ? (
            <span className="council-card-status-badge council-card-status-badge-archived">
              <Archive aria-hidden="true" className="h-3 w-3" />
              Archived
            </span>
          ) : null}
          {agent.invalidConfig ? (
            <span
              aria-label="Invalid configuration"
              className="council-card-status-badge council-card-status-badge-invalid"
              title="Invalid config"
            >
              <AlertTriangle aria-hidden="true" className="h-3 w-3" />
              Config Error
            </span>
          ) : null}
        </div>
      </div>
    ) : null}
  </Card>
);
