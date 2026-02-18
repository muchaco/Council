import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { createSettingsSlice } from "../../src/main/features/settings/slice";

const createDeterministicSlice = () => {
  let tokenCounter = 0;
  return createSettingsSlice({
    nowUtc: () => "2026-02-18T10:00:00.000Z",
    randomToken: () => `token-${++tokenCounter}`,
  });
};

describe("settings providers handlers", () => {
  it("requires successful test before save", async () => {
    const slice = createDeterministicSlice();
    const saveResult = await slice.saveProviderConfig({
      webContentsId: 7,
      provider: {
        providerId: "gemini",
        endpointUrl: null,
        apiKey: "secret-key",
      },
      testToken: "token-not-issued",
    });

    expect(saveResult.isErr()).toBe(true);
    expect(saveResult._unsafeUnwrapErr().kind).toBe("ValidationError");
  });

  it("saves ollama without API key", async () => {
    const slice = createDeterministicSlice();
    const testResult = await slice.testProviderConnection({
      provider: {
        providerId: "ollama",
        endpointUrl: "http://127.0.0.1:11434",
        apiKey: null,
      },
    });
    expect(testResult.isOk()).toBe(true);

    const token = testResult._unsafeUnwrap().testToken;
    const saveResult = await slice.saveProviderConfig({
      webContentsId: 13,
      provider: {
        providerId: "ollama",
        endpointUrl: "http://127.0.0.1:11434",
        apiKey: null,
      },
      testToken: token,
    });
    expect(saveResult.isOk()).toBe(true);
    expect(saveResult._unsafeUnwrap().provider.hasCredential).toBe(false);
  });

  it("saves ollama API key when provided", async () => {
    let tokenCounter = 0;
    const slice = createSettingsSlice({
      nowUtc: () => "2026-02-18T10:00:00.000Z",
      randomToken: () => `token-${++tokenCounter}`,
      fetchOllamaModels: () => okAsync(["smollm:135m"]),
    });
    const testResult = await slice.testProviderConnection({
      provider: {
        providerId: "ollama",
        endpointUrl: "https://ollama.example.com",
        apiKey: "ollama-remote-key",
      },
    });
    expect(testResult.isOk()).toBe(true);

    const saveResult = await slice.saveProviderConfig({
      webContentsId: 14,
      provider: {
        providerId: "ollama",
        endpointUrl: "https://ollama.example.com",
        apiKey: "ollama-remote-key",
      },
      testToken: testResult._unsafeUnwrap().testToken,
    });
    expect(saveResult.isOk()).toBe(true);
    expect(saveResult._unsafeUnwrap().provider.hasCredential).toBe(true);
  });

  it("save and refresh update model catalog", async () => {
    const slice = createDeterministicSlice();
    const testResult = await slice.testProviderConnection({
      provider: {
        providerId: "openrouter",
        endpointUrl: null,
        apiKey: "openrouter-key",
      },
    });
    const token = testResult._unsafeUnwrap().testToken;

    const saveResult = await slice.saveProviderConfig({
      webContentsId: 21,
      provider: {
        providerId: "openrouter",
        endpointUrl: null,
        apiKey: "openrouter-key",
      },
      testToken: token,
    });
    expect(saveResult.isOk()).toBe(true);
    expect(saveResult._unsafeUnwrap().modelCatalog.modelsByProvider.openrouter).toContain(
      "openai/gpt-4o-mini",
    );

    const refreshResult = await slice.refreshModelCatalog({
      webContentsId: 21,
      viewKind: "settings",
    });
    expect(refreshResult.isOk()).toBe(true);
    expect(refreshResult._unsafeUnwrap().modelCatalog.snapshotId).toBe("token-3");
  });

  it("applies global default null-resolution semantics", async () => {
    const slice = createDeterministicSlice();
    const testResult = await slice.testProviderConnection({
      provider: {
        providerId: "gemini",
        endpointUrl: null,
        apiKey: "gemini-key",
      },
    });
    await slice.saveProviderConfig({
      webContentsId: 32,
      provider: {
        providerId: "gemini",
        endpointUrl: null,
        apiKey: "gemini-key",
      },
      testToken: testResult._unsafeUnwrap().testToken,
    });

    const setDefaultResult = await slice.setGlobalDefaultModel({
      webContentsId: 32,
      viewKind: "settings",
      modelRefOrNull: { providerId: "gemini", modelId: "gemini-1.5-flash" },
    });
    expect(setDefaultResult.isOk()).toBe(true);
    expect(setDefaultResult._unsafeUnwrap().globalDefaultModelInvalidConfig).toBe(false);

    const clearDefaultResult = await slice.setGlobalDefaultModel({
      webContentsId: 32,
      viewKind: "settings",
      modelRefOrNull: null,
    });
    expect(clearDefaultResult.isOk()).toBe(true);
    expect(clearDefaultResult._unsafeUnwrap().globalDefaultModelRef).toBeNull();
    expect(clearDefaultResult._unsafeUnwrap().globalDefaultModelInvalidConfig).toBe(true);
  });

  it("fails saving credentials when keychain is unavailable", async () => {
    let tokenCounter = 0;
    const slice = createSettingsSlice({
      nowUtc: () => "2026-02-18T10:00:00.000Z",
      randomToken: () => `token-${++tokenCounter}`,
      saveSecret: () => errAsync("KeychainUnavailableError"),
    });

    const testResult = await slice.testProviderConnection({
      provider: {
        providerId: "gemini",
        endpointUrl: null,
        apiKey: "gemini-key",
      },
    });
    expect(testResult.isOk()).toBe(true);

    const saveResult = await slice.saveProviderConfig({
      webContentsId: 44,
      provider: {
        providerId: "gemini",
        endpointUrl: null,
        apiKey: "gemini-key",
      },
      testToken: testResult._unsafeUnwrap().testToken,
    });
    expect(saveResult.isErr()).toBe(true);
    expect(saveResult._unsafeUnwrapErr().kind).toBe("ProviderError");
    expect(saveResult._unsafeUnwrapErr().userMessage).toContain("keychain");
  });

  it("cleans cached snapshots when web contents is released", async () => {
    const slice = createDeterministicSlice();
    const testResult = await slice.testProviderConnection({
      provider: {
        providerId: "openrouter",
        endpointUrl: null,
        apiKey: "openrouter-key",
      },
    });
    await slice.saveProviderConfig({
      webContentsId: 55,
      provider: {
        providerId: "openrouter",
        endpointUrl: null,
        apiKey: "openrouter-key",
      },
      testToken: testResult._unsafeUnwrap().testToken,
    });

    const firstView = await slice.getSettingsView({
      webContentsId: 55,
      viewKind: "settings",
    });
    expect(firstView.isOk()).toBe(true);

    slice.releaseViewSnapshots(55);

    const secondView = await slice.getSettingsView({
      webContentsId: 55,
      viewKind: "settings",
    });
    expect(secondView.isOk()).toBe(true);

    expect(secondView._unsafeUnwrap().modelCatalog.snapshotId).not.toBe(
      firstView._unsafeUnwrap().modelCatalog.snapshotId,
    );
  });

  it("uses discovered Ollama models instead of static defaults", async () => {
    let tokenCounter = 0;
    let models: ReadonlyArray<string> = ["smollm:135m", "all-minilm:latest"];
    const fetchOllamaModels = vi.fn(() => okAsync(models));

    const slice = createSettingsSlice({
      nowUtc: () => "2026-02-18T10:00:00.000Z",
      randomToken: () => `token-${++tokenCounter}`,
      fetchOllamaModels,
    });

    const testResult = await slice.testProviderConnection({
      provider: {
        providerId: "ollama",
        endpointUrl: "http://127.0.0.1:11434",
        apiKey: null,
      },
    });
    expect(testResult.isOk()).toBe(true);
    expect(testResult._unsafeUnwrap().modelsByProvider.ollama).toEqual([
      "smollm:135m",
      "all-minilm:latest",
    ]);

    const saveResult = await slice.saveProviderConfig({
      webContentsId: 66,
      provider: {
        providerId: "ollama",
        endpointUrl: "http://127.0.0.1:11434",
        apiKey: null,
      },
      testToken: testResult._unsafeUnwrap().testToken,
    });
    expect(saveResult.isOk()).toBe(true);
    expect(saveResult._unsafeUnwrap().modelCatalog.modelsByProvider.ollama).toEqual([
      "smollm:135m",
      "all-minilm:latest",
    ]);

    models = ["smollm:135m", "all-minilm:latest", "qwen2.5:latest"];
    const refreshResult = await slice.refreshModelCatalog({
      webContentsId: 66,
      viewKind: "settings",
    });
    expect(refreshResult.isOk()).toBe(true);
    expect(refreshResult._unsafeUnwrap().modelCatalog.modelsByProvider.ollama).toEqual([
      "smollm:135m",
      "all-minilm:latest",
      "qwen2.5:latest",
    ]);
    expect(fetchOllamaModels).toHaveBeenCalled();
  });
});
