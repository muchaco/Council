import { X } from "lucide-react";

import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";

type TagListProps = {
  emptyLabel?: string;
  limit?: number;
  onTagClick?: (tag: string) => void;
  onTagRemove?: (tag: string) => void;
  tags: ReadonlyArray<string>;
};

export const TagList = ({
  emptyLabel = "No tags yet",
  limit,
  onTagClick,
  onTagRemove,
  tags,
}: TagListProps): JSX.Element => {
  const visibleTags = limit === undefined ? tags : tags.slice(0, limit);
  const hiddenCount = limit === undefined ? 0 : Math.max(tags.length - limit, 0);
  const interactive = onTagClick !== undefined || onTagRemove !== undefined;

  if (tags.length === 0) {
    return <span className="text-sm italic text-muted-foreground">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visibleTags.map((tag) => {
        const clickable = onTagClick !== undefined;
        const removable = onTagRemove !== undefined;

        return (
          <Badge className="gap-1.5" key={tag} variant="secondary">
            {clickable ? (
              <button
                className="rounded-sm px-0.5 text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(event) => {
                  event.stopPropagation();
                  onTagClick(tag);
                }}
                type="button"
              >
                {tag}
              </button>
            ) : (
              <span>{tag}</span>
            )}
            {removable ? (
              <button
                aria-label={`Remove tag ${tag}`}
                className="rounded-sm text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(event) => {
                  event.stopPropagation();
                  onTagRemove(tag);
                }}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </Badge>
        );
      })}
      {hiddenCount > 0 ? (
        <Badge className={cn(interactive ? "cursor-default" : undefined)} variant="secondary">
          +{hiddenCount}
        </Badge>
      ) : null}
    </div>
  );
};
