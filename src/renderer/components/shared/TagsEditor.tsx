import {
  buildTagEditorHelperText,
  resolveTagEditorInputKeyAction,
} from "../../../shared/app-ui-helpers.js";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { TagList } from "./TagList";

type TagsEditorProps = {
  addLabel?: string;
  emptyLabel?: string;
  disabled?: boolean;
  errorText?: string;
  inputId?: string;
  inputPlaceholder?: string;
  inputValue: string;
  maxTags?: number;
  onAdd: () => void;
  onInputChange: (value: string) => void;
  onInputEscape: () => void;
  onRemoveLastTag?: () => void;
  onRemoveTag: (tag: string) => void;
  readOnly?: boolean;
  tags: ReadonlyArray<string>;
};

export const TagsEditor = ({
  addLabel = "Add",
  emptyLabel = "No tags yet",
  disabled = false,
  errorText,
  inputId,
  inputPlaceholder = "Add tag",
  inputValue,
  maxTags,
  onAdd,
  onInputChange,
  onInputEscape,
  onRemoveLastTag,
  onRemoveTag,
  readOnly = false,
  tags,
}: TagsEditorProps): JSX.Element => {
  const isInteractive = !disabled && !readOnly;
  const helperText = buildTagEditorHelperText({
    maxTags,
    slotsRemaining: Math.max((maxTags ?? Number.POSITIVE_INFINITY) - tags.length, 0),
  });

  return (
    <div className="space-y-3">
      <TagList
        emptyLabel={emptyLabel}
        onTagRemove={isInteractive ? onRemoveTag : undefined}
        tags={tags}
      />
      <div className="flex gap-2">
        <Input
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
          placeholder={inputPlaceholder}
          value={inputValue}
        />
        <Button disabled={!isInteractive || !inputValue.trim()} onClick={onAdd} variant="outline">
          {addLabel}
        </Button>
      </div>
      <p className={`text-xs ${errorText ? "text-destructive" : "text-muted-foreground"}`}>
        {errorText ?? helperText}
      </p>
    </div>
  );
};
