'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Badge } from './badge';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Plus, X } from 'lucide-react';
import { validateTagInput, canAddTag, ValidationResult } from '@/lib/validation';

export interface Tag {
  id: number;
  name: string;
  createdAt: string;
}

export interface TagInputProps {
  /** Current tags assigned to the session */
  tags: string[];
  /** All available tags for autocomplete suggestions */
  allTags: Tag[];
  /** Callback when a new tag is added */
  onAddTag: (tag: string) => void;
  /** Callback when a tag is removed */
  onRemoveTag: (tag: string) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * TagInput - A component for adding and removing tags with autocomplete
 * 
 * Features:
 * - Displays existing tags as removable pills
 * - Plus button opens a popover for adding new tags
 * - Input validation (max 20 chars, no duplicates, no empty)
 * - Autocomplete dropdown with existing tags
 * - Max 3 tags limit enforcement
 * 
 * FR-1.5: Disabled add button at 3 tags
 * FR-1.6: Popover interface for input
 * FR-1.7: Single text input in popover
 * FR-1.8: Enter key submission
 * FR-1.9: Validation on Enter with error display
 * FR-1.10: Appends without reordering
 * FR-1.11: Popover closes on success
 * FR-1.12: Remove via X icon on each pill
 */
export function TagInput({
  tags,
  allTags,
  onAddTag,
  onRemoveTag,
  disabled = false,
}: TagInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check if we can add more tags (max 3)
  const canAddMore = useMemo(() => canAddTag(tags), [tags]);

  // Filter autocomplete suggestions based on input
  const autocompleteSuggestions = useMemo(() => {
    if (!inputValue.trim()) return [];
    
    const normalizedInput = inputValue.toLowerCase();
    return allTags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(normalizedInput) &&
        !tags.some((t) => t.toLowerCase() === tag.name.toLowerCase())
    );
  }, [inputValue, allTags, tags]);

  // Validate and submit a new tag
  const handleSubmit = useCallback(() => {
    const result: ValidationResult = validateTagInput(inputValue, tags);

    if (!result.valid) {
      setValidationError(result.error || 'Invalid tag');
      return;
    }

    // Success - add the tag
    if (result.normalizedTag) {
      onAddTag(result.normalizedTag);
      setInputValue('');
      setValidationError(null);
      setIsOpen(false);
    }
  }, [inputValue, tags, onAddTag]);

  // Handle Enter key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Handle input change - clear error when user types
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (validationError) {
      setValidationError(null);
    }
  }, [validationError]);

  // Handle selecting a suggestion from autocomplete
  const handleSelectSuggestion = useCallback(
    (tagName: string) => {
      onAddTag(tagName.toLowerCase());
      setInputValue('');
      setValidationError(null);
      setIsOpen(false);
    },
    [onAddTag]
  );

  // Handle opening the popover - reset state
  const handleOpenChange = useCallback((open: boolean) => {
    if (!disabled && (open ? canAddMore : true)) {
      setIsOpen(open);
      if (!open) {
        setInputValue('');
        setValidationError(null);
      }
    }
  }, [disabled, canAddMore]);

  return (
    <div
      data-testid="tag-input-container"
      className="flex flex-row items-center gap-2"
    >
      {/* Existing tags */}
      {tags.map((tag) => (
        <Badge
          key={tag}
          data-testid={`tag-pill-${tag}`}
          data-slot="badge"
          variant="secondary"
          className="inline-flex items-center gap-1 px-2 py-0.5"
        >
          <span className="truncate max-w-[150px]">{tag}</span>
          <button
            data-testid={`remove-tag-${tag}`}
            type="button"
            onClick={() => onRemoveTag(tag)}
            className="ml-1 inline-flex items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label={`Remove ${tag} tag`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {/* Add tag button */}
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            data-testid="add-tag-button"
            type="button"
            disabled={disabled || !canAddMore}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Add tag"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          data-testid="tag-popover-content"
          className="w-64 p-3"
          align="start"
        >
          <div className="space-y-2">
            <Input
              data-testid="tag-input-field"
              type="text"
              placeholder="Enter tag..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="h-8"
              autoFocus
            />

            {/* Validation error */}
            {validationError && (
              <p
                data-testid="tag-error-message"
                className="text-xs text-destructive"
              >
                {validationError}
              </p>
            )}

            {/* Autocomplete suggestions */}
            {autocompleteSuggestions.length > 0 && (
              <div
                data-testid="autocomplete-dropdown"
                className="max-h-32 overflow-auto rounded-md border border-border bg-popover"
              >
                {autocompleteSuggestions.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(tag.name)}
                    className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Press Enter to add
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
