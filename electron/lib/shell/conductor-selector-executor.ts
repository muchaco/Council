import { GoogleGenerativeAI } from '@google/generative-ai';

import type { SelectNextSpeakerRequest } from '../../../lib/application/use-cases/conductor';

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

export const executeConductorSelectorRequest = async (
  request: SelectNextSpeakerRequest,
  createSelectorModel: CreateSelectorModel = createGoogleSelectorModel
): Promise<string> => {
  const model = createSelectorModel(request);
  const result = await model.generateContent(request.selectorPrompt);
  return result.response.text();
};
