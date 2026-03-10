import { useEffect, useRef, useState } from "react";

import {
  COUNCIL_CONFIG_MAX_TAGS,
  appendTagToDraft,
  councilModelLabel,
  isModelSelectionInCatalog,
  parseTagDraft,
  removeTagFromDraft,
  toModelSelectionValue,
} from "../../../shared/app-ui-helpers.js";
import { resolveInlineConfigEditKeyboardAction } from "../../../shared/council-view-accessibility.js";
import type { GetCouncilViewResponse } from "../../../shared/ipc/dto";
import { ConfirmDialog } from "../../ConfirmDialog";
import { EditableConfigFieldRow } from "../shared/EditableConfigFieldRow";
import { TagList } from "../shared/TagList";
import { TagsEditor } from "../shared/TagsEditor";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
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
  const [configTagMessage, setConfigTagMessage] = useState("");
  const [showConfigDiscardDialog, setShowConfigDiscardDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSavingConfigField, setIsSavingConfigField] = useState(false);
  const [isRefreshingConfigModels, setIsRefreshingConfigModels] = useState(false);
  const councilConfigEditContainerRef = useRef<HTMLDivElement | null>(null);
  const councilConfigEditInputRef = useRef<HTMLElement | null>(null);

  const configEditField = configEdit?.field ?? null;
  const configEditDraftValue = configEdit?.draftValue ?? "";
  const configEditTags = configEditField === "tags" ? parseTagDraft(configEditDraftValue) : [];
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
    setConfigTagMessage("");
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
    setConfigTagMessage("");
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
    setConfigTagMessage("");
    setShowConfigDiscardDialog(false);
    onEditingChange(false);
  };

  const addTagToCouncilConfigEdit = (): void => {
    if (configEdit?.field !== "tags") {
      return;
    }
    const result = appendTagToDraft({
      currentDraftValue: configEdit.draftValue,
      tagInput: configTagInput,
      maxTags: COUNCIL_CONFIG_MAX_TAGS,
    });
    if (!result.ok) {
      setConfigTagMessage(result.message);
      return;
    }
    setConfigEdit({ ...configEdit, draftValue: result.draftValue });
    setConfigTagInput("");
    setConfigTagMessage("");
  };

  const removeTagFromCouncilConfigEdit = (tagToRemove: string): void => {
    if (configEdit?.field !== "tags") {
      return;
    }
    const result = removeTagFromDraft({
      currentDraftValue: configEdit.draftValue,
      tagToRemove,
    });
    setConfigEdit({ ...configEdit, draftValue: result.draftValue });
    setConfigTagMessage("");
  };

  const removeLastConfigTag = (): void => {
    if (configEdit?.field !== "tags") {
      return;
    }
    const lastTag = configEditTags.at(-1);
    if (lastTag === undefined) {
      return;
    }
    removeTagFromCouncilConfigEdit(lastTag);
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
      className="space-y-4"
      id="council-view-panel-config"
      role="tabpanel"
    >
      <Card className="p-4 sm:p-5">
        <div className="space-y-5" ref={councilConfigEditContainerRef}>
          <h2 className="mb-4 text-lg font-medium">Configuration</h2>

          <EditableConfigFieldRow
            disabled={configEdit !== null || council.archived}
            editAriaLabel="Edit topic"
            isEditing={configEditField === "topic"}
            label="Topic"
            onEdit={() => openCouncilConfigEdit("topic")}
            viewContent={<p className="text-sm">{council.topic}</p>}
          >
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
                <Button disabled={isSavingConfigField} onClick={() => void saveCouncilConfigEdit()}>
                  {isSavingConfigField ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </EditableConfigFieldRow>

          <EditableConfigFieldRow
            disabled={configEdit !== null || council.archived}
            editAriaLabel="Edit goal"
            isEditing={configEditField === "goal"}
            label="Goal"
            onEdit={() => openCouncilConfigEdit("goal")}
            viewContent={<p className="text-sm">{council.goal ?? "None set"}</p>}
          >
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
                <Button disabled={isSavingConfigField} onClick={() => void saveCouncilConfigEdit()}>
                  {isSavingConfigField ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </EditableConfigFieldRow>

          <EditableConfigFieldRow
            disabled={configEdit !== null || council.archived}
            editAriaLabel="Edit tags"
            isEditing={configEditField === "tags"}
            label="Tags"
            onEdit={() => openCouncilConfigEdit("tags")}
            viewContent={<TagList emptyLabel="None" tags={council.tags} />}
          >
            <div className="space-y-3">
              <TagsEditor
                errorText={configTagMessage || undefined}
                inputId="council-config-tags-input"
                inputValue={configTagInput}
                maxTags={COUNCIL_CONFIG_MAX_TAGS}
                onAdd={addTagToCouncilConfigEdit}
                onInputChange={setConfigTagInput}
                onInputEscape={() => {
                  if (configTagInput.trim().length > 0) {
                    setConfigTagInput("");
                    setConfigTagMessage("");
                    return;
                  }
                  closeCouncilConfigEdit(false);
                }}
                onRemoveLastTag={removeLastConfigTag}
                onRemoveTag={removeTagFromCouncilConfigEdit}
                tags={configEditTags}
              />
              <div className="flex justify-end">
                <Button disabled={isSavingConfigField} onClick={() => void saveCouncilConfigEdit()}>
                  {isSavingConfigField ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </EditableConfigFieldRow>

          <EditableConfigFieldRow
            disabled={configEdit !== null || council.archived}
            editAriaLabel="Edit conductor model"
            isEditing={configEditField === "conductorModel"}
            label="Conductor Model"
            onEdit={() => openCouncilConfigEdit("conductorModel")}
            viewContent={
              <div className="flex items-center gap-2">
                <p className="text-sm">{councilModelLabel(council, globalDefaultModelRef)}</p>
                {council.invalidConfig ? <Badge variant="destructive">Invalid config</Badge> : null}
              </div>
            }
          >
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
                    {Object.entries(modelCatalog.modelsByProvider).map(([providerId, modelIds]) => (
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
                    ))}
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
                <Button disabled={isSavingConfigField} onClick={() => void saveCouncilConfigEdit()}>
                  {isSavingConfigField ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </EditableConfigFieldRow>
        </div>
      </Card>
      <Card className="p-4 sm:p-5">
        <h3 className="mb-3 font-medium">Actions</h3>
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
