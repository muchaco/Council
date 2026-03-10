import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  SyntheticEvent,
} from "react";

import { formatHomeListTotal } from "../../../shared/app-ui-helpers.js";
import type { ModelRef } from "../../../shared/domain/model-ref";
import type {
  AgentArchivedFilter,
  AgentDto,
  AgentSortField,
  SortDirection,
} from "../../../shared/ipc/dto";
import { AgentCard } from "../agents/AgentCard";
import { HomeListToolbar } from "../shared/HomeListToolbar";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type AgentsPanelProps = {
  agents: ReadonlyArray<AgentDto>;
  archivedFilter: AgentArchivedFilter;
  error: string | null;
  globalDefaultModel: ModelRef | null;
  hasActiveFilters: boolean;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  page: number;
  searchText: string;
  sortBy: AgentSortField;
  sortDirection: SortDirection;
  tagFilter: string;
  total: number;
  onClearFilters: () => void;
  onDelete: (agent: AgentDto) => void;
  onLoadMore: () => void;
  onMenuToggle: (event: SyntheticEvent<HTMLDetailsElement>) => void;
  onOpenAgentEditor: () => void;
  onOpenAgentFromCard: (
    event: ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>,
    agentId: string,
  ) => void;
  onSetArchived: (params: { agentId: string; archived: boolean }) => void;
  onSetArchivedFilter: (value: AgentArchivedFilter) => void;
  onSetSearchText: (value: string) => void;
  onSetSortBy: (value: AgentSortField) => void;
  onSetSortDirection: (value: SortDirection) => void;
  onSetTagFilter: (value: string) => void;
};

export const AgentsPanel = ({
  agents,
  archivedFilter,
  error,
  globalDefaultModel,
  hasActiveFilters,
  hasMore,
  isLoading,
  isLoadingMore,
  page,
  searchText,
  sortBy,
  sortDirection,
  tagFilter,
  total,
  onClearFilters,
  onDelete,
  onLoadMore,
  onMenuToggle,
  onOpenAgentEditor,
  onOpenAgentFromCard,
  onSetArchived,
  onSetArchivedFilter,
  onSetSearchText,
  onSetSortBy,
  onSetSortDirection,
  onSetTagFilter,
}: AgentsPanelProps): JSX.Element => {
  const totalLabel = formatHomeListTotal({ total, singularLabel: "agent" });
  const emptyMessage =
    archivedFilter === "archived"
      ? "No archived agents found."
      : archivedFilter === "active"
        ? "No active agents found."
        : "No agents yet. Create your first agent.";

  return (
    <section
      aria-labelledby="home-tab-agents"
      className="settings-section"
      id="home-panel-agents"
      role="tabpanel"
    >
      <HomeListToolbar
        actionLabel="New Agent"
        archivedFilterValue={archivedFilter}
        archivedOptions={[
          { value: "all", label: "All agents" },
          { value: "active", label: "Active only" },
          { value: "archived", label: "Archived only" },
        ]}
        hasActiveFilters={hasActiveFilters}
        isLoading={isLoading}
        metaLabel={isLoading ? "Loading agents..." : totalLabel}
        onAction={onOpenAgentEditor}
        onClearFilters={onClearFilters}
        onSetArchivedFilter={(value) => onSetArchivedFilter(value as AgentArchivedFilter)}
        onSetSearchText={onSetSearchText}
        onSetSortBy={(value) => onSetSortBy(value as AgentSortField)}
        onSetSortDirection={(value) => onSetSortDirection(value as SortDirection)}
        onSetTagFilter={onSetTagFilter}
        searchAriaLabel="Search agents"
        searchPlaceholder="Search name or prompt"
        searchText={searchText}
        sortByOptions={[
          { value: "updatedAt", label: "Last modified" },
          { value: "createdAt", label: "Date created" },
        ]}
        sortByValue={sortBy}
        sortDirectionOptions={[
          { value: "desc", label: "Newest first" },
          { value: "asc", label: "Oldest first" },
        ]}
        sortDirectionValue={sortDirection}
        tagFilter={tagFilter}
        toolbarClassName="home-list-toolbar-agents"
      />

      {error !== null ? <p className="status">Error: {error}</p> : null}
      {isLoading && agents.length > 0 ? (
        <p aria-live="polite" className="status-line">
          Refreshing agents...
        </p>
      ) : null}
      {!isLoading && agents.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </Card>
      ) : null}

      <div className="agents-grid">
        {agents.map((agent) => (
          <AgentCard
            agent={agent}
            globalDefaultModel={globalDefaultModel}
            key={agent.id}
            onCardClick={(event, agentId) => onOpenAgentFromCard(event, agentId)}
            onCardKeyDown={(event, agentId) => onOpenAgentFromCard(event, agentId)}
            onDelete={onDelete}
            onMenuToggle={onMenuToggle}
            onSetArchived={onSetArchived}
          />
        ))}
        {hasMore ? (
          <div className="agents-load-more">
            <button
              className="secondary"
              disabled={isLoadingMore}
              onClick={onLoadMore}
              type="button"
            >
              {isLoadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
};
