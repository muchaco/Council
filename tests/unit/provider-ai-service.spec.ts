import { errAsync, okAsync } from "neverthrow";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProviderAiService } from "../../src/main/services/ai/provider-ai-service";

describe("provider ai service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("calls OpenRouter with keychain-loaded secret", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: "openrouter-text" } }] }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = createProviderAiService({
      loadProviderConfig: () =>
        okAsync({
          endpointUrl: null,
          credentialRef: "provider/openrouter",
        }),
      loadSecret: () => okAsync("super-secret"),
    });

    const result = await service.generateText(
      {
        providerId: "openrouter",
        modelId: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hello" }],
      },
      new AbortController().signal,
    );

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().text).toBe("openrouter-text");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("calls Ollama without API key when credential ref is absent", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: { content: "ollama-text" } }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = createProviderAiService({
      loadProviderConfig: () =>
        okAsync({
          endpointUrl: "http://127.0.0.1:11434",
          credentialRef: null,
        }),
      loadSecret: () => okAsync(null),
    });

    const result = await service.generateText(
      {
        providerId: "ollama",
        modelId: "llama3.1",
        messages: [{ role: "user", content: "hello" }],
      },
      new AbortController().signal,
    );

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().text).toBe("ollama-text");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps keychain read failures to provider error", async () => {
    const service = createProviderAiService({
      loadProviderConfig: () =>
        okAsync({
          endpointUrl: null,
          credentialRef: "provider/gemini",
        }),
      loadSecret: () => errAsync("ProviderError"),
    });

    const result = await service.generateText(
      {
        providerId: "gemini",
        modelId: "gemini-1.5-flash",
        messages: [{ role: "user", content: "hello" }],
      },
      new AbortController().signal,
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe("ProviderError");
  });

  it("calls Gemini with API key header instead of query param", async () => {
    const fetchMock = vi.fn((_input: string, _init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: "gemini-text" }] } }],
          }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = createProviderAiService({
      loadProviderConfig: () =>
        okAsync({
          endpointUrl: null,
          credentialRef: "provider/gemini",
        }),
      loadSecret: () => okAsync("super-secret"),
    });

    const result = await service.generateText(
      {
        providerId: "gemini",
        modelId: "gemini-1.5-flash",
        messages: [{ role: "user", content: "hello" }],
      },
      new AbortController().signal,
    );

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().text).toBe("gemini-text");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (firstCall === undefined) {
      return;
    }

    const [url, init] = firstCall;
    expect(url).toContain("/v1beta/models/gemini-1.5-flash:generateContent");
    expect(url).not.toContain("?key=");
    expect(init).toBeDefined();
    if (init === undefined) {
      return;
    }
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      "x-goog-api-key": "super-secret",
    });
  });
});
