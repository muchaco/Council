import type { ReactNode } from "react";

import { Button } from "../ui/button";
import { Label } from "../ui/label";

type EditableConfigFieldRowProps = {
  children: ReactNode;
  disabled: boolean;
  editAriaLabel: string;
  isEditing: boolean;
  label: string;
  onEdit: () => void;
  viewContent: ReactNode;
};

export const EditableConfigFieldRow = ({
  children,
  disabled,
  editAriaLabel,
  isEditing,
  label,
  onEdit,
  viewContent,
}: EditableConfigFieldRowProps): JSX.Element => (
  <div className="space-y-3">
    <Label className="text-sm font-medium">{label}</Label>
    {isEditing ? (
      children
    ) : (
      <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 p-3">
        <div className="flex-1">{viewContent}</div>
        <Button
          aria-label={editAriaLabel}
          disabled={disabled}
          onClick={onEdit}
          size="sm"
          variant="ghost"
        >
          ✎
        </Button>
      </div>
    )}
  </div>
);
