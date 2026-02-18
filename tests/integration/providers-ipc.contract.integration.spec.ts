import { describe, expect, it } from "vitest";
import { createSettingsIpcHandlers } from "../../src/main/features/settings/ipc-handlers";
import { createSettingsSlice } from "../../src/main/features/settings/slice";

const createHandlers = () => {
  let tokenCounter = 0;
  const slice = createSettingsSlice({
    nowUtc: () => "2026-02-18T10:00:00.000Z",
    randomToken: () => `token-${++tokenCounter}`,
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
});
