import { Plus } from "lucide-react";
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
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

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
      <div className="home-list-toolbar home-list-toolbar-agents">
        <div aria-live="polite" className="home-list-toolbar-meta">
          {isLoading ? "Loading agents..." : totalLabel}
        </div>
        <div className="home-list-toolbar-fields home-list-toolbar-fields-wide">
          <Input
            aria-label="Search agents"
            className="home-list-toolbar-search"
            onChange={(event) => onSetSearchText(event.target.value)}
            placeholder="Search name or prompt"
            value={searchText}
          />
          <Input
            aria-label="Filter by tag"
            className="home-list-toolbar-tag"
            onChange={(event) => onSetTagFilter(event.target.value)}
            placeholder="Filter by tag"
            value={tagFilter}
          />
        </div>
        <div className="home-list-toolbar-fields">
          <Button
            disabled={!hasActiveFilters}
            onClick={onClearFilters}
            type="button"
            variant="outline"
          >
            Clear filters
          </Button>
          <Select
            value={archivedFilter}
            onValueChange={(value) => onSetArchivedFilter(value as AgentArchivedFilter)}
          >
            <SelectTrigger className="home-list-toolbar-select">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="archived">Archived only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => onSetSortBy(value as AgentSortField)}>
            <SelectTrigger className="home-list-toolbar-select">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">Last modified</SelectItem>
              <SelectItem value="createdAt">Date created</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortDirection}
            onValueChange={(value) => onSetSortDirection(value as SortDirection)}
          >
            <SelectTrigger className="home-list-toolbar-select home-list-toolbar-select-sm">
              <SelectValue placeholder="Order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest first</SelectItem>
              <SelectItem value="asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          className="home-list-toolbar-action gap-2"
          onClick={onOpenAgentEditor}
          type="button"
        >
          <Plus className="h-4 w-4" />
          New Agent
        </Button>
      </div>

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
