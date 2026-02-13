export interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
}

export interface GenerateRequest {
  readonly modelId: string;
  readonly apiKey: string;
  readonly systemPrompt?: string;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface GenerateResponse {
  readonly content: string;
  readonly tokenCount?: number;
  readonly finishReason?: string;
}

export interface ModelInfo {
  readonly id: string;
  readonly displayName: string;
  readonly description?: string;
  readonly maxTokens?: number;
  readonly supportsStreaming: boolean;
}
