import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  SyntheticEvent,
} from "react";

import {
  type AgentHomeListFilters,
  DEFAULT_AGENT_HOME_LIST_FILTERS,
  appendCommittedTagFilter,
  applyAgentArchivedListUpdate,
  formatHomeListTotal,
  hasAppliedAgentHomeListPopoverFilters,
  hasPendingAgentHomeListQueryChanges,
  parseTagDraft,
  removeCommittedTagFilter,
  resetAgentHomeListPopoverFilters,
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
  const [draftFilters, setDraftFilters] = useState<AgentHomeListFilters>(
    DEFAULT_AGENT_HOME_LIST_FILTERS,
  );
  const [appliedFilters, setAppliedFilters] = useState<AgentHomeListFilters>(
    DEFAULT_AGENT_HOME_LIST_FILTERS,
  );
  const [tagFilterDraft, setTagFilterDraft] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
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
        searchText: appliedFilters.searchText,
        tagFilter: appliedFilters.tagFilter,
        archivedFilter: appliedFilters.archivedFilter,
        sortBy: appliedFilters.sortBy,
        sortDirection: appliedFilters.sortDirection,
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
    [appliedFilters, onTotalChange, pushToast],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }
    void loadAgents({ page: 1, append: false });
    void refreshVersion;
  }, [isActive, loadAgents, refreshVersion]);

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

  const hasPendingChanges = useMemo(
    () =>
      hasPendingAgentHomeListQueryChanges({
        draft: draftFilters,
        applied: appliedFilters,
      }),
    [appliedFilters, draftFilters],
  );

  const hasAppliedPopoverFilters = useMemo(
    () => hasAppliedAgentHomeListPopoverFilters(appliedFilters),
    [appliedFilters],
  );

  const refreshAgents = useCallback((): void => {
    setAppliedFilters(draftFilters);
    setRefreshVersion((current) => current + 1);
  }, [draftFilters]);

  const resetFilters = useCallback((): void => {
    const nextFilters = resetAgentHomeListPopoverFilters(draftFilters.searchText);
    setTagFilterDraft("");
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setRefreshVersion((current) => current + 1);
  }, [draftFilters.searchText]);

  const commitTagFilter = useCallback(
    (nextDraft?: string): void => {
      const resolvedDraft = nextDraft ?? tagFilterDraft;
      const nextFilter = appendCommittedTagFilter({
        currentTagFilter: draftFilters.tagFilter,
        tagInput: resolvedDraft,
      });
      if (!nextFilter.ok) {
        pushToast("warning", nextFilter.message);
        return;
      }
      setTagFilterDraft("");
      setDraftFilters((current) => ({
        ...current,
        tagFilter: nextFilter.tagFilter,
      }));
    },
    [draftFilters.tagFilter, pushToast, tagFilterDraft],
  );

  const applyTagFilterFromCard = useCallback(
    (tag: string): void => {
      const nextFilter = appendCommittedTagFilter({
        currentTagFilter: draftFilters.tagFilter,
        tagInput: tag,
      });
      if (!nextFilter.ok) {
        return;
      }
      const nextDraft = {
        ...draftFilters,
        tagFilter: nextFilter.tagFilter,
      } satisfies AgentHomeListFilters;
      setTagFilterDraft("");
      setDraftFilters(nextDraft);
      setAppliedFilters(nextDraft);
      setRefreshVersion((current) => current + 1);
    },
    [draftFilters],
  );

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
        archivedFilter: appliedFilters.archivedFilter,
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
    appliedFilters.archivedFilter === "archived"
      ? "No archived agents found."
      : appliedFilters.archivedFilter === "active"
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
        actionAriaLabel="Create new agent"
        actionLabel="New"
        archivedFilterValue={draftFilters.archivedFilter}
        archivedOptions={[
          { value: "all", label: "All agents" },
          { value: "active", label: "Active only" },
          { value: "archived", label: "Archived only" },
        ]}
        hasAppliedPopoverFilters={hasAppliedPopoverFilters}
        hasPendingChanges={hasPendingChanges}
        isLoading={isLoading}
        metaLabel={isLoading ? "Loading agents..." : totalLabel}
        onAction={onOpenAgentEditor}
        onApplyFilters={refreshAgents}
        onCommitTagFilter={() => commitTagFilter()}
        onRefresh={refreshAgents}
        onResetFilters={resetFilters}
        onSetArchivedFilter={(value) =>
          setDraftFilters((current) => ({
            ...current,
            archivedFilter: value as AgentArchivedFilter,
          }))
        }
        onSetSearchText={(value) =>
          setDraftFilters((current) => ({
            ...current,
            searchText: value,
          }))
        }
        onSetSortBy={(value) =>
          setDraftFilters((current) => ({
            ...current,
            sortBy: value as AgentSortField,
          }))
        }
        onSetSortDirection={(value) =>
          setDraftFilters((current) => ({
            ...current,
            sortDirection: value as SortDirection,
          }))
        }
        onSetTagFilterDraft={setTagFilterDraft}
        onTagFilterRemove={(tag) => {
          const nextFilter = removeCommittedTagFilter({
            currentTagFilter: draftFilters.tagFilter,
            tagToRemove: tag,
          });
          setDraftFilters((current) => ({
            ...current,
            tagFilter: nextFilter.tagFilter,
          }));
        }}
        popoverTitle="Agent filters"
        searchAriaLabel="Search agents"
        searchPlaceholder="Search name or prompt"
        searchText={draftFilters.searchText}
        sortByOptions={[
          { value: "updatedAt", label: "Last modified" },
          { value: "createdAt", label: "Date created" },
        ]}
        sortByValue={draftFilters.sortBy}
        sortDirectionOptions={[
          { value: "desc", label: "Newest first" },
          { value: "asc", label: "Oldest first" },
        ]}
        sortDirectionValue={draftFilters.sortDirection}
        tagFilter={parseTagDraft(draftFilters.tagFilter)}
        tagFilterDraft={tagFilterDraft}
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
