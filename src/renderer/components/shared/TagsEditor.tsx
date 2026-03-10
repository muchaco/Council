import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type TagsEditorProps = {
  addLabel?: string;
  emptyLabel?: string;
  helperText?: string;
  inputPlaceholder?: string;
  inputValue: string;
  onAdd: () => void;
  onInputChange: (value: string) => void;
  onInputEscape: () => void;
  onRemoveTag: (tag: string) => void;
  tags: ReadonlyArray<string>;
};

export const TagsEditor = ({
  addLabel = "Add",
  emptyLabel = "No tags yet",
  helperText,
  inputPlaceholder = "Add tag",
  inputValue,
  onAdd,
  onInputChange,
  onInputEscape,
  onRemoveTag,
  tags,
}: TagsEditorProps): JSX.Element => (
  <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <Badge className="gap-1" key={tag} variant="secondary">
          {tag}
          <button
            aria-label={`Remove tag ${tag}`}
            className="ml-1 hover:text-destructive"
            onClick={() => onRemoveTag(tag)}
            type="button"
          >
            x
          </button>
        </Badge>
      ))}
      {tags.length === 0 ? (
        <span className="text-sm italic text-muted-foreground">{emptyLabel}</span>
      ) : null}
    </div>
    <div className="flex gap-2">
      <Input
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onAdd();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onInputEscape();
          }
        }}
        placeholder={inputPlaceholder}
        value={inputValue}
      />
      <Button disabled={!inputValue.trim()} onClick={onAdd} variant="outline">
        {addLabel}
      </Button>
    </div>
    {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
  </div>
);
