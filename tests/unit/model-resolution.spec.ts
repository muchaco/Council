import { describe, expect } from "vitest";
import {
  resolveConductorGenerationModel,
  resolveMemberGenerationModel,
} from "../../src/shared/council-runtime-model-resolution";
import {
  buildAvailableModelKeys,
  groupModelsByProvider,
  isModelConfigInvalid,
  resolveModelRef,
} from "../../src/shared/domain/model-ref";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = ["E2", "R1.8", "R4.12", "R4.15", "R4.18", "R4.19"] as const;

describe("model resolution", () => {
  itReq(FILE_REQUIREMENT_IDS, "resolves explicit model when available", () => {
    const result = resolveModelRef({
      modelRefOrNull: { providerId: "openrouter", modelId: "gpt-4o-mini" },
      globalDefaultModelRef: null,
      availableModelKeys: new Set(["openrouter:gpt-4o-mini"]),
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      providerId: "openrouter",
      modelId: "gpt-4o-mini",
    });
  });

  itReq(FILE_REQUIREMENT_IDS, "falls back to global default when explicit model is null", () => {
    const result = resolveModelRef({
      modelRefOrNull: null,
      globalDefaultModelRef: { providerId: "gemini", modelId: "gemini-1.5-flash" },
      availableModelKeys: new Set(["gemini:gemini-1.5-flash"]),
    });

    expect(result.isOk()).toBe(true);
  });

  itReq(FILE_REQUIREMENT_IDS, "returns invalid config when resolved model is unavailable", () => {
    const result = resolveModelRef({
      modelRefOrNull: { providerId: "ollama", modelId: "qwen2" },
      globalDefaultModelRef: null,
      availableModelKeys: new Set(["ollama:mistral"]),
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe("InvalidConfigError");
  });

  itReq(
    FILE_REQUIREMENT_IDS,
    "returns invalid config when no explicit or default model exists",
    () => {
      const result = resolveModelRef({
        modelRefOrNull: null,
        globalDefaultModelRef: null,
        availableModelKeys: new Set(),
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe("InvalidConfigError");
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "marks null resolution invalid when global default is unavailable",
    () => {
      const invalid = isModelConfigInvalid({
        modelRefOrNull: null,
        globalDefaultModelRef: { providerId: "gemini", modelId: "gemini-1.5-pro" },
        availableModelKeys: buildAvailableModelKeys({
          gemini: ["gemini-1.5-flash"],
        }),
      });

      expect(invalid).toBe(true);
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "creates grouped provider sections for model picker", () => {
    const grouped = groupModelsByProvider({
      gemini: ["gemini-1.5-flash", "gemini-1.5-pro"],
      openrouter: ["openai/gpt-4o-mini"],
      ollama: [],
    });

    expect(grouped).toEqual([
      {
        providerId: "gemini",
        modelIds: ["gemini-1.5-flash", "gemini-1.5-pro"],
      },
      {
        providerId: "openrouter",
        modelIds: ["openai/gpt-4o-mini"],
      },
    ]);
  });

  itReq(
    FILE_REQUIREMENT_IDS,
    "resolves member generation from the member model before default",
    () => {
      const result = resolveMemberGenerationModel({
        memberModelRefOrNull: { providerId: "openrouter", modelId: "anthropic/claude-3.5-haiku" },
        globalDefaultModelRef: { providerId: "gemini", modelId: "gemini-1.5-flash" },
        availableModelKeys: new Set([
          "gemini:gemini-1.5-flash",
          "openrouter:anthropic/claude-3.5-haiku",
        ]),
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        providerId: "openrouter",
        modelId: "anthropic/claude-3.5-haiku",
      });
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "resolves conductor generation from the conductor model before default",
    () => {
      const result = resolveConductorGenerationModel({
        conductorModelRefOrNull: { providerId: "ollama", modelId: "qwen2.5" },
        globalDefaultModelRef: { providerId: "gemini", modelId: "gemini-1.5-flash" },
        availableModelKeys: new Set(["gemini:gemini-1.5-flash", "ollama:qwen2.5"]),
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        providerId: "ollama",
        modelId: "qwen2.5",
      });
    },
  );
});
