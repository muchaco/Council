'use client';

import React from 'react';
import { Badge } from './badge';
import { X } from 'lucide-react';

export interface TagDisplayProps {
  /** Array of tag strings to display */
  tags: string[];
  /** Visual variant - editable shows remove buttons, readonly does not */
  variant?: 'editable' | 'readonly';
  /** Callback when a tag is removed (only called in editable mode) */
  onRemoveTag?: (tag: string) => void;
}

/**
 * TagDisplay - A read-only or editable tag display component
 * 
 * Displays tags as badges in a single horizontal row.
 * In editable mode, shows X icons for removal.
 * In readonly mode, displays plain badges without interaction.
 * 
 * FR-1.13: Pills with X in editable contexts
 * FR-1.14: Badges without X in read-only contexts  
 * FR-1.15: Uses shadcn Badge component
 * FR-1.16: Single horizontal row layout
 */
export function TagDisplay({
  tags,
  variant = 'editable',
  onRemoveTag,
}: TagDisplayProps) {
  // Return null if no tags to display
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="tag-display-container"
      className="flex flex-row flex-nowrap items-center gap-2"
    >
      {tags.map((tag) => (
        <Badge
          key={tag}
          data-testid={`tag-badge-${tag}`}
          data-slot="badge"
          variant="secondary"
          className="inline-flex items-center gap-1 px-2 py-0.5"
        >
          <span className="truncate max-w-[150px]">{tag}</span>
          {variant === 'editable' && (
            <button
              data-testid={`remove-tag-${tag}`}
              type="button"
              onClick={() => onRemoveTag?.(tag)}
              className="ml-1 inline-flex items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label={`Remove ${tag} tag`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
    </div>
  );
}
