import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  SyntheticEvent,
} from "react";

import {
  DEFAULT_AGENT_HOME_LIST_FILTERS,
  DEFAULT_COUNCIL_HOME_LIST_FILTERS,
  applyAgentArchivedListUpdate,
  hasActiveAgentHomeListFilters,
  hasActiveCouncilHomeListFilters,
} from "../../../shared/app-ui-helpers.js";
import type { ModelRef } from "../../../shared/domain/model-ref";
import {
  isCardOpenInteractionTarget,
  isListRowOpenKey,
  resolveHomeTabFocusIndex,
} from "../../../shared/home-keyboard-accessibility.js";
import type {
  AgentArchivedFilter,
  AgentDto,
  AgentSortField,
  CouncilArchivedFilter,
  CouncilDto,
  CouncilSortField,
  SortDirection,
} from "../../../shared/ipc/dto";
import { ConfirmDialog } from "../../ConfirmDialog";
import { type HomeTab, HomeTopBar } from "../navigation/HomeTopBar";
import { SettingsPanel } from "../settings/SettingsPanel";
import { AgentsPanel } from "./AgentsPanel";
import { CouncilsPanel } from "./CouncilsPanel";

const HOME_TAB_ORDER: ReadonlyArray<HomeTab> = ["councils", "agents", "settings"];

type HomeScreenProps = {
  activeTab: HomeTab;
  isActive: boolean;
  onOpenAgentEditor: (agentId: string | null) => void;
  onOpenCouncilEditor: (councilId: string | null) => void;
  onOpenCouncilView: (councilId: string) => void;
  onTabChange: (tab: HomeTab) => void;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
};

