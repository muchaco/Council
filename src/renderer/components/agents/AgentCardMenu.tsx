import type { SyntheticEvent } from "react";

import type { AgentDto } from "../../../shared/ipc/dto";

type AgentCardMenuProps = {
  agent: AgentDto;
  onDelete: (agent: AgentDto) => void;
  onMenuToggle: (event: SyntheticEvent<HTMLDetailsElement>) => void;
  onSetArchived: (params: { agentId: string; archived: boolean }) => void;
};

export const AgentCardMenu = ({
  agent,
  onDelete,
  onMenuToggle,
  onSetArchived,
}: AgentCardMenuProps): JSX.Element => (
  <details
    aria-label={`Actions menu for agent ${agent.name}`}
    className="agent-actions-menu"
    data-card-open-ignore="true"
    onToggle={onMenuToggle}
  >
    <summary aria-label={`Toggle actions for agent ${agent.name}`} className="agent-btn-more">
      <span className="sr-only">Agent actions</span>
      ...
    </summary>
    <div aria-label={`Agent actions for ${agent.name}`} className="agent-menu-dropdown">
      <button
        className="agent-menu-item"
        onClick={(event) => {
          const details = event.currentTarget.closest("details");
          if (details) {
            details.open = false;
          }
          onSetArchived({ agentId: agent.id, archived: !agent.archived });
        }}
        type="button"
      >
        {agent.archived ? "Restore agent" : "Archive agent"}
      </button>
      <hr className="agent-menu-divider" />
      <button
        className="agent-menu-item agent-menu-item-danger"
        onClick={(event) => {
          const details = event.currentTarget.closest("details");
          if (details) {
            details.open = false;
          }
          onDelete(agent);
        }}
        type="button"
      >
        Delete agent
      </button>
    </div>
  </details>
);
