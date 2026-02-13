import { Effect } from 'effect';
import type { GenerateRequest, GenerateResponse, ModelInfo } from './types.js';
import type { LlmGatewayError } from '../../core/errors/llm-error.js';

export interface LlmGatewayAdapter {
  readonly generateResponse: (
    request: GenerateRequest
  ) => Effect.Effect<GenerateResponse, LlmGatewayError>;

  readonly listModels: (
    apiKey: string
  ) => Effect.Effect<ReadonlyArray<ModelInfo>, LlmGatewayError>;
}