export const HomeScreen = ({
  activeTab,
  isActive,
  onOpenAgentEditor,
  onOpenCouncilEditor,
  onOpenCouncilView,
  onTabChange,
  pushToast,
}: HomeScreenProps): JSX.Element => {
  const [agents, setAgents] = useState<ReadonlyArray<AgentDto>>([]);
  const [agentsPage, setAgentsPage] = useState(1);
  const [agentsHasMore, setAgentsHasMore] = useState(false);
  const [agentsTotal, setAgentsTotal] = useState(0);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsLoadingMore, setAgentsLoadingMore] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [agentsSortBy, setAgentsSortBy] = useState<AgentSortField>(
    DEFAULT_AGENT_HOME_LIST_FILTERS.sortBy,
  );
  const [agentsSortDirection, setAgentsSortDirection] = useState<SortDirection>(
    DEFAULT_AGENT_HOME_LIST_FILTERS.sortDirection,
  );
  const [agentsSearchText, setAgentsSearchText] = useState(
    DEFAULT_AGENT_HOME_LIST_FILTERS.searchText,
  );
  const [agentsTagFilter, setAgentsTagFilter] = useState(DEFAULT_AGENT_HOME_LIST_FILTERS.tagFilter);
  const [agentsArchivedFilter, setAgentsArchivedFilter] = useState<AgentArchivedFilter>(
    DEFAULT_AGENT_HOME_LIST_FILTERS.archivedFilter,
  );
  const [agentsGlobalDefaultModel, setAgentsGlobalDefaultModel] = useState<ModelRef | null>(null);
  const [councils, setCouncils] = useState<ReadonlyArray<CouncilDto>>([]);
  const [councilsPage, setCouncilsPage] = useState(1);
  const [councilsHasMore, setCouncilsHasMore] = useState(false);
  const [councilsTotal, setCouncilsTotal] = useState(0);
  const [councilsLoading, setCouncilsLoading] = useState(false);
  const [councilsLoadingMore, setCouncilsLoadingMore] = useState(false);
  const [councilsError, setCouncilsError] = useState<string | null>(null);
  const [councilsSortBy, setCouncilsSortBy] = useState<CouncilSortField>(
    DEFAULT_COUNCIL_HOME_LIST_FILTERS.sortBy,
  );
  const [councilsSortDirection, setCouncilsSortDirection] = useState<SortDirection>(
    DEFAULT_COUNCIL_HOME_LIST_FILTERS.sortDirection,
  );
  const [councilsSearchText, setCouncilsSearchText] = useState(
    DEFAULT_COUNCIL_HOME_LIST_FILTERS.searchText,
  );
  const [councilsTagFilter, setCouncilsTagFilter] = useState(
    DEFAULT_COUNCIL_HOME_LIST_FILTERS.tagFilter,
  );
  const [councilsArchivedFilter, setCouncilsArchivedFilter] = useState<CouncilArchivedFilter>(
    DEFAULT_COUNCIL_HOME_LIST_FILTERS.archivedFilter,
  );
  const [councilsGlobalDefaultModel, setCouncilsGlobalDefaultModel] = useState<ModelRef | null>(
    null,
  );
  const [exportingCouncilId, setExportingCouncilId] = useState<string | null>(null);
  const [pendingCouncilListDelete, setPendingCouncilListDelete] = useState<CouncilDto | null>(null);
  const [pendingAgentListDelete, setPendingAgentListDelete] = useState<AgentDto | null>(null);
  const homeTabButtonRefs = useRef<Record<HomeTab, HTMLButtonElement | null>>({
    councils: null,
    agents: null,
    settings: null,
  });

  useEffect(() => {
    if (!isActive) {
      return;
    }
    document.title = activeTab === "settings" ? "Settings" : "Council";
  }, [activeTab, isActive]);

  const loadAgents = useCallback(
    async (params: { page: number; append: boolean }): Promise<void> => {
      if (params.append) {
        setAgentsLoadingMore(true);
      } else {
        setAgentsLoading(true);
      }
      setAgentsError(null);
      const result = await window.api.agents.list({
        viewKind: "agentsList",
        searchText: agentsSearchText,
        tagFilter: agentsTagFilter,
        archivedFilter: agentsArchivedFilter,
        sortBy: agentsSortBy,
        sortDirection: agentsSortDirection,
        page: params.page,
      });
      if (!result.ok) {
        setAgentsError(result.error.userMessage);
        pushToast("error", result.error.userMessage);
        setAgentsLoading(false);
        setAgentsLoadingMore(false);
        return;
      }
      setAgents((current) =>
        params.append ? [...current, ...result.value.items] : result.value.items,
      );
      setAgentsPage(result.value.page);
      setAgentsHasMore(result.value.hasMore);
      setAgentsTotal(result.value.total);
      setAgentsGlobalDefaultModel(result.value.globalDefaultModelRef);
      setAgentsLoading(false);
      setAgentsLoadingMore(false);
    },
    [
      agentsArchivedFilter,
      agentsSearchText,
      agentsSortBy,
      agentsSortDirection,
      agentsTagFilter,
      pushToast,
    ],
  );

  const loadCouncils = useCallback(
    async (params: { page: number; append: boolean }): Promise<void> => {
      if (params.append) {
        setCouncilsLoadingMore(true);
      } else {
        setCouncilsLoading(true);
      }
      setCouncilsError(null);
      const result = await window.api.councils.list({
        viewKind: "councilsList",
        searchText: councilsSearchText,
        tagFilter: councilsTagFilter,
        archivedFilter: councilsArchivedFilter,
        sortBy: councilsSortBy,
        sortDirection: councilsSortDirection,
        page: params.page,
      });
      if (!result.ok) {
        setCouncilsError(result.error.userMessage);
        pushToast("error", result.error.userMessage);
        setCouncilsLoading(false);
        setCouncilsLoadingMore(false);
        return;
      }
      setCouncils((current) =>
        params.append ? [...current, ...result.value.items] : result.value.items,
      );
      setCouncilsPage(result.value.page);
      setCouncilsHasMore(result.value.hasMore);
      setCouncilsTotal(result.value.total);
      setCouncilsGlobalDefaultModel(result.value.globalDefaultModelRef);
      setCouncilsLoading(false);
      setCouncilsLoadingMore(false);
    },
    [
      councilsArchivedFilter,
      councilsSearchText,
      councilsSortBy,
      councilsSortDirection,
      councilsTagFilter,
      pushToast,
    ],
  );

  useEffect(() => {
    if (activeTab === "agents") {
      void loadAgents({ page: 1, append: false });
    }
  }, [activeTab, loadAgents]);

  useEffect(() => {
    if (activeTab === "councils") {
      void loadCouncils({ page: 1, append: false });
    }
  }, [activeTab, loadCouncils]);

  useEffect(() => {
    if (!isActive || activeTab !== "councils") {
      return;
    }
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const openMenus = document.querySelectorAll<HTMLDetailsElement>(
        ".council-actions-menu[open]",
      );
      for (const menu of openMenus) {
        if (!menu.contains(target)) {
          menu.open = false;
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeTab, isActive]);

  useEffect(() => {
    if (!isActive || activeTab !== "agents") {
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
  }, [activeTab, isActive]);

  const hasActiveAgentsHomeListFilters = useMemo(
    () =>
      hasActiveAgentHomeListFilters({
        searchText: agentsSearchText,
        tagFilter: agentsTagFilter,
        archivedFilter: agentsArchivedFilter,
        sortBy: agentsSortBy,
        sortDirection: agentsSortDirection,
      }),
    [agentsArchivedFilter, agentsSearchText, agentsSortBy, agentsSortDirection, agentsTagFilter],
  );

  const hasActiveCouncilsHomeListFilters = useMemo(
    () =>
      hasActiveCouncilHomeListFilters({
        searchText: councilsSearchText,
        tagFilter: councilsTagFilter,
        archivedFilter: councilsArchivedFilter,
        sortBy: councilsSortBy,
        sortDirection: councilsSortDirection,
      }),
    [
      councilsArchivedFilter,
      councilsSearchText,
      councilsSortBy,
      councilsSortDirection,
      councilsTagFilter,
    ],
  );

  const clearAgentHomeListFilters = useCallback((): void => {
    setAgentsSearchText(DEFAULT_AGENT_HOME_LIST_FILTERS.searchText);
    setAgentsTagFilter(DEFAULT_AGENT_HOME_LIST_FILTERS.tagFilter);
    setAgentsArchivedFilter(DEFAULT_AGENT_HOME_LIST_FILTERS.archivedFilter);
    setAgentsSortBy(DEFAULT_AGENT_HOME_LIST_FILTERS.sortBy);
    setAgentsSortDirection(DEFAULT_AGENT_HOME_LIST_FILTERS.sortDirection);
  }, []);

  const clearCouncilHomeListFilters = useCallback((): void => {
    setCouncilsSearchText(DEFAULT_COUNCIL_HOME_LIST_FILTERS.searchText);
    setCouncilsTagFilter(DEFAULT_COUNCIL_HOME_LIST_FILTERS.tagFilter);
    setCouncilsArchivedFilter(DEFAULT_COUNCIL_HOME_LIST_FILTERS.archivedFilter);
    setCouncilsSortBy(DEFAULT_COUNCIL_HOME_LIST_FILTERS.sortBy);
    setCouncilsSortDirection(DEFAULT_COUNCIL_HOME_LIST_FILTERS.sortDirection);
  }, []);

  const handleHomeTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentTab: HomeTab,
  ): void => {
    const currentIndex = HOME_TAB_ORDER.indexOf(currentTab);
    if (currentIndex < 0) {
      return;
    }
    const nextIndex = resolveHomeTabFocusIndex({
      currentIndex,
      key: event.key,
      totalTabs: HOME_TAB_ORDER.length,
    });
    if (nextIndex === null || nextIndex === currentIndex) {
      return;
    }
    event.preventDefault();
    const nextTab = HOME_TAB_ORDER[nextIndex];
    if (nextTab === undefined) {
      return;
    }
    onTabChange(nextTab);
    homeTabButtonRefs.current[nextTab]?.focus();
  };

  const handleCouncilRowMenuKeyDown = (event: ReactKeyboardEvent<HTMLDetailsElement>): void => {
    if (event.key !== "Escape" || !event.currentTarget.open) {
      return;
    }
    event.preventDefault();
    event.currentTarget.open = false;
    const summary = event.currentTarget.querySelector("summary");
    if (summary instanceof HTMLElement) {
      summary.focus();
    }
  };

  const handleCouncilMenuToggle = (event: SyntheticEvent<HTMLDetailsElement>): void => {
    const details = event.currentTarget;
    const dropdown = details.querySelector(".council-menu-dropdown") as HTMLElement | null;
    if (!dropdown || !details.open) {
      return;
    }
    const rect = dropdown.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.top;
    const dropdownHeight = rect.height;
    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      dropdown.classList.add("council-menu-dropdown-up");
    } else {
      dropdown.classList.remove("council-menu-dropdown-up");
    }
  };

  const handleAgentMenuToggle = (event: SyntheticEvent<HTMLDetailsElement>): void => {
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

  const focusCouncilRowMenuAction = (
    detailsElement: HTMLDetailsElement,
    position: "first" | "last",
  ): void => {
    const actionButtons = Array.from(
      detailsElement.querySelectorAll<HTMLButtonElement>(".row-menu-items button:not(:disabled)"),
    );
    const target =
      position === "first" ? actionButtons[0] : actionButtons[actionButtons.length - 1];
    target?.focus();
  };

  const handleCouncilRowMenuSummaryKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    const detailsElement = event.currentTarget.closest("details");
    if (!(detailsElement instanceof HTMLDetailsElement)) {
      return;
    }
    if (event.key === "Escape") {
      if (!detailsElement.open) {
        return;
      }
      event.preventDefault();
      detailsElement.open = false;
      event.currentTarget.focus();
      return;
    }
    if (!["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    detailsElement.open = true;
    focusCouncilRowMenuAction(detailsElement, event.key === "ArrowUp" ? "last" : "first");
  };

  const handleCouncilCardClick = (event: ReactMouseEvent<HTMLElement>, councilId: string): void => {
    if (!isCardOpenInteractionTarget(event.target)) {
      return;
    }
    onOpenCouncilView(councilId);
  };

  const handleCouncilCardKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
    councilId: string,
  ): void => {
    if (event.target !== event.currentTarget || !isListRowOpenKey(event.key)) {
      return;
    }
    event.preventDefault();
    onOpenCouncilView(councilId);
  };

  const handleAgentCardClick = (event: ReactMouseEvent<HTMLElement>, agentId: string): void => {
    if (!isCardOpenInteractionTarget(event.target)) {
      return;
    }
    onOpenAgentEditor(agentId);
  };

  const handleAgentCardKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
    agentId: string,
  ): void => {
    if (event.target !== event.currentTarget || !isListRowOpenKey(event.key)) {
      return;
    }
    event.preventDefault();
    onOpenAgentEditor(agentId);
  };

  const exportCouncilTranscript = async (councilId: string): Promise<void> => {
    setExportingCouncilId(councilId);
    const result = await window.api.councils.exportTranscript({
      viewKind: "councilsList",
      id: councilId,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setExportingCouncilId(null);
      return;
    }
    setExportingCouncilId(null);
    if (result.value.status === "cancelled") {
      pushToast("warning", "Export cancelled.");
      return;
    }
    pushToast("info", `Transcript exported to ${result.value.filePath}`);
  };

  const setCouncilArchivedFromList = async (params: {
    councilId: string;
    archived: boolean;
  }): Promise<void> => {
    const result = await window.api.councils.setArchived({
      id: params.councilId,
      archived: params.archived,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      return;
    }
    pushToast("info", params.archived ? "Council archived." : "Council restored.");
    await loadCouncils({ page: 1, append: false });
  };

  const confirmDeleteCouncilFromList = async (): Promise<void> => {
    if (pendingCouncilListDelete === null) {
      return;
    }
    const result = await window.api.councils.delete({ id: pendingCouncilListDelete.id });
    setPendingCouncilListDelete(null);
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      return;
    }
    pushToast("info", "Council deleted.");
    await loadCouncils({ page: 1, append: false });
  };

  const confirmDeleteAgentFromList = async (): Promise<void> => {
    if (pendingAgentListDelete === null) {
      return;
    }
    const result = await window.api.agents.delete({ id: pendingAgentListDelete.id });
    setPendingAgentListDelete(null);
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      return;
    }
    pushToast("info", "Agent deleted.");
    await loadAgents({ page: 1, append: false });
  };

  const setAgentArchivedFromList = async (params: {
    agentId: string;
    archived: boolean;
  }): Promise<void> => {
    setAgents((current) =>
      applyAgentArchivedListUpdate({
        agents: current,
        agentId: params.agentId,
        archived: params.archived,
        archivedFilter: agentsArchivedFilter,
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

  return (
    <div className="app-shell" hidden={!isActive}>
      <main className="main-content">
        <div className="main-content-inner">
          <HomeTopBar
            activeTab={activeTab}
            agentsTotal={agentsTotal}
            councilsTotal={councilsTotal}
            homeTabButtonRefs={homeTabButtonRefs}
            onHomeTabKeyDown={handleHomeTabKeyDown}
            onTabChange={onTabChange}
          />

          {activeTab === "councils" ? (
            <CouncilsPanel
              archivedFilter={councilsArchivedFilter}
              councils={councils}
              error={councilsError}
              exportingCouncilId={exportingCouncilId}
              hasActiveFilters={hasActiveCouncilsHomeListFilters}
              hasMore={councilsHasMore}
              isLoading={councilsLoading}
              isLoadingMore={councilsLoadingMore}
              onClearFilters={clearCouncilHomeListFilters}
              onDelete={setPendingCouncilListDelete}
              onExport={(councilId) => void exportCouncilTranscript(councilId)}
              onLoadMore={() => void loadCouncils({ page: councilsPage + 1, append: true })}
              onMenuKeyDown={handleCouncilRowMenuKeyDown}
              onMenuSummaryKeyDown={handleCouncilRowMenuSummaryKeyDown}
              onMenuToggle={handleCouncilMenuToggle}
              onOpenCouncilEditor={() => onOpenCouncilEditor(null)}
              onOpenCouncilView={(event, councilId) => {
                if ("key" in event) {
                  handleCouncilCardKeyDown(event, councilId);
                } else {
                  handleCouncilCardClick(event, councilId);
                }
              }}
              onSetArchived={(params) => void setCouncilArchivedFromList(params)}
              onSetArchivedFilter={setCouncilsArchivedFilter}
              onSetSearchText={setCouncilsSearchText}
              onSetSortBy={setCouncilsSortBy}
              onSetSortDirection={setCouncilsSortDirection}
              onSetTagFilter={setCouncilsTagFilter}
              page={councilsPage}
              searchText={councilsSearchText}
              sortBy={councilsSortBy}
              sortDirection={councilsSortDirection}
              tagFilter={councilsTagFilter}
              total={councilsTotal}
            />
          ) : null}

          {activeTab === "agents" ? (
            <AgentsPanel
              agents={agents}
              archivedFilter={agentsArchivedFilter}
              error={agentsError}
              globalDefaultModel={agentsGlobalDefaultModel}
              hasActiveFilters={hasActiveAgentsHomeListFilters}
              hasMore={agentsHasMore}
              isLoading={agentsLoading}
              isLoadingMore={agentsLoadingMore}
              onClearFilters={clearAgentHomeListFilters}
              onDelete={setPendingAgentListDelete}
              onLoadMore={() => void loadAgents({ page: agentsPage + 1, append: true })}
              onMenuToggle={handleAgentMenuToggle}
              onOpenAgentEditor={() => onOpenAgentEditor(null)}
              onOpenAgentFromCard={(event, agentId) => {
                if ("key" in event) {
                  handleAgentCardKeyDown(event, agentId);
                } else {
                  handleAgentCardClick(event, agentId);
                }
              }}
              onSetArchived={(params) => void setAgentArchivedFromList(params)}
              onSetArchivedFilter={setAgentsArchivedFilter}
              onSetSearchText={setAgentsSearchText}
              onSetSortBy={setAgentsSortBy}
              onSetSortDirection={setAgentsSortDirection}
              onSetTagFilter={setAgentsTagFilter}
              page={agentsPage}
              searchText={agentsSearchText}
              sortBy={agentsSortBy}
              sortDirection={agentsSortDirection}
              tagFilter={agentsTagFilter}
              total={agentsTotal}
            />
          ) : null}

          {activeTab === "settings" ? (
            <SettingsPanel isActive={isActive && activeTab === "settings"} pushToast={pushToast} />
          ) : null}

          <ConfirmDialog
            confirmLabel="Delete"
            confirmTone="danger"
            message={
              pendingCouncilListDelete === null
                ? ""
                : `Delete council "${pendingCouncilListDelete.title}" permanently?`
            }
            onCancel={() => setPendingCouncilListDelete(null)}
            onConfirm={() => {
              void confirmDeleteCouncilFromList();
            }}
            open={pendingCouncilListDelete !== null}
            title="Delete council?"
          />

          <ConfirmDialog
            confirmLabel="Delete"
            message={
              pendingAgentListDelete === null
                ? ""
                : `Delete agent "${pendingAgentListDelete.name}" permanently?`
            }
            onCancel={() => setPendingAgentListDelete(null)}
            onConfirm={() => {
              void confirmDeleteAgentFromList();
            }}
            open={pendingAgentListDelete !== null}
            title="Delete agent?"
          />
        </div>
      </main>
    </div>
  );
};
