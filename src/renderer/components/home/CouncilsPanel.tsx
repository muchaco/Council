import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  SyntheticEvent,
} from "react";

import { formatHomeListTotal } from "../../../shared/app-ui-helpers.js";
import type {
  CouncilArchivedFilter,
  CouncilDto,
  CouncilSortField,
  SortDirection,
} from "../../../shared/ipc/dto";
import { CouncilCard } from "../councils/CouncilCard";
import { HomeListToolbar } from "../shared/HomeListToolbar";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type CouncilsPanelProps = {
  archivedFilter: CouncilArchivedFilter;
  councils: ReadonlyArray<CouncilDto>;
  error: string | null;
  exportingCouncilId: string | null;
  hasActiveFilters: boolean;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  page: number;
  searchText: string;
  sortBy: CouncilSortField;
  sortDirection: SortDirection;
  tagFilter: string;
  total: number;
  onClearFilters: () => void;
  onDelete: (council: CouncilDto) => void;
  onExport: (councilId: string) => void;
  onLoadMore: () => void;
  onMenuKeyDown: (event: ReactKeyboardEvent<HTMLDetailsElement>) => void;
  onMenuSummaryKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  onMenuToggle: (event: SyntheticEvent<HTMLDetailsElement>) => void;
  onOpenCouncilEditor: () => void;
  onOpenCouncilView: (
    event: ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>,
    councilId: string,
  ) => void;
  onSetArchived: (params: { councilId: string; archived: boolean }) => void;
  onSetArchivedFilter: (value: CouncilArchivedFilter) => void;
  onSetSearchText: (value: string) => void;
  onSetSortBy: (value: CouncilSortField) => void;
  onSetSortDirection: (value: SortDirection) => void;
  onSetTagFilter: (value: string) => void;
};

export const CouncilsPanel = ({
  archivedFilter,
  councils,
  error,
  exportingCouncilId,
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
  onExport,
  onLoadMore,
  onMenuKeyDown,
  onMenuSummaryKeyDown,
  onMenuToggle,
  onOpenCouncilEditor,
  onOpenCouncilView,
  onSetArchived,
  onSetArchivedFilter,
  onSetSearchText,
  onSetSortBy,
  onSetSortDirection,
  onSetTagFilter,
}: CouncilsPanelProps): JSX.Element => {
  const totalLabel = formatHomeListTotal({ total, singularLabel: "council" });
  const emptyMessage =
    archivedFilter === "archived"
      ? "No archived councils found."
      : archivedFilter === "active"
        ? "No active councils found."
        : "No councils yet. Create your first council to get started.";

  return (
    <section
      aria-labelledby="home-tab-councils"
      className="space-y-5"
      id="home-panel-councils"
      role="tabpanel"
    >
      <HomeListToolbar
        actionLabel="New Council"
        archivedFilterValue={archivedFilter}
        archivedOptions={[
          { value: "all", label: "All councils" },
          { value: "active", label: "Active only" },
          { value: "archived", label: "Archived only" },
        ]}
        hasActiveFilters={hasActiveFilters}
        isLoading={isLoading}
        metaLabel={isLoading ? "Loading councils..." : totalLabel}
        onAction={onOpenCouncilEditor}
        onClearFilters={onClearFilters}
        onSetArchivedFilter={(value) => onSetArchivedFilter(value as CouncilArchivedFilter)}
        onSetSearchText={onSetSearchText}
        onSetSortBy={(value) => onSetSortBy(value as CouncilSortField)}
        onSetSortDirection={(value) => onSetSortDirection(value as SortDirection)}
        onSetTagFilter={onSetTagFilter}
        searchAriaLabel="Search councils"
        searchPlaceholder="Search title or topic"
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
        toolbarClassName="home-list-toolbar-councils"
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
            onCardClick={(event, councilId) => onOpenCouncilView(event, councilId)}
            onCardKeyDown={(event, councilId) => onOpenCouncilView(event, councilId)}
            onDelete={onDelete}
            onExport={onExport}
            onMenuKeyDown={onMenuKeyDown}
            onMenuSummaryKeyDown={onMenuSummaryKeyDown}
            onMenuToggle={onMenuToggle}
            onSetArchived={onSetArchived}
          />
        ))}
        {hasMore ? (
          <div className="col-span-full flex justify-center pt-4">
            <Button disabled={isLoadingMore} onClick={onLoadMore} type="button" variant="outline">
              {isLoadingMore ? "Loading..." : "Load more councils"}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
};
