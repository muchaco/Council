import { ResultAsync, errAsync, okAsync } from "neverthrow";
import type { AiService, AiServiceError, AiServiceGenerateTextRequest } from "../interfaces.js";

type ProviderRuntimeConfig = {
  endpointUrl: string | null;
  credentialRef: string | null;
};

type ProviderAiServiceDependencies = {
  loadProviderConfig: (
    providerId: string,
  ) => ResultAsync<ProviderRuntimeConfig | null, "ProviderError">;
  loadSecret: (account: string) => ResultAsync<string | null, "ProviderError">;
  logger?: {
    info: (component: string, operation: string, context?: Record<string, unknown>) => void;
    error: (
      component: string,
      operation: string,
      error: Error | string,
      context?: Record<string, unknown>,
    ) => void;
  };
};

const DEFAULT_OLLAMA_ENDPOINT = "http://127.0.0.1:11434";
const DEFAULT_OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1";
const DEFAULT_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com";

const buildUrl = (baseUrl: string, path: string): string => new URL(path, baseUrl).toString();

const createProviderError = (
  message: string,
  providerId: string,
  modelId: string,
): AiServiceError => ({
  kind: "ProviderError",
  message,
  providerId,
  modelId,
});

const providerErrorAsync = <T>(
  message: string,
  providerId: string,
  modelId: string,
): ResultAsync<T, AiServiceError> => errAsync(createProviderError(message, providerId, modelId));

const resolveApiKey = (
  providerConfig: ProviderRuntimeConfig,
  loadSecret: ProviderAiServiceDependencies["loadSecret"],
  providerId: string,
  modelId: string,
): ResultAsync<string | null, AiServiceError> => {
  if (providerConfig.credentialRef === null) {
    return okAsync(null);
  }

  return loadSecret(providerConfig.credentialRef)
    .mapErr(() => createProviderError("Failed to load API key from keychain", providerId, modelId))
    .andThen((secret) => {
      if (secret === null || secret.trim().length === 0) {
        return errAsync(createProviderError("API key not found or empty", providerId, modelId));
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
  logger?: ProviderAiServiceDependencies["logger"],
): ResultAsync<{ text: string }, AiServiceError> => {
  const endpoint = providerConfig.endpointUrl ?? DEFAULT_OPENROUTER_ENDPOINT;
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger?.info("ai-service", "openRouterRequestStart", {
    requestId,
    providerId: "openrouter",
    modelId: request.modelId,
    endpoint,
    messageCount: request.messages.length,
  });

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
        const errorText = await response.text().catch(() => "No response body");
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const payload = await response.json();
      const text = toOpenRouterText(payload).trim();
      if (text.length === 0) {
        throw new Error("OpenRouter returned empty content");
      }

      return { text };
    })(),
    (error) => {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger?.error("ai-service", "openRouterRequestError", errorMessage, {
        requestId,
        providerId: "openrouter",
        modelId: request.modelId,
        endpoint,
        durationMs,
        httpError: errorMessage,
      });
      return createProviderError(errorMessage, "openrouter", request.modelId);
    },
  ).andThen((result) => {
    const durationMs = Date.now() - startTime;
    logger?.info("ai-service", "openRouterRequestSuccess", {
      requestId,
      providerId: "openrouter",
      modelId: request.modelId,
      durationMs,
      textLength: result.text.length,
    });
    return okAsync(result);
  });
};

const generateWithOllama = (
  request: AiServiceGenerateTextRequest,
  providerConfig: ProviderRuntimeConfig,
  apiKey: string | null,
  abortSignal: AbortSignal,
  logger?: ProviderAiServiceDependencies["logger"],
): ResultAsync<{ text: string }, AiServiceError> => {
  const endpoint = providerConfig.endpointUrl ?? DEFAULT_OLLAMA_ENDPOINT;
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger?.info("ai-service", "ollamaRequestStart", {
    requestId,
    providerId: "ollama",
    modelId: request.modelId,
    endpoint,
    messageCount: request.messages.length,
  });

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
        const errorText = await response.text().catch(() => "No response body");
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const payload = (await response.json()) as { message?: { content?: unknown } };
      const text =
        typeof payload.message?.content === "string" ? payload.message.content.trim() : "";
      if (text.length === 0) {
        throw new Error("Ollama returned empty content");
      }

      return { text };
    })(),
    (error) => {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger?.error("ai-service", "ollamaRequestError", errorMessage, {
        requestId,
        providerId: "ollama",
        modelId: request.modelId,
        endpoint,
        durationMs,
        httpError: errorMessage,
      });
      return createProviderError(errorMessage, "ollama", request.modelId);
    },
  ).andThen((result) => {
    const durationMs = Date.now() - startTime;
    logger?.info("ai-service", "ollamaRequestSuccess", {
      requestId,
      providerId: "ollama",
      modelId: request.modelId,
      durationMs,
      textLength: result.text.length,
    });
    return okAsync(result);
  });
};

