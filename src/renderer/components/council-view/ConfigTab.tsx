import { useEffect, useRef, useState } from "react";

import {
  COUNCIL_CONFIG_MAX_TAGS,
  appendCouncilConfigTag,
  councilModelLabel,
  isModelSelectionInCatalog,
  parseCouncilConfigTags,
  toModelSelectionValue,
} from "../../../shared/app-ui-helpers.js";
import { resolveInlineConfigEditKeyboardAction } from "../../../shared/council-view-accessibility.js";
import type { GetCouncilViewResponse } from "../../../shared/ipc/dto";
import { ConfirmDialog } from "../../ConfirmDialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";

export type CouncilConfigField = "topic" | "goal" | "tags" | "conductorModel";

export type CouncilConfigEditState = {
  field: CouncilConfigField;
  draftValue: string;
};

type ConfigTabProps = {
  archiveDisabled: boolean;
  archiveDisabledReason?: string;
  canRefreshModels: boolean;
  council: GetCouncilViewResponse["council"];
  globalDefaultModelRef: GetCouncilViewResponse["globalDefaultModelRef"];
  isExportingTranscript: boolean;
  modelCatalog: GetCouncilViewResponse["modelCatalog"];
  onDeleteCouncil: () => Promise<void>;
  onEditingChange: (isEditing: boolean) => void;
  onExportTranscript: () => Promise<void>;
  onRefreshModelCatalog: () => Promise<void>;
  onSaveField: (configEdit: CouncilConfigEditState) => Promise<boolean>;
  onToggleArchived: (archived: boolean) => Promise<void>;
};

const toCouncilConfigFieldDisplayValue = (params: {
  council: GetCouncilViewResponse["council"];
  field: CouncilConfigField;
}): string => {
  switch (params.field) {
    case "topic":
      return params.council.topic;
    case "goal":
      return params.council.goal ?? "";
    case "tags":
      return params.council.tags.join(", ");
    case "conductorModel":
      return toModelSelectionValue(params.council.conductorModelRefOrNull);
    default:
      return "";
  }
};

