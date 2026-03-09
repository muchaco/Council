import type { Result } from "neverthrow";
import { type ModelRef, resolveModelRef } from "./domain/model-ref.js";

type RuntimeGenerationModelResolutionInput = {
  globalDefaultModelRef: ModelRef | null;
  availableModelKeys: ReadonlySet<string>;
};

export const resolveMemberGenerationModel = (
  input: RuntimeGenerationModelResolutionInput & {
    memberModelRefOrNull: ModelRef | null;
  },
): Result<ModelRef, "InvalidConfigError"> =>
  resolveModelRef({
    modelRefOrNull: input.memberModelRefOrNull,
    globalDefaultModelRef: input.globalDefaultModelRef,
    availableModelKeys: input.availableModelKeys,
  });

export const resolveConductorGenerationModel = (
  input: RuntimeGenerationModelResolutionInput & {
    conductorModelRefOrNull: ModelRef | null;
  },
): Result<ModelRef, "InvalidConfigError"> =>
  resolveModelRef({
    modelRefOrNull: input.conductorModelRefOrNull,
    globalDefaultModelRef: input.globalDefaultModelRef,
    availableModelKeys: input.availableModelKeys,
  });
