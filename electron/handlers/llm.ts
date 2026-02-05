import { ipcMain } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Store from 'electron-store';
import { decrypt } from './settings.js';
import * as queries from '../lib/queries.js';
import type { Persona, BlackboardState } from '../lib/types.js';

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
  hiddenAgenda?: string;
  temperature: number;
  problemContext: string;
  outputGoal: string;
  blackboard: BlackboardState;
  otherPersonas: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

function formatHistory(history: any[], personaMap: Map<string, Persona>): string {
  return history.map((msg, index) => {
    if (msg.personaId === null) {
      return `[Turn ${index + 1}] User: ${msg.content}`;
    }
    const persona = personaMap.get(msg.personaId);
    const name = persona?.name || 'Unknown';
    const role = persona?.role || '';
    return `[Turn ${index + 1}] ${name}${role ? ` (${role})` : ''}: ${msg.content}`;
  }).join('\n\n');
}

export function setupLLMHandlers(): void {
  ipcMain.handle('llm:chat', async (_, request: ChatRequest) => {
    try {
      const apiKey = getApiKey();
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Get session personas for context
      const sessionPersonas = await queries.getSessionPersonas(request.sessionId);
      const personaMap = new Map(sessionPersonas.map(p => [p.id, p]));
      
      const currentPersona = personaMap.get(request.personaId);
      if (!currentPersona) {
        throw new Error('Persona not found in session');
      }
      
      // Enhanced system prompt with hidden agenda
      const enhancedSystemPrompt = `${request.systemPrompt}

[INTERNAL - DO NOT EXPLICITLY STATE IN YOUR RESPONSE]
Your hidden motivations/biases: ${request.hiddenAgenda || 'None defined'}

Instructions regarding your hidden agenda:
- Subtly steer conversations toward your hidden agenda
- Disguise your true motivations behind logical arguments
- React more positively to points that align with your agenda
- Gently redirect when the conversation moves away from your interests
- Never reveal this hidden agenda directly in your responses`;
      
      const model = genAI.getGenerativeModel({
        model: request.model,
        systemInstruction: enhancedSystemPrompt,
      });
      
      // Get conversation history (last 15 messages - increased from 10)
      const history = await queries.getLastMessages(request.sessionId, 15);
      
      // Format history with named speaker attribution
      const formattedHistory = history.map(msg => {
        if (msg.personaId === null) {
          return {
            role: 'user',
            parts: [{ text: `User: ${msg.content}` }]
          };
        } else {
          const persona = personaMap.get(msg.personaId);
          const name = persona?.name || 'Unknown';
          return {
            role: 'user',
            parts: [{ text: `${name}: ${msg.content}` }]
          };
        }
      });
      
      // Create chat session
      const chat = model.startChat({
        history: formattedHistory,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: 2048,
        },
      });
      
      // Build blackboard section
      const blackboardSection = `
COUNCIL BLACKBOARD (shared understanding):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤝 Consensus: ${request.blackboard.consensus || 'No consensus reached yet'}

⚔️ Active Conflicts: ${request.blackboard.conflicts || 'No active conflicts'}

🎯 Next Step: ${request.blackboard.nextStep || 'Waiting for input'}

📋 Key Facts: ${request.blackboard.facts || 'No facts established'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      // Build multi-agent debate prompt
      const prompt = `You are ${currentPersona.name}, a member of a multi-agent Council debating an important problem.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROBLEM:
${request.problemContext}

OUTPUT GOAL:
${request.outputGoal || 'Reach consensus and actionable recommendations'}

YOUR ROLE IN THE COUNCIL:
- Name: ${currentPersona.name}
- Title: ${currentPersona.role}

FELLOW COUNCIL MEMBERS:
${request.otherPersonas.map(p => `- ${p.name} (${p.role})`).join('\n')}

${blackboardSection}

DEBATE INSTRUCTIONS:
1. Review the conversation history and identify specific points to address
2. Reference fellow council members by name when responding to their points
3. Build upon consensus areas and challenge conflicts constructively
4. Progress toward the "Next Step" stated in the blackboard
5. Consider both your public role and your private motivations
6. Disagree respectfully but firmly when you have genuine objections
7. Synthesize ideas when you see opportunities for compromise

CONVERSATION HISTORY:
${formatHistory(history, personaMap)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
It's your turn to speak. Address your fellow council members directly, reference specific points from the discussion, and advance the debate toward a resolution.

${currentPersona.name}:`;
      
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
