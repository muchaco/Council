import { type Result, err, ok } from "neverthrow";

export type ModelRef = {
  providerId: string;
  modelId: string;
};

export type ModelCatalogByProvider = Record<string, ReadonlyArray<string>>;

export type ModelResolutionInput = {
  modelRefOrNull: ModelRef | null;
  globalDefaultModelRef: ModelRef | null;
  availableModelKeys: ReadonlySet<string>;
};

export type ResolvedModelRef = ModelRef;

export const modelKey = (ref: ModelRef): string => `${ref.providerId}:${ref.modelId}`;

export const buildAvailableModelKeys = (
  modelsByProvider: ModelCatalogByProvider,
): ReadonlySet<string> => {
  const keys = new Set<string>();
  for (const [providerId, modelIds] of Object.entries(modelsByProvider)) {
    for (const modelId of modelIds) {
      keys.add(`${providerId}:${modelId}`);
    }
  }
  return keys;
};

export const isModelConfigInvalid = (input: ModelResolutionInput): boolean =>
  resolveModelRef(input).isErr();

export const groupModelsByProvider = (
  modelsByProvider: ModelCatalogByProvider,
): ReadonlyArray<{
  providerId: string;
  modelIds: ReadonlyArray<string>;
}> =>
  Object.entries(modelsByProvider)
    .filter(([, modelIds]) => modelIds.length > 0)
    .map(([providerId, modelIds]) => ({
      providerId,
      modelIds: [...modelIds],
    }));

export const resolveModelRef = (
  input: ModelResolutionInput,
): Result<ResolvedModelRef, "InvalidConfigError"> => {
  const resolved = input.modelRefOrNull ?? input.globalDefaultModelRef;
  if (resolved === null) {
    return err("InvalidConfigError");
  }

  if (!input.availableModelKeys.has(modelKey(resolved))) {
    return err("InvalidConfigError");
  }

  return ok(resolved);
};
