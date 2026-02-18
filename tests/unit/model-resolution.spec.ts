import { describe, expect, it } from "vitest";
import {
  buildAvailableModelKeys,
  groupModelsByProvider,
  isModelConfigInvalid,
  resolveModelRef,
} from "../../src/shared/domain/model-ref";

describe("model resolution", () => {
  it("resolves explicit model when available", () => {
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

  it("falls back to global default when explicit model is null", () => {
    const result = resolveModelRef({
      modelRefOrNull: null,
      globalDefaultModelRef: { providerId: "gemini", modelId: "gemini-1.5-flash" },
      availableModelKeys: new Set(["gemini:gemini-1.5-flash"]),
    });

    expect(result.isOk()).toBe(true);
  });

  it("returns invalid config when resolved model is unavailable", () => {
    const result = resolveModelRef({
      modelRefOrNull: { providerId: "ollama", modelId: "qwen2" },
      globalDefaultModelRef: null,
      availableModelKeys: new Set(["ollama:mistral"]),
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe("InvalidConfigError");
  });

  it("returns invalid config when no explicit or default model exists", () => {
    const result = resolveModelRef({
      modelRefOrNull: null,
      globalDefaultModelRef: null,
      availableModelKeys: new Set(),
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe("InvalidConfigError");
  });

  it("marks null resolution invalid when global default is unavailable", () => {
    const invalid = isModelConfigInvalid({
      modelRefOrNull: null,
      globalDefaultModelRef: { providerId: "gemini", modelId: "gemini-1.5-pro" },
      availableModelKeys: buildAvailableModelKeys({
        gemini: ["gemini-1.5-flash"],
      }),
    });

    expect(invalid).toBe(true);
  });

  it("creates grouped provider sections for model picker", () => {
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
});
