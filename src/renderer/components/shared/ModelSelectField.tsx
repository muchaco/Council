import { RefreshCw } from "lucide-react";

import {
  buildInvalidConfigBadgeAriaLabel,
  isModelSelectionInCatalog,
} from "../../../shared/app-ui-helpers.js";
import type { ModelCatalogSnapshotDto } from "../../../shared/ipc/dto";
import { Button } from "../ui/button";

type ModelSelectFieldProps = {
  id: string;
  label: string;
  refreshAriaLabel: string;
  disabled?: boolean;
  invalidConfig?: boolean;
  invalidConfigLabel: string;
  modelCatalog: ModelCatalogSnapshotDto;
  value: string;
  emptyLabel: string;
  canRefresh: boolean;
  isRefreshing: boolean;
  onChange: (value: string) => void;
  onRefresh: () => void;
};

export const ModelSelectField = ({
  id,
  label,
  refreshAriaLabel,
  disabled = false,
  invalidConfig = false,
  invalidConfigLabel,
  modelCatalog,
  value,
  emptyLabel,
  canRefresh,
  isRefreshing,
  onChange,
  onRefresh,
}: ModelSelectFieldProps): JSX.Element => {
  const hasUnavailableSelection = !isModelSelectionInCatalog({
    modelSelection: value,
    modelCatalog,
  });

  return (
    <>
      <div className="field-with-action">
        <label className="field" htmlFor={id}>
          {label}
        </label>
        <Button
          aria-label={refreshAriaLabel}
          className="field-action-button"
          disabled={disabled || !canRefresh || isRefreshing}
          onClick={onRefresh}
          size="icon"
          title="Refresh models"
          type="button"
          variant="ghost"
        >
          <RefreshCw className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </div>
      <div className="button-row">
        <select
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          {hasUnavailableSelection ? <option value={value}>Unavailable ({value})</option> : null}
          <option value="">{emptyLabel}</option>
          {Object.entries(modelCatalog.modelsByProvider).map(([providerId, modelIds]) => (
            <optgroup key={providerId} label={providerId}>
              {modelIds.map((modelId) => (
                <option key={`${providerId}:${modelId}`} value={`${providerId}:${modelId}`}>
                  {modelId}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {invalidConfig ? (
          <span
            aria-label={buildInvalidConfigBadgeAriaLabel(invalidConfigLabel)}
            className="warning-badge"
            title="Invalid config"
          >
            Invalid config
          </span>
        ) : null}
      </div>
    </>
  );
};
