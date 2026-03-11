import { X } from "lucide-react";
import { useRef } from "react";

import {
  buildTagEditorHelperText,
  resolveTagEditorInputKeyAction,
} from "../../../shared/app-ui-helpers.js";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";

type TagsEditorProps = {
  className?: string;
  disabled?: boolean;
  errorText?: string;
  fieldClassName?: string;
  helperText?: string;
  helperTextClassName?: string;
  helperTextHidden?: boolean;
  inputAriaLabel?: string;
  inputClassName?: string;
  inputId?: string;
  inputPlaceholder?: string;
  inputValue: string;
  maxTags?: number;
  mode?: "edit" | "filter";
  onAdd: () => void;
  onInputChange: (value: string) => void;
  onInputEscape: () => void;
  onRemoveLastTag?: () => void;
  onRemoveTag: (tag: string) => void;
  readOnly?: boolean;
  tags: ReadonlyArray<string>;
};

export const TagsEditor = ({
  className,
  disabled = false,
  errorText,
  fieldClassName,
  helperText,
  helperTextClassName,
  helperTextHidden = false,
  inputAriaLabel,
  inputClassName,
  inputId,
  inputPlaceholder = "Add tag",
  inputValue,
  maxTags,
  mode = "edit",
  onAdd,
  onInputChange,
  onInputEscape,
  onRemoveLastTag,
  onRemoveTag,
  readOnly = false,
  tags,
}: TagsEditorProps): JSX.Element => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isInteractive = !disabled && !readOnly;
  const resolvedHelperText =
    helperText ??
    buildTagEditorHelperText({
      maxTags,
      mode,
      slotsRemaining: Math.max((maxTags ?? Number.POSITIVE_INFINITY) - tags.length, 0),
    });

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 ring-offset-background",
          isInteractive && "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          !isInteractive && "cursor-not-allowed opacity-50",
          fieldClassName,
        )}
        role="presentation"
        onMouseDown={(event) => {
          if (!isInteractive) {
            return;
          }
          const target = event.target;
          if (
            target instanceof HTMLElement &&
            (target.tagName === "INPUT" ||
              target.tagName === "BUTTON" ||
              target.closest("button") !== null)
          ) {
            return;
          }
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        {tags.map((tag) => (
          <Badge className="gap-1.5" key={tag} variant="secondary">
            <span>{tag}</span>
            {!readOnly ? (
              <button
                aria-label={`Remove tag ${tag}`}
                className="rounded-sm text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={!isInteractive}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveTag(tag);
                  inputRef.current?.focus();
                }}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </Badge>
        ))}
        <Input
          aria-label={inputAriaLabel}
          className={cn(
            "h-auto min-w-[8ch] flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
            inputClassName,
          )}
          disabled={!isInteractive}
          id={inputId}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            const action = resolveTagEditorInputKeyAction({
              key: event.key,
              draftValue: inputValue,
              committedTags: tags,
            });
            if (action === "none") {
              return;
            }
            event.preventDefault();
            if (action === "submit") {
              onAdd();
              return;
            }
            if (action === "clearDraft") {
              onInputEscape();
              return;
            }
            onRemoveLastTag?.();
          }}
          placeholder={tags.length === 0 ? inputPlaceholder : undefined}
          ref={inputRef}
          value={inputValue}
        />
      </div>
      {helperTextHidden ? null : (
        <p
          className={cn(
            "text-xs",
            errorText ? "text-destructive" : "text-muted-foreground",
            helperTextClassName,
          )}
        >
          {errorText ?? resolvedHelperText}
        </p>
      )}
    </div>
  );
};
