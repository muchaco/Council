import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  SyntheticEvent,
} from "react";

import {
  type CouncilHomeListFilters,
  DEFAULT_COUNCIL_HOME_LIST_FILTERS,
  appendCommittedTagFilter,
  hasAppliedCouncilHomeListPopoverFilters,
  hasPendingCouncilHomeListQueryChanges,
  parseTagDraft,
  removeCommittedTagFilter,
  resetCouncilHomeListPopoverFilters,
} from "../../../shared/app-ui-helpers.js";
import {
  isCardOpenInteractionTarget,
  isListRowOpenKey,
} from "../../../shared/home-keyboard-accessibility.js";
import type {
  CouncilArchivedFilter,
  CouncilDto,
  CouncilSortField,
  SortDirection,
} from "../../../shared/ipc/dto";
import { ConfirmDialog } from "../../ConfirmDialog";
import { CouncilCard } from "../councils/CouncilCard";
import { HomeListToolbar } from "../shared/HomeListToolbar";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type CouncilsPanelProps = {
  isActive: boolean;
  onOpenCouncilEditor: () => void;
  onOpenCouncilView: (councilId: string) => void;
  onTotalChange: (total: number) => void;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
};

export const CouncilsPanel = ({
  isActive,
  onOpenCouncilEditor,
  onOpenCouncilView,
  onTotalChange,
  pushToast,
}: CouncilsPanelProps): JSX.Element => {
  const [councils, setCouncils] = useState<ReadonlyArray<CouncilDto>>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<CouncilHomeListFilters>(
    DEFAULT_COUNCIL_HOME_LIST_FILTERS,
  );
  const [appliedFilters, setAppliedFilters] = useState<CouncilHomeListFilters>(
    DEFAULT_COUNCIL_HOME_LIST_FILTERS,
  );
  const [tagFilterDraft, setTagFilterDraft] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [exportingCouncilId, setExportingCouncilId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CouncilDto | null>(null);

  const loadCouncils = useCallback(
    async (params: { page: number; append: boolean }): Promise<void> => {
      if (params.append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const result = await window.api.councils.list({
        viewKind: "councilsList",
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
      setCouncils((current) =>
        params.append ? [...current, ...result.value.items] : result.value.items,
      );
      setPage(result.value.page);
      setHasMore(result.value.hasMore);
      onTotalChange(result.value.total);
      setIsLoading(false);
      setIsLoadingMore(false);
    },
    [appliedFilters, onTotalChange, pushToast],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }
    void refreshVersion;
    void loadCouncils({ page: 1, append: false });
  }, [isActive, loadCouncils, refreshVersion]);

  useEffect(() => {
    if (!isActive) {
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
  }, [isActive]);

  const hasPendingChanges = useMemo(
    () =>
      hasPendingCouncilHomeListQueryChanges({
        draft: draftFilters,
        applied: appliedFilters,
      }),
    [appliedFilters, draftFilters],
  );

  const hasAppliedPopoverFilters = useMemo(
    () => hasAppliedCouncilHomeListPopoverFilters(appliedFilters),
    [appliedFilters],
  );

  const refreshCouncils = useCallback((): void => {
    setAppliedFilters(draftFilters);
    setRefreshVersion((current) => current + 1);
  }, [draftFilters]);

  const resetFilters = useCallback((): void => {
    const nextFilters = resetCouncilHomeListPopoverFilters(draftFilters.searchText);
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
      } satisfies CouncilHomeListFilters;
      setTagFilterDraft("");
      setDraftFilters(nextDraft);
      setAppliedFilters(nextDraft);
      setRefreshVersion((current) => current + 1);
    },
    [draftFilters],
  );

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDetailsElement>): void => {
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

  const focusMenuAction = (
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

  const handleMenuSummaryKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
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
    focusMenuAction(detailsElement, event.key === "ArrowUp" ? "last" : "first");
  };

  const handleMenuToggle = (event: SyntheticEvent<HTMLDetailsElement>): void => {
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

  const handleCardClick = (event: ReactMouseEvent<HTMLElement>, councilId: string): void => {
    if (!isCardOpenInteractionTarget(event.target)) {
      return;
    }
    onOpenCouncilView(councilId);
  };

  const handleCardKeyDown = (event: ReactKeyboardEvent<HTMLElement>, councilId: string): void => {
    if (event.target !== event.currentTarget || !isListRowOpenKey(event.key)) {
      return;
    }
    event.preventDefault();
    onOpenCouncilView(councilId);
  };

  const exportCouncilTranscript = async (councilId: string): Promise<void> => {
    setExportingCouncilId(councilId);
    const result = await window.api.councils.exportTranscript({
      viewKind: "councilsList",
      id: councilId,
    });
    setExportingCouncilId(null);
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      return;
    }
    if (result.value.status === "cancelled") {
      pushToast("warning", "Export cancelled.");
      return;
    }
    pushToast("info", `Transcript exported to ${result.value.filePath}`);
  };

  const setArchivedFromList = async (params: {
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

  const confirmDelete = async (): Promise<void> => {
    if (pendingDelete === null) {
      return;
    }
    const result = await window.api.councils.delete({ id: pendingDelete.id });
    setPendingDelete(null);
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      return;
    }
    pushToast("info", "Council deleted.");
    await loadCouncils({ page: 1, append: false });
  };

  const emptyMessage =
    appliedFilters.archivedFilter === "archived"
      ? "No archived councils found."
      : appliedFilters.archivedFilter === "active"
        ? "No active councils found."
        : "No councils yet. Create your first council to get started.";

  return (
    <section
      aria-labelledby="home-tab-councils"
      className="space-y-5"
      hidden={!isActive}
      id="home-panel-councils"
      role="tabpanel"
    >
      <HomeListToolbar
        actionAriaLabel="Create new council"
        actionLabel="New"
        archivedFilterValue={draftFilters.archivedFilter}
        archivedOptions={[
          { value: "all", label: "All councils" },
          { value: "active", label: "Active only" },
          { value: "archived", label: "Archived only" },
        ]}
        hasAppliedPopoverFilters={hasAppliedPopoverFilters}
        hasPendingChanges={hasPendingChanges}
        isLoading={isLoading}
        onAction={onOpenCouncilEditor}
        onApplyFilters={refreshCouncils}
        onCommitTagFilter={() => commitTagFilter()}
        onRefresh={refreshCouncils}
        onResetFilters={resetFilters}
        onSetArchivedFilter={(value) =>
          setDraftFilters((current) => ({
            ...current,
            archivedFilter: value as CouncilArchivedFilter,
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
            sortBy: value as CouncilSortField,
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
        popoverTitle="Council filters"
        searchAriaLabel="Search councils"
        searchPlaceholder="Search title or topic"
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

      {error !== null ? <p className="text-muted-foreground italic">Error: {error}</p> : null}
      {!isLoading && councils.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {councils.map((council) => (
          <CouncilCard
            council={council}
            exportingCouncilId={exportingCouncilId}
            key={council.id}
            onCardClick={handleCardClick}
            onCardKeyDown={handleCardKeyDown}
            onDelete={setPendingDelete}
            onExport={exportCouncilTranscript}
            onMenuKeyDown={handleMenuKeyDown}
            onMenuSummaryKeyDown={handleMenuSummaryKeyDown}
            onMenuToggle={handleMenuToggle}
            onSetArchived={setArchivedFromList}
            onTagClick={applyTagFilterFromCard}
          />
        ))}
        {hasMore ? (
          <div className="col-span-full flex justify-center pt-4">
            <Button
              disabled={isLoadingMore}
              onClick={() => void loadCouncils({ page: page + 1, append: true })}
              type="button"
              variant="outline"
            >
              {isLoadingMore ? "Loading..." : "Load more councils"}
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        confirmLabel="Delete"
        confirmTone="danger"
        message={
          pendingDelete === null ? "" : `Delete council "${pendingDelete.title}" permanently?`
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
        open={pendingDelete !== null}
        title="Delete council?"
      />
    </section>
  );
};