export const ConfigTab = ({
  archiveDisabled,
  archiveDisabledReason,
  canRefreshModels,
  council,
  globalDefaultModelRef,
  isExportingTranscript,
  modelCatalog,
  onDeleteCouncil,
  onEditingChange,
  onExportTranscript,
  onRefreshModelCatalog,
  onSaveField,
  onToggleArchived,
}: ConfigTabProps): JSX.Element => {
  const [configEdit, setConfigEdit] = useState<CouncilConfigEditState | null>(null);
  const [configTagInput, setConfigTagInput] = useState("");
  const [showConfigDiscardDialog, setShowConfigDiscardDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSavingConfigField, setIsSavingConfigField] = useState(false);
  const [isRefreshingConfigModels, setIsRefreshingConfigModels] = useState(false);
  const councilConfigEditContainerRef = useRef<HTMLDivElement | null>(null);
  const councilConfigEditInputRef = useRef<HTMLElement | null>(null);

  const configEditField = configEdit?.field ?? null;
  const configEditDraftValue = configEdit?.draftValue ?? "";
  const configEditTags =
    configEditField === "tags" ? parseCouncilConfigTags(configEditDraftValue) : [];
  const conductorSelectValue =
    configEditDraftValue.length > 0 ? configEditDraftValue : "__global_default__";
  const hasUnavailableConductorSelection = !isModelSelectionInCatalog({
    modelSelection:
      configEditField === "conductorModel"
        ? configEditDraftValue
        : toModelSelectionValue(council.conductorModelRefOrNull),
    modelCatalog,
  });

  useEffect(() => {
    if (configEdit === null) {
      return;
    }
    councilConfigEditInputRef.current?.focus();
  }, [configEdit]);

  useEffect(() => {
    if (configEdit === null || showConfigDiscardDialog) {
      return;
    }
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (councilConfigEditContainerRef.current?.contains(target) === true) {
        return;
      }
      closeCouncilConfigEdit(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [configEdit, showConfigDiscardDialog]);

  const hasConfigEditChanges = (current: CouncilConfigEditState): boolean =>
    current.draftValue !== toCouncilConfigFieldDisplayValue({ council, field: current.field });

  const openCouncilConfigEdit = (field: CouncilConfigField): void => {
    setConfigEdit({
      field,
      draftValue: toCouncilConfigFieldDisplayValue({ council, field }),
    });
    setConfigTagInput("");
    setShowConfigDiscardDialog(false);
    onEditingChange(true);
  };

  const closeCouncilConfigEdit = (forceDiscard: boolean): void => {
    if (configEdit === null) {
      return;
    }
    if (!forceDiscard && hasConfigEditChanges(configEdit)) {
      setShowConfigDiscardDialog(true);
      return;
    }
    setConfigEdit(null);
    setConfigTagInput("");
    setShowConfigDiscardDialog(false);
    onEditingChange(false);
  };

  const saveCouncilConfigEdit = async (): Promise<void> => {
    if (configEdit === null || isSavingConfigField) {
      return;
    }
    setIsSavingConfigField(true);
    const saved = await onSaveField(configEdit);
    setIsSavingConfigField(false);
    if (!saved) {
      return;
    }
    setConfigEdit(null);
    setConfigTagInput("");
    setShowConfigDiscardDialog(false);
    onEditingChange(false);
  };

  const addTagToCouncilConfigEdit = (): void => {
    if (configEdit?.field !== "tags") {
      return;
    }
    const currentTags = parseCouncilConfigTags(configEdit.draftValue);
    const result = appendCouncilConfigTag({
      currentTags,
      tagInput: configTagInput,
      maxTags: COUNCIL_CONFIG_MAX_TAGS,
    });
    if (!result.ok) {
      return;
    }
    setConfigEdit({ ...configEdit, draftValue: result.tags.join(", ") });
    setConfigTagInput("");
  };

  const removeTagFromCouncilConfigEdit = (tagToRemove: string): void => {
    if (configEdit?.field !== "tags") {
      return;
    }
    const nextTags = parseCouncilConfigTags(configEdit.draftValue).filter(
      (tag) => tag.toLowerCase() !== tagToRemove.toLowerCase(),
    );
    setConfigEdit({ ...configEdit, draftValue: nextTags.join(", ") });
  };

  const handleInlineConfigKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const action = resolveInlineConfigEditKeyboardAction({
      key: event.key,
      shiftKey: event.shiftKey,
    });
    if (action === "none") {
      return;
    }
    event.preventDefault();
    if (action === "save") {
      void saveCouncilConfigEdit();
      return;
    }
    closeCouncilConfigEdit(false);
  };

  const refreshCouncilConfigModels = async (): Promise<void> => {
    setIsRefreshingConfigModels(true);
    await onRefreshModelCatalog();
    setIsRefreshingConfigModels(false);
  };

  return (
    <section
      aria-labelledby="council-view-tab-config"
      className="space-y-6"
      id="council-view-panel-config"
      role="tabpanel"
    >
      <Card className="p-6">
        <div className="space-y-6" ref={councilConfigEditContainerRef}>
          <h2 className="mb-6 text-xl font-medium">Configuration</h2>
          <div className="space-y-3">
            <Label className="text-sm font-medium">Topic</Label>
            {configEditField === "topic" ? (
              <div className="space-y-3">
                <Textarea
                  onChange={(event) =>
                    setConfigEdit((current) =>
                      current === null ? current : { ...current, draftValue: event.target.value },
                    )
                  }
                  onKeyDown={handleInlineConfigKeyDown}
                  ref={(element) => {
                    councilConfigEditInputRef.current = element;
                  }}
                  rows={4}
                  value={configEditDraftValue}
                />
                <div className="flex justify-end">
                  <Button
                    disabled={isSavingConfigField}
                    onClick={() => void saveCouncilConfigEdit()}
                  >
                    {isSavingConfigField ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 p-3">
                <p className="flex-1 text-sm">{council.topic}</p>
                <Button
                  aria-label="Edit topic"
                  disabled={configEdit !== null || council.archived}
                  onClick={() => openCouncilConfigEdit("topic")}
                  size="sm"
                  variant="ghost"
                >
                  ✎
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-medium">Goal</Label>
            {configEditField === "goal" ? (
              <div className="space-y-3">
                <Textarea
                  onChange={(event) =>
                    setConfigEdit((current) =>
                      current === null ? current : { ...current, draftValue: event.target.value },
                    )
                  }
                  onKeyDown={handleInlineConfigKeyDown}
                  ref={(element) => {
                    councilConfigEditInputRef.current = element;
                  }}
                  rows={3}
                  value={configEditDraftValue}
                />
                <div className="flex justify-end">
                  <Button
                    disabled={isSavingConfigField}
                    onClick={() => void saveCouncilConfigEdit()}
                  >
                    {isSavingConfigField ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 p-3">
                <p className="flex-1 text-sm">{council.goal ?? "None set"}</p>
                <Button
                  aria-label="Edit goal"
                  disabled={configEdit !== null || council.archived}
                  onClick={() => openCouncilConfigEdit("goal")}
                  size="sm"
                  variant="ghost"
                >
                  ✎
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tags</Label>
            {configEditField === "tags" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {configEditTags.map((tag) => (
                    <Badge className="gap-1" key={tag} variant="secondary">
                      {tag}
                      <button
                        aria-label={`Remove tag ${tag}`}
                        className="ml-1 hover:text-destructive"
                        onClick={() => removeTagFromCouncilConfigEdit(tag)}
                        type="button"
                      >
                        x
                      </button>
                    </Badge>
                  ))}
                  {configEditTags.length === 0 ? (
                    <span className="text-sm italic text-muted-foreground">No tags yet</span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Input
                    onChange={(event) => setConfigTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTagToCouncilConfigEdit();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        closeCouncilConfigEdit(false);
                      }
                    }}
                    placeholder="Add tag"
                    value={configTagInput}
                  />
                  <Button
                    disabled={!configTagInput.trim()}
                    onClick={addTagToCouncilConfigEdit}
                    variant="outline"
                  >
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Press Enter to add. Max {COUNCIL_CONFIG_MAX_TAGS} tags.
                </p>
                <div className="flex justify-end">
                  <Button
                    disabled={isSavingConfigField}
                    onClick={() => void saveCouncilConfigEdit()}
                  >
                    {isSavingConfigField ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 p-3">
                <div className="flex flex-1 flex-wrap gap-2">
                  {council.tags.length > 0 ? (
                    council.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm italic text-muted-foreground">None</span>
                  )}
                </div>
                <Button
                  aria-label="Edit tags"
                  disabled={configEdit !== null || council.archived}
                  onClick={() => openCouncilConfigEdit("tags")}
                  size="sm"
                  variant="ghost"
                >
                  ✎
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-medium">Conductor Model</Label>
            {configEditField === "conductorModel" ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Select
                    onValueChange={(value) =>
                      setConfigEdit((current) =>
                        current === null
                          ? current
                          : {
                              ...current,
                              draftValue: value === "__global_default__" ? "" : value,
                            },
                      )
                    }
                    value={conductorSelectValue}
                  >
                    <SelectTrigger
                      className="flex-1"
                      ref={(element) => {
                        councilConfigEditInputRef.current = element;
                      }}
                    >
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {hasUnavailableConductorSelection ? (
                        <SelectItem value={configEditDraftValue}>
                          Unavailable ({configEditDraftValue})
                        </SelectItem>
                      ) : null}
                      <SelectItem value="__global_default__">Global default</SelectItem>
                      {Object.entries(modelCatalog.modelsByProvider).map(
                        ([providerId, modelIds]) => (
                          <SelectGroup key={providerId}>
                            <SelectLabel>{providerId}</SelectLabel>
                            {modelIds.map((modelId) => (
                              <SelectItem
                                key={`${providerId}:${modelId}`}
                                value={`${providerId}:${modelId}`}
                              >
                                {modelId}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    aria-label="Refresh council conductor model options"
                    className="shrink-0"
                    disabled={isRefreshingConfigModels || !canRefreshModels}
                    onClick={() => void refreshCouncilConfigModels()}
                    size="icon"
                    title="Refresh models"
                    type="button"
                    variant="ghost"
                  >
                    ⟳
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button
                    disabled={isSavingConfigField}
                    onClick={() => void saveCouncilConfigEdit()}
                  >
                    {isSavingConfigField ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-3">
                <div className="flex flex-1 items-center gap-2">
                  <p className="text-sm">{councilModelLabel(council, globalDefaultModelRef)}</p>
                  {council.invalidConfig ? (
                    <Badge variant="destructive">Invalid config</Badge>
                  ) : null}
                </div>
                <Button
                  aria-label="Edit conductor model"
                  disabled={configEdit !== null || council.archived}
                  onClick={() => openCouncilConfigEdit("conductorModel")}
                  size="sm"
                  variant="ghost"
                >
                  ✎
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="mb-4 font-medium">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={configEdit !== null || isExportingTranscript}
            onClick={() => void onExportTranscript()}
            variant="outline"
          >
            {isExportingTranscript ? "Exporting..." : "Export Transcript"}
          </Button>
          <Button
            disabled={configEdit !== null || archiveDisabled}
            onClick={() => void onToggleArchived(!council.archived)}
            title={archiveDisabledReason}
            variant="outline"
          >
            {council.archived ? "Restore Council" : "Archive Council"}
          </Button>
          <Button
            disabled={configEdit !== null}
            onClick={() => setShowDeleteDialog(true)}
            variant="destructive"
          >
            Delete Council
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        confirmTone="danger"
        message="Your changes will be lost."
        onCancel={() => {
          setShowConfigDiscardDialog(false);
          window.setTimeout(() => {
            councilConfigEditInputRef.current?.focus();
          }, 0);
        }}
        onConfirm={() => {
          closeCouncilConfigEdit(true);
        }}
        open={showConfigDiscardDialog}
        title="Discard changes?"
      />
      <ConfirmDialog
        confirmLabel="Delete"
        confirmTone="danger"
        message={`Delete council "${council.title}" permanently?`}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={() => {
          setShowDeleteDialog(false);
          void onDeleteCouncil();
        }}
        open={showDeleteDialog}
        title="Delete council?"
      />
    </section>
  );
};
