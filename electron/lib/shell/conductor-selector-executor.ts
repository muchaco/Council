import { GoogleGenerativeAI } from '@google/generative-ai';

import type { SelectNextSpeakerRequest } from '../../../lib/application/use-cases/conductor';
import { logDiagnosticsEvent } from '../diagnostics/logger.js';

interface SelectorModelResponse {
  readonly response: {
    readonly text: () => string;
  };
}

interface SelectorModel {
  readonly generateContent: (prompt: string) => Promise<SelectorModelResponse>;
}

type CreateSelectorModel = (request: SelectNextSpeakerRequest) => SelectorModel;

const createGoogleSelectorModel: CreateSelectorModel = (request) => {
  const genAI = new GoogleGenerativeAI(request.apiKey);
  return genAI.getGenerativeModel({
    model: request.selectorModel,
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
    },
  });
};

const extractAvailablePersonaIdsFromPrompt = (prompt: string): string[] => {
  // Matches "- Persona Name (Role) - ID: <uuid>" pattern
  const idPattern = /- .+ \(.+\) - ID: ([a-f0-9-]+)/gi;
  const matches: string[] = [];
  let match;
  while ((match = idPattern.exec(prompt)) !== null) {
    matches.push(match[1]);
  }
  return matches;
};

export const executeConductorSelectorRequest = async (
  request: SelectNextSpeakerRequest,
  createSelectorModel: CreateSelectorModel = createGoogleSelectorModel
): Promise<string> => {
  const availablePersonaIds = extractAvailablePersonaIdsFromPrompt(request.selectorPrompt);

  logDiagnosticsEvent({
    event_name: 'conductor.selector.prompt_prepared',
    context: {
      available_persona_count: availablePersonaIds.length,
      available_persona_ids: availablePersonaIds,
    },
  });

  const model = createSelectorModel(request);
  const result = await model.generateContent(request.selectorPrompt);
  const rawText = result.response.text();
  logDiagnosticsEvent({
    event_name: 'conductor.selector.raw_response',
    context: {
      response_length: rawText.length,
      response_preview: rawText.slice(0, 500),
      has_json: rawText.includes('{'),
    },
  });
  return rawText;
};