const generateWithGemini = (
  request: AiServiceGenerateTextRequest,
  providerConfig: ProviderRuntimeConfig,
  apiKey: string,
  abortSignal: AbortSignal,
  logger?: ProviderAiServiceDependencies["logger"],
): ResultAsync<{ text: string }, AiServiceError> => {
  const endpoint = providerConfig.endpointUrl ?? DEFAULT_GEMINI_ENDPOINT;
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const systemPrompt = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n")
    .trim();
  const messages = request.messages.filter((message) => message.role !== "system");

  logger?.info("ai-service", "geminiRequestStart", {
    requestId,
    providerId: "gemini",
    modelId: request.modelId,
    endpoint,
    messageCount: request.messages.length,
    hasSystemPrompt: systemPrompt.length > 0,
  });

  return ResultAsync.fromPromise(
    (async () => {
      const url = buildUrl(
        endpoint,
        `/v1beta/models/${encodeURIComponent(request.modelId)}:generateContent`,
      );
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
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
        const errorText = await response.text().catch(() => "No response body");
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const payload = await response.json();
      const text = toGeminiText(payload).trim();
      if (text.length === 0) {
        throw new Error("Gemini returned empty content");
      }

      return { text };
    })(),
    (error) => {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger?.error("ai-service", "geminiRequestError", errorMessage, {
        requestId,
        providerId: "gemini",
        modelId: request.modelId,
        endpoint,
        durationMs,
        httpError: errorMessage,
      });
      return createProviderError(errorMessage, "gemini", request.modelId);
    },
  ).andThen((result) => {
    const durationMs = Date.now() - startTime;
    logger?.info("ai-service", "geminiRequestSuccess", {
      requestId,
      providerId: "gemini",
      modelId: request.modelId,
      durationMs,
      textLength: result.text.length,
    });
    return okAsync(result);
  });
};

export const createProviderAiService = (
  dependencies: ProviderAiServiceDependencies,
): AiService => ({
  generateText: (request, abortSignal) =>
    dependencies
      .loadProviderConfig(request.providerId)
      .mapErr(() =>
        createProviderError("Provider config not found", request.providerId, request.modelId),
      )
      .andThen((providerConfig) => {
        if (providerConfig === null) {
          dependencies.logger?.error("ai-service", "generateText", "Provider config not found", {
            providerId: request.providerId,
            modelId: request.modelId,
          });
          return errAsync(
            createProviderError("Provider config not found", request.providerId, request.modelId),
          );
        }

        return resolveApiKey(
          providerConfig,
          dependencies.loadSecret,
          request.providerId,
          request.modelId,
        ).andThen((apiKey) => {
          switch (request.providerId) {
            case "gemini":
              if (apiKey === null) {
                dependencies.logger?.error("ai-service", "generateText", "API key not found", {
                  providerId: "gemini",
                  modelId: request.modelId,
                });
                return errAsync(
                  createProviderError("API key not found", "gemini", request.modelId),
                );
              }
              return generateWithGemini(
                request,
                providerConfig,
                apiKey,
                abortSignal,
                dependencies.logger,
              );
            case "ollama":
              return generateWithOllama(
                request,
                providerConfig,
                apiKey,
                abortSignal,
                dependencies.logger,
              );
            case "openrouter":
              if (apiKey === null) {
                dependencies.logger?.error("ai-service", "generateText", "API key not found", {
                  providerId: "openrouter",
                  modelId: request.modelId,
                });
                return errAsync(
                  createProviderError("API key not found", "openrouter", request.modelId),
                );
              }
              return generateWithOpenRouter(
                request,
                providerConfig,
                apiKey,
                abortSignal,
                dependencies.logger,
              );
            default:
              dependencies.logger?.error("ai-service", "generateText", "Unknown provider", {
                providerId: request.providerId,
                modelId: request.modelId,
              });
              return errAsync(
                createProviderError(
                  `Unknown provider: ${request.providerId}`,
                  request.providerId,
                  request.modelId,
                ),
              );
          }
        });
      }),
});
