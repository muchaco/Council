import { Plus } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type FilterOption = {
  value: string;
  label: string;
};

type HomeListToolbarProps = {
  actionLabel: string;
  archivedFilterValue: string;
  archivedOptions: ReadonlyArray<FilterOption>;
  hasActiveFilters: boolean;
  isLoading: boolean;
  metaLabel: string;
  searchAriaLabel: string;
  searchPlaceholder: string;
  searchText: string;
  sortByOptions: ReadonlyArray<FilterOption>;
  sortByValue: string;
  sortDirectionOptions: ReadonlyArray<FilterOption>;
  sortDirectionValue: string;
  tagFilter: string;
  toolbarClassName: string;
  onAction: () => void;
  onClearFilters: () => void;
  onSetArchivedFilter: (value: string) => void;
  onSetSearchText: (value: string) => void;
  onSetSortBy: (value: string) => void;
  onSetSortDirection: (value: string) => void;
  onSetTagFilter: (value: string) => void;
};

export const HomeListToolbar = ({
  actionLabel,
  archivedFilterValue,
  archivedOptions,
  hasActiveFilters,
  isLoading,
  metaLabel,
  searchAriaLabel,
  searchPlaceholder,
  searchText,
  sortByOptions,
  sortByValue,
  sortDirectionOptions,
  sortDirectionValue,
  tagFilter,
  toolbarClassName,
  onAction,
  onClearFilters,
  onSetArchivedFilter,
  onSetSearchText,
  onSetSortBy,
  onSetSortDirection,
  onSetTagFilter,
}: HomeListToolbarProps): JSX.Element => (
  <div className={`home-list-toolbar ${toolbarClassName}`}>
    <div aria-live="polite" className="home-list-toolbar-meta">
      {isLoading ? metaLabel : metaLabel}
    </div>
    <div className="home-list-toolbar-fields home-list-toolbar-fields-wide">
      <Input
        aria-label={searchAriaLabel}
        className="home-list-toolbar-search"
        onChange={(event) => onSetSearchText(event.target.value)}
        placeholder={searchPlaceholder}
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
      <Button disabled={!hasActiveFilters} onClick={onClearFilters} type="button" variant="outline">
        Clear filters
      </Button>
      <Select value={archivedFilterValue} onValueChange={onSetArchivedFilter}>
        <SelectTrigger className="home-list-toolbar-select">
          <SelectValue placeholder="Filter status" />
        </SelectTrigger>
        <SelectContent>
          {archivedOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sortByValue} onValueChange={onSetSortBy}>
        <SelectTrigger className="home-list-toolbar-select">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortByOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sortDirectionValue} onValueChange={onSetSortDirection}>
        <SelectTrigger className="home-list-toolbar-select home-list-toolbar-select-sm">
          <SelectValue placeholder="Order" />
        </SelectTrigger>
        <SelectContent>
          {sortDirectionOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <Button className="home-list-toolbar-action gap-2" onClick={onAction} type="button">
      <Plus className="h-4 w-4" />
      {actionLabel}
    </Button>
  </div>
);
