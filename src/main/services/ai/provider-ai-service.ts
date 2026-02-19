import { ResultAsync, errAsync, okAsync } from "neverthrow";
import type { AiService, AiServiceGenerateTextRequest } from "../interfaces.js";

type ProviderRuntimeConfig = {
  endpointUrl: string | null;
  credentialRef: string | null;
};

type ProviderAiServiceDependencies = {
  loadProviderConfig: (
    providerId: string,
  ) => ResultAsync<ProviderRuntimeConfig | null, "ProviderError">;
  loadSecret: (account: string) => ResultAsync<string | null, "ProviderError">;
};

const DEFAULT_OLLAMA_ENDPOINT = "http://127.0.0.1:11434";
const DEFAULT_OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1";
const DEFAULT_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com";

const buildUrl = (baseUrl: string, path: string): string => new URL(path, baseUrl).toString();

const providerErrorAsync = <T>(): ResultAsync<T, "ProviderError"> => errAsync("ProviderError");

const resolveApiKey = (
  providerConfig: ProviderRuntimeConfig,
  loadSecret: ProviderAiServiceDependencies["loadSecret"],
): ResultAsync<string | null, "ProviderError"> => {
  if (providerConfig.credentialRef === null) {
    return okAsync(null);
  }

  return loadSecret(providerConfig.credentialRef).andThen((secret) => {
    if (secret === null || secret.trim().length === 0) {
      return providerErrorAsync<string | null>();
    }

    return okAsync(secret);
  });
};

const toOpenRouterText = (payload: unknown): string => {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }

  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) {
    return "";
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (
          typeof part === "object" &&
          part !== null &&
          (part as { type?: unknown }).type === "text"
        ) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }

  return "";
};

const toGeminiText = (payload: unknown): string => {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }

  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return "";
  }

  const content = (candidates[0] as { content?: unknown }).content;
  if (typeof content !== "object" || content === null) {
    return "";
  }

  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => {
      if (typeof part !== "object" || part === null) {
        return "";
      }

      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("");
};

const generateWithOpenRouter = (
  request: AiServiceGenerateTextRequest,
  providerConfig: ProviderRuntimeConfig,
  apiKey: string,
  abortSignal: AbortSignal,
): ResultAsync<{ text: string }, "ProviderError"> => {
  const endpoint = providerConfig.endpointUrl ?? DEFAULT_OPENROUTER_ENDPOINT;

  return ResultAsync.fromPromise(
    (async () => {
      const response = await fetch(buildUrl(endpoint, "/chat/completions"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: request.modelId,
          messages: request.messages,
          temperature: request.temperature,
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const text = toOpenRouterText(payload).trim();
      if (text.length === 0) {
        throw new Error("OpenRouter returned empty content");
      }

      return { text };
    })(),
    () => "ProviderError",
  );
};

const generateWithOllama = (
  request: AiServiceGenerateTextRequest,
  providerConfig: ProviderRuntimeConfig,
  apiKey: string | null,
  abortSignal: AbortSignal,
): ResultAsync<{ text: string }, "ProviderError"> => {
  const endpoint = providerConfig.endpointUrl ?? DEFAULT_OLLAMA_ENDPOINT;

  return ResultAsync.fromPromise(
    (async () => {
      const response = await fetch(buildUrl(endpoint, "/api/chat"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey === null ? {} : { authorization: `Bearer ${apiKey}` }),
        },
        body: JSON.stringify({
          model: request.modelId,
          stream: false,
          messages: request.messages,
          options:
            request.temperature === undefined ? undefined : { temperature: request.temperature },
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { message?: { content?: unknown } };
      const text =
        typeof payload.message?.content === "string" ? payload.message.content.trim() : "";
      if (text.length === 0) {
        throw new Error("Ollama returned empty content");
      }

      return { text };
    })(),
    () => "ProviderError",
  );
};

const generateWithGemini = (
  request: AiServiceGenerateTextRequest,
  providerConfig: ProviderRuntimeConfig,
  apiKey: string,
  abortSignal: AbortSignal,
): ResultAsync<{ text: string }, "ProviderError"> => {
  const endpoint = providerConfig.endpointUrl ?? DEFAULT_GEMINI_ENDPOINT;

  const systemPrompt = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n")
    .trim();
  const messages = request.messages.filter((message) => message.role !== "system");

  return ResultAsync.fromPromise(
    (async () => {
      const url = buildUrl(
        endpoint,
        `/v1beta/models/${encodeURIComponent(request.modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      );
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...(systemPrompt.length === 0
            ? {}
            : {
                systemInstruction: {
                  parts: [{ text: systemPrompt }],
                },
              }),
          contents: messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig:
            request.temperature === undefined ? undefined : { temperature: request.temperature },
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const text = toGeminiText(payload).trim();
      if (text.length === 0) {
        throw new Error("Gemini returned empty content");
      }

      return { text };
    })(),
    () => "ProviderError",
  );
};

export const createProviderAiService = (
  dependencies: ProviderAiServiceDependencies,
): AiService => ({
  generateText: (request, abortSignal) =>
    dependencies.loadProviderConfig(request.providerId).andThen((providerConfig) => {
      if (providerConfig === null) {
        return providerErrorAsync<{ text: string }>();
      }

      return resolveApiKey(providerConfig, dependencies.loadSecret).andThen((apiKey) => {
        switch (request.providerId) {
          case "gemini":
            if (apiKey === null) {
              return providerErrorAsync<{ text: string }>();
            }
            return generateWithGemini(request, providerConfig, apiKey, abortSignal);
          case "ollama":
            return generateWithOllama(request, providerConfig, apiKey, abortSignal);
          case "openrouter":
            if (apiKey === null) {
              return providerErrorAsync<{ text: string }>();
            }
            return generateWithOpenRouter(request, providerConfig, apiKey, abortSignal);
          default:
            return providerErrorAsync<{ text: string }>();
        }
      });
    }),
});
