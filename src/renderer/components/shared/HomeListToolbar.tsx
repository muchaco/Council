import { Filter, RefreshCw, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { TagsEditor } from "./TagsEditor";

type FilterOption = {
  value: string;
  label: string;
};

type HomeListToolbarProps = {
  actionAriaLabel: string;
  actionLabel: string;
  archivedFilterValue: string;
  archivedOptions: ReadonlyArray<FilterOption>;
  hasAppliedPopoverFilters: boolean;
  hasPendingChanges: boolean;
  isLoading: boolean;
  metaLabel: string;
  popoverTitle: string;
  searchAriaLabel: string;
  searchPlaceholder: string;
  searchText: string;
  sortByOptions: ReadonlyArray<FilterOption>;
  sortByValue: string;
  sortDirectionOptions: ReadonlyArray<FilterOption>;
  sortDirectionValue: string;
  tagFilter: ReadonlyArray<string>;
  tagFilterDraft: string;
  onAction: () => void;
  onApplyFilters: () => void;
  onCommitTagFilter: () => void;
  onRefresh: () => void;
  onResetFilters: () => void;
  onSetArchivedFilter: (value: string) => void;
  onSetSearchText: (value: string) => void;
  onSetSortBy: (value: string) => void;
  onSetSortDirection: (value: string) => void;
  onSetTagFilterDraft: (value: string) => void;
  onTagFilterRemove: (tag: string) => void;
};

export const HomeListToolbar = ({
  actionAriaLabel,
  actionLabel,
  archivedFilterValue,
  archivedOptions,
  hasAppliedPopoverFilters,
  hasPendingChanges,
  isLoading,
  metaLabel,
  popoverTitle,
  searchAriaLabel,
  searchPlaceholder,
  searchText,
  sortByOptions,
  sortByValue,
  sortDirectionOptions,
  sortDirectionValue,
  tagFilter,
  tagFilterDraft,
  onAction,
  onApplyFilters,
  onCommitTagFilter,
  onRefresh,
  onResetFilters,
  onSetArchivedFilter,
  onSetSearchText,
  onSetSortBy,
  onSetSortDirection,
  onSetTagFilterDraft,
  onTagFilterRemove,
}: HomeListToolbarProps): JSX.Element => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverId = useId();
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isPopoverOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node) || popoverRef.current?.contains(target)) {
        return;
      }

      setIsPopoverOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setIsPopoverOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPopoverOpen]);

  return (
    <div className="home-list-toolbar" data-home-list-toolbar="true">
      <div aria-live="polite" className="home-list-toolbar-meta">
        {metaLabel}
      </div>
      <div className="home-list-toolbar-row">
        <div className="home-list-toolbar-search-form">
          <div className="home-list-toolbar-search-shell">
            <Search aria-hidden="true" className="home-list-toolbar-search-icon" />
            <Input
              aria-label={searchAriaLabel}
              className="home-list-toolbar-search-input"
              onChange={(event) => onSetSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }

                event.preventDefault();
                onRefresh();
              }}
              placeholder={searchPlaceholder}
              value={searchText}
            />
          </div>
        </div>

        <div className="home-list-toolbar-actions">
          <div className="home-list-toolbar-popover-anchor" ref={popoverRef}>
            <Button
              aria-controls={popoverId}
              aria-expanded={isPopoverOpen}
              aria-haspopup="dialog"
              aria-label={`${popoverTitle} filter and sort options`}
              className="home-list-toolbar-icon-button"
              data-home-list-filter-button="true"
              onClick={() => setIsPopoverOpen((current) => !current)}
              size="icon"
              title={`${popoverTitle} filter and sort options`}
              type="button"
              variant="outline"
            >
              <Filter className="h-4 w-4" />
              {hasAppliedPopoverFilters ? (
                <span aria-hidden="true" className="home-list-toolbar-filter-dot" />
              ) : null}
            </Button>

            {isPopoverOpen ? (
              <div
                aria-label={`${popoverTitle} filter and sort options`}
                className="home-list-toolbar-popover"
                data-home-list-filter-popover="true"
                id={popoverId}
              >
                <div className="home-list-toolbar-popover-header">
                  <h3>{popoverTitle}</h3>
                </div>

                <div className="home-list-toolbar-popover-section">
                  <label className="home-list-toolbar-popover-label" htmlFor={`${popoverId}-tags`}>
                    Tags
                  </label>
                  <TagsEditor
                    className="space-y-0"
                    fieldClassName="home-list-toolbar-tags-field"
                    helperTextHidden
                    inputAriaLabel={`${popoverTitle} tag filter`}
                    inputClassName="min-w-[6ch]"
                    inputId={`${popoverId}-tags`}
                    inputPlaceholder="Add tag"
                    inputValue={tagFilterDraft}
                    maxTags={3}
                    mode="filter"
                    onAdd={onCommitTagFilter}
                    onInputChange={onSetTagFilterDraft}
                    onInputEscape={() => onSetTagFilterDraft("")}
                    onRemoveLastTag={() => {
                      const lastTag = tagFilter.at(-1);
                      if (lastTag !== undefined) {
                        onTagFilterRemove(lastTag);
                      }
                    }}
                    onRemoveTag={onTagFilterRemove}
                    tags={tagFilter}
                  />
                </div>

                <div className="home-list-toolbar-popover-grid">
                  <label className="home-list-toolbar-popover-field">
                    <span className="home-list-toolbar-popover-label">Status</span>
                    <select
                      data-home-list-status-filter="true"
                      value={archivedFilterValue}
                      onChange={(event) => onSetArchivedFilter(event.target.value)}
                    >
                      {archivedOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="home-list-toolbar-popover-field">
                    <span className="home-list-toolbar-popover-label">Sort by</span>
                    <select
                      data-home-list-sort-by="true"
                      value={sortByValue}
                      onChange={(event) => onSetSortBy(event.target.value)}
                    >
                      {sortByOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="home-list-toolbar-popover-field home-list-toolbar-popover-field-full">
                    <span className="home-list-toolbar-popover-label">Order</span>
                    <select
                      data-home-list-sort-direction="true"
                      value={sortDirectionValue}
                      onChange={(event) => onSetSortDirection(event.target.value)}
                    >
                      {sortDirectionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="home-list-toolbar-popover-footer">
                  <Button onClick={onResetFilters} type="button" variant="outline">
                    Reset
                  </Button>
                  <Button
                    className="home-list-toolbar-popover-apply"
                    disabled={isLoading}
                    onClick={() => {
                      onApplyFilters();
                      setIsPopoverOpen(false);
                    }}
                    type="button"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <Button
            aria-label={`Refresh ${popoverTitle.toLowerCase()} list`}
            className={cn(
              "home-list-toolbar-icon-button",
              hasPendingChanges && "home-list-toolbar-refresh-dirty",
            )}
            data-home-list-refresh-button="true"
            disabled={isLoading}
            onClick={onRefresh}
            size="icon"
            title={`Refresh ${popoverTitle.toLowerCase()} list`}
            type="button"
            variant={hasPendingChanges ? "default" : "outline"}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>

          <Button
            aria-label={actionAriaLabel}
            className="home-list-toolbar-new-button"
            data-home-list-new-button="true"
            onClick={onAction}
            type="button"
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
