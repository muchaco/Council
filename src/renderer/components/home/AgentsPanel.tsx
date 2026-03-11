import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  SyntheticEvent,
} from "react";

import {
  DEFAULT_AGENT_HOME_LIST_FILTERS,
  applyAgentArchivedListUpdate,
  applyCommittedTagFilter,
  formatHomeListTotal,
  hasActiveAgentHomeListFilters,
} from "../../../shared/app-ui-helpers.js";
import type { ModelRef } from "../../../shared/domain/model-ref";
import {
  isCardOpenInteractionTarget,
  isListRowOpenKey,
} from "../../../shared/home-keyboard-accessibility.js";
import type {
  AgentArchivedFilter,
  AgentDto,
  AgentSortField,
  SortDirection,
} from "../../../shared/ipc/dto";
import { ConfirmDialog } from "../../ConfirmDialog";
import { AgentCard } from "../agents/AgentCard";
import { HomeListToolbar } from "../shared/HomeListToolbar";
import { Card } from "../ui/card";

type AgentsPanelProps = {
  isActive: boolean;
  onOpenAgentEditor: () => void;
  onOpenAgentFromCard: (agentId: string) => void;
  onTotalChange: (total: number) => void;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
};

export const AgentsPanel = ({
  isActive,
  onOpenAgentEditor,
  onOpenAgentFromCard,
  onTotalChange,
  pushToast,
}: AgentsPanelProps): JSX.Element => {
  const [agents, setAgents] = useState<ReadonlyArray<AgentDto>>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<AgentSortField>(DEFAULT_AGENT_HOME_LIST_FILTERS.sortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_AGENT_HOME_LIST_FILTERS.sortDirection,
  );
  const [searchText, setSearchText] = useState(DEFAULT_AGENT_HOME_LIST_FILTERS.searchText);
  const [tagFilter, setTagFilter] = useState(DEFAULT_AGENT_HOME_LIST_FILTERS.tagFilter);
  const [tagFilterDraft, setTagFilterDraft] = useState(DEFAULT_AGENT_HOME_LIST_FILTERS.tagFilter);
  const [archivedFilter, setArchivedFilter] = useState<AgentArchivedFilter>(
    DEFAULT_AGENT_HOME_LIST_FILTERS.archivedFilter,
  );
  const [globalDefaultModel, setGlobalDefaultModel] = useState<ModelRef | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AgentDto | null>(null);

  const loadAgents = useCallback(
    async (params: { page: number; append: boolean }): Promise<void> => {
      if (params.append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const result = await window.api.agents.list({
        viewKind: "agentsList",
        searchText,
        tagFilter,
        archivedFilter,
        sortBy,
        sortDirection,
        page: params.page,
      });
      if (!result.ok) {
        setError(result.error.userMessage);
        pushToast("error", result.error.userMessage);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }
      setAgents((current) =>
        params.append ? [...current, ...result.value.items] : result.value.items,
      );
      setPage(result.value.page);
      setHasMore(result.value.hasMore);
      setTotal(result.value.total);
      onTotalChange(result.value.total);
      setGlobalDefaultModel(result.value.globalDefaultModelRef);
      setIsLoading(false);
      setIsLoadingMore(false);
    },
    [archivedFilter, onTotalChange, pushToast, searchText, sortBy, sortDirection, tagFilter],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }
    void loadAgents({ page: 1, append: false });
  }, [isActive, loadAgents]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const openMenus = document.querySelectorAll<HTMLDetailsElement>(".agent-actions-menu[open]");
      for (const menu of openMenus) {
        if (!menu.contains(target)) {
          menu.open = false;
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isActive]);

  const hasActiveFilters = useMemo(
    () =>
      hasActiveAgentHomeListFilters({
        searchText,
        tagFilter,
        archivedFilter,
        sortBy,
        sortDirection,
      }),
    [archivedFilter, searchText, sortBy, sortDirection, tagFilter],
  );

  const clearFilters = useCallback((): void => {
    setSearchText(DEFAULT_AGENT_HOME_LIST_FILTERS.searchText);
    setTagFilter(DEFAULT_AGENT_HOME_LIST_FILTERS.tagFilter);
    setTagFilterDraft(DEFAULT_AGENT_HOME_LIST_FILTERS.tagFilter);
    setArchivedFilter(DEFAULT_AGENT_HOME_LIST_FILTERS.archivedFilter);
    setSortBy(DEFAULT_AGENT_HOME_LIST_FILTERS.sortBy);
    setSortDirection(DEFAULT_AGENT_HOME_LIST_FILTERS.sortDirection);
  }, []);

  const commitTagFilter = useCallback(
    (nextDraft?: string): void => {
      const resolvedDraft = nextDraft ?? tagFilterDraft;
      const nextFilter = applyCommittedTagFilter(resolvedDraft);
      setTagFilterDraft(nextFilter.draftValue);
      setTagFilter(nextFilter.tagFilter);
    },
    [tagFilterDraft],
  );

  const applyTagFilterFromCard = useCallback((tag: string): void => {
    setTagFilterDraft("");
    setTagFilter(tag);
  }, []);

  const handleMenuToggle = (event: SyntheticEvent<HTMLDetailsElement>): void => {
    const details = event.currentTarget;
    const dropdown = details.querySelector(".agent-menu-dropdown") as HTMLElement | null;
    if (!dropdown || !details.open) {
      return;
    }
    const rect = dropdown.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.top;
    const dropdownHeight = rect.height;
    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      dropdown.classList.add("agent-menu-dropdown-up");
    } else {
      dropdown.classList.remove("agent-menu-dropdown-up");
    }
  };

  const handleCardClick = (event: ReactMouseEvent<HTMLElement>, agentId: string): void => {
    if (!isCardOpenInteractionTarget(event.target)) {
      return;
    }
    onOpenAgentFromCard(agentId);
  };

  const handleCardKeyDown = (event: ReactKeyboardEvent<HTMLElement>, agentId: string): void => {
    if (event.target !== event.currentTarget || !isListRowOpenKey(event.key)) {
      return;
    }
    event.preventDefault();
    onOpenAgentFromCard(agentId);
  };

  const setArchivedFromList = async (params: {
    agentId: string;
    archived: boolean;
  }): Promise<void> => {
    setAgents((current) =>
      applyAgentArchivedListUpdate({
        agents: current,
        agentId: params.agentId,
        archived: params.archived,
        archivedFilter,
      }),
    );
    const result = await window.api.agents.setArchived({
      id: params.agentId,
      archived: params.archived,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      await loadAgents({ page: 1, append: false });
      return;
    }
    pushToast("info", params.archived ? "Agent archived." : "Agent restored.");
    await loadAgents({ page: 1, append: false });
  };

  const confirmDelete = async (): Promise<void> => {
    if (pendingDelete === null) {
      return;
    }
    const result = await window.api.agents.delete({ id: pendingDelete.id });
    setPendingDelete(null);
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      return;
    }
    pushToast("info", "Agent deleted.");
    await loadAgents({ page: 1, append: false });
  };

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
      hidden={!isActive}
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
        onClearFilters={clearFilters}
        onCommitTagFilter={() => commitTagFilter()}
        onSetArchivedFilter={(value) => setArchivedFilter(value as AgentArchivedFilter)}
        onSetSearchText={setSearchText}
        onSetSortBy={(value) => setSortBy(value as AgentSortField)}
        onSetSortDirection={(value) => setSortDirection(value as SortDirection)}
        onSetTagFilterDraft={setTagFilterDraft}
        onTagFilterRemove={() => {
          setTagFilterDraft("");
          setTagFilter("");
        }}
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
        tagFilterDraft={tagFilterDraft}
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
            onCardClick={handleCardClick}
            onCardKeyDown={handleCardKeyDown}
            onDelete={setPendingDelete}
            onMenuToggle={handleMenuToggle}
            onSetArchived={setArchivedFromList}
            onTagClick={applyTagFilterFromCard}
          />
        ))}
        {hasMore ? (
          <div className="agents-load-more">
            <button
              className="secondary"
              disabled={isLoadingMore}
              onClick={() => void loadAgents({ page: page + 1, append: true })}
              type="button"
            >
              {isLoadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        confirmLabel="Delete"
        message={pendingDelete === null ? "" : `Delete agent "${pendingDelete.name}" permanently?`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
        open={pendingDelete !== null}
        title="Delete agent?"
      />
    </section>
  );
};
