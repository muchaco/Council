import { ipcMain } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Store from 'electron-store';
import { decrypt } from './settings.js';
import * as queries from '../lib/queries.js';

interface StoreSchema {
  apiKey: string;
}

const store = new Store<StoreSchema>({
  name: 'council-settings',
  encryptionKey: process.env.COUNCIL_ENCRYPTION_KEY || 'council-default-key-change-in-production',
});

function getApiKey(): string {
  const encrypted = (store as any).get('apiKey') as string | undefined;
  if (!encrypted) {
    throw new Error('API key not configured');
  }
  return decrypt(encrypted);
}

interface ChatRequest {
  personaId: string;
  sessionId: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  problemContext: string;
}

export function setupLLMHandlers(): void {
  ipcMain.handle('llm:chat', async (_, request: ChatRequest) => {
    try {
      const apiKey = getApiKey();
      const genAI = new GoogleGenerativeAI(apiKey);
      
      const model = genAI.getGenerativeModel({
        model: request.model,
        systemInstruction: request.systemPrompt,
      });
      
      // Get conversation history (last 10 messages)
      const history = await queries.getLastMessages(request.sessionId, 10);
      
      // Format history for Gemini
      const formattedHistory = history.map(msg => ({
        role: msg.personaId === null ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));
      
      // Create chat session
      const chat = model.startChat({
        history: formattedHistory,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: 2048,
        },
      });
      
      // Build the prompt with context
      const prompt = `Context: We are discussing the following problem: ${request.problemContext}

Please provide your perspective and insights on this problem. Consider the previous conversation context and respond accordingly.`;
      
      // Send message and get response
      const result = await chat.sendMessage(prompt);
      const response = result.response;
      const text = response.text();
      
      // Estimate token count (rough approximation: ~4 characters per token)
      const estimatedTokens = Math.ceil(text.length / 4);
      
      return {
        success: true,
        data: {
          content: text,
          tokenCount: estimatedTokens,
        },
      };
    } catch (error) {
      console.error('Error in LLM chat:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}
