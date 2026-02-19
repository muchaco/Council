import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import { createSettingsIpcHandlers } from "../../src/main/features/settings/ipc-handlers";
import { createSettingsSlice } from "../../src/main/features/settings/slice";
import { domainError } from "../../src/shared/domain/errors";

const createHandlers = () => {
  let tokenCounter = 0;
  const slice = createSettingsSlice({
    nowUtc: () => "2026-02-18T10:00:00.000Z",
    randomToken: () => `token-${++tokenCounter}`,
    fetchGeminiModels: () => okAsync(["gemini-1.5-flash"]),
    fetchOpenRouterModels: () => okAsync(["openai/gpt-4o-mini"]),
    fetchOllamaModels: () => okAsync(["llama3.1"]),
  });
  return createSettingsIpcHandlers(slice);
};

describe("providers ipc contract", () => {
  it("validates payload shapes", async () => {
    const handlers = createHandlers();
    const result = await handlers.testProviderConnection({
      provider: {
        providerId: "gemini",
        endpointUrl: null,
        apiKey: null,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("ValidationError");
    }
  });

  it("rejects provider payloads with unknown credential fields", async () => {
    const handlers = createHandlers();
    const result = await handlers.testProviderConnection({
      provider: {
        providerId: "gemini",
        endpointUrl: null,
        apiKey: "abc123",
        secret: "should-not-cross-ipc",
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("ValidationError");
      expect(JSON.stringify(result.error).includes("should-not-cross-ipc")).toBe(false);
    }
  });

  it("never returns credential secrets in IPC responses", async () => {
    const handlers = createHandlers();
    const testResult = await handlers.testProviderConnection({
      provider: {
        providerId: "openrouter",
        endpointUrl: null,
        apiKey: "super-secret-token",
      },
    });
    expect(testResult.ok).toBe(true);
    if (!testResult.ok) {
      return;
    }

    const saveResult = await handlers.saveProviderConfig(
      {
        provider: {
          providerId: "openrouter",
          endpointUrl: null,
          apiKey: "super-secret-token",
        },
        testToken: testResult.value.testToken,
      },
      5,
    );
    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) {
      return;
    }

    const responseText = JSON.stringify(saveResult.value);
    expect(responseText.includes("super-secret-token")).toBe(false);
    expect(saveResult.value.provider.hasCredential).toBe(true);

    const viewResult = await handlers.getSettingsView({ viewKind: "settings" }, 5);
    expect(viewResult.ok).toBe(true);
    if (!viewResult.ok) {
      return;
    }

    const openrouter = viewResult.value.providers.find((item) => item.providerId === "openrouter");
    expect(openrouter?.hasCredential).toBe(true);
    expect(JSON.stringify(viewResult.value).includes("super-secret-token")).toBe(false);
  });

  it("redacts provider error details before returning over IPC", async () => {
    const slice = createSettingsSlice({
      nowUtc: () => "2026-02-18T10:00:00.000Z",
      randomToken: () => "token-1",
      fetchOpenRouterModels: () =>
        errAsync(
          domainError(
            "ProviderError",
            "provider rejected api key super-secret-token",
            "Could not fetch OpenRouter models. Check credentials and endpoint.",
            {
              apiKey: "super-secret-token",
            },
          ),
        ),
      fetchGeminiModels: () => okAsync(["gemini-1.5-flash"]),
      fetchOllamaModels: () => okAsync(["llama3.1"]),
    });
    const handlers = createSettingsIpcHandlers(slice);

    const result = await handlers.testProviderConnection({
      provider: {
        providerId: "openrouter",
        endpointUrl: null,
        apiKey: "super-secret-token",
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.devMessage).toBe("Redacted at IPC boundary.");
      expect(result.error.details).toBeUndefined();
      expect(JSON.stringify(result.error).includes("super-secret-token")).toBe(false);
    }
  });

  it("validates context last N payload", async () => {
    const handlers = createHandlers();
    const result = await handlers.setContextLastN(
      {
        viewKind: "settings",
        contextLastN: 0,
      },
      7,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("ValidationError");
    }
  });
});
