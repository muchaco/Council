import { Plus } from "lucide-react";
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
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

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
      <div className="home-list-toolbar home-list-toolbar-councils">
        <div aria-live="polite" className="home-list-toolbar-meta">
          {isLoading ? "Loading councils..." : totalLabel}
        </div>
        <div className="home-list-toolbar-fields home-list-toolbar-fields-wide">
          <Input
            aria-label="Search councils"
            className="home-list-toolbar-search"
            onChange={(event) => onSetSearchText(event.target.value)}
            placeholder="Search title or topic"
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
            onValueChange={(value) => onSetArchivedFilter(value as CouncilArchivedFilter)}
          >
            <SelectTrigger className="home-list-toolbar-select">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All councils</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="archived">Archived only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => onSetSortBy(value as CouncilSortField)}>
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
          onClick={onOpenCouncilEditor}
          type="button"
        >
          <Plus className="h-4 w-4" />
          New Council
        </Button>
      </div>

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
