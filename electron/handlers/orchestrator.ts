import { ipcMain } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Store from 'electron-store';
import { decrypt } from './settings.js';
import * as queries from '../lib/queries.js';
import type { BlackboardState, Persona, Message } from '../lib/types.js';

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

// Constants
const MAX_AUTO_REPLIES = 8;
const TOKEN_BUDGET_WARNING = 50000;
const TOKEN_BUDGET_LIMIT = 100000;

interface SelectorRequest {
  sessionId: string;
  selectorModel: string;
  recentMessages: Array<{
    role: 'user' | 'model';
    content: string;
    personaName: string;
  }>;
  blackboard: BlackboardState;
  availablePersonas: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  problemDescription: string;
  outputGoal: string;
}

interface SelectorResponse {
  selectedPersonaId: string | 'WAIT_FOR_USER';
  reasoning: string;
  isIntervention: boolean;
  interventionMessage?: string;
  updateBlackboard: Partial<BlackboardState>;
}

async function callSelectorAgent(request: SelectorRequest): Promise<SelectorResponse> {
  const apiKey = getApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({
    model: request.selectorModel,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  });

  const prompt = `You are the Selector Agent for a Council of AI agents discussing a problem. Your job is to analyze the conversation and select the next best speaker.

PROBLEM: ${request.problemDescription}
OUTPUT GOAL: ${request.outputGoal}

CURRENT BLACKBOARD STATE:
- Consensus: ${request.blackboard.consensus || 'None yet'}
- Active Conflicts: ${request.blackboard.conflicts || 'None yet'}
- Next Step: ${request.blackboard.nextStep || 'None defined'}
- Key Facts: ${request.blackboard.facts || 'None yet'}

RECENT CONVERSATION:
${request.recentMessages.map(m => `${m.personaName}: ${m.content}`).join('\n\n')}

AVAILABLE PERSONAS:
${request.availablePersonas.map(p => `- ${p.name} (${p.role})`).join('\n')}

Your task:
1. Analyze the current topic and identify open questions or conflicts
2. Count how many consecutive messages are off-topic (not addressing the problem or output goal)
3. Select the persona best suited to advance the discussion
4. Update the Blackboard with new consensus, conflicts, next step, or facts

RULES:
- If conversation has drifted off-topic for 3+ messages, flag isIntervention=true
- If discussion is complete or needs human input, select "WAIT_FOR_USER"
- Consider expertise match, recency, and relevance when selecting

Respond in this exact JSON format:
{
  "selectedPersonaId": "uuid or WAIT_FOR_USER",
  "reasoning": "Why this persona or wait",
  "isIntervention": true/false,
  "interventionMessage": "If drift detected, provide steering question",
  "updateBlackboard": {
    "consensus": "string or empty",
    "conflicts": "string or empty", 
    "nextStep": "string or empty",
    "facts": "string or empty"
  }
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in selector response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]) as SelectorResponse;
    return {
      selectedPersonaId: parsed.selectedPersonaId,
      reasoning: parsed.reasoning || 'No reasoning provided',
      isIntervention: Boolean(parsed.isIntervention),
      interventionMessage: parsed.interventionMessage,
      updateBlackboard: parsed.updateBlackboard || {},
    };
  } catch (error) {
    console.error('Selector agent error:', error);
    // Propagate error instead of converting to WAIT_FOR_USER
    throw new Error(`Selector agent failed: ${(error as Error).message}`);
  }
}

async function checkCircuitBreaker(sessionId: string): Promise<{ shouldStop: boolean; message?: string }> {
  const session = await queries.getSession(sessionId);
  if (!session) {
    return { shouldStop: true, message: 'Session not found' };
  }

  // Check auto-reply count
  if (session.autoReplyCount >= MAX_AUTO_REPLIES) {
    return {
      shouldStop: true,
      message: `Circuit breaker: Maximum ${MAX_AUTO_REPLIES} auto-replies reached. Click continue to proceed.`,
    };
  }

  // Check token budget
  if (session.tokenCount >= TOKEN_BUDGET_LIMIT) {
    return {
      shouldStop: true,
      message: `Token budget exceeded (${session.tokenCount.toLocaleString()} / ${TOKEN_BUDGET_LIMIT.toLocaleString()}). Session paused.`,
    };
  }

  // Check warning threshold
  if (session.tokenCount >= TOKEN_BUDGET_WARNING) {
    return {
      shouldStop: false,
      message: `Warning: Token usage at ${Math.round((session.tokenCount / TOKEN_BUDGET_LIMIT) * 100)}% of budget`,
    };
  }

  return { shouldStop: false };
}

export function setupOrchestratorHandlers(): void {
  // Enable orchestrator for a session
  ipcMain.handle('orchestrator:enable', async (_, { sessionId, orchestratorPersonaId }: { sessionId: string; orchestratorPersonaId: string }) => {
    try {
      await queries.enableOrchestrator(sessionId, orchestratorPersonaId);
      return { success: true };
    } catch (error) {
      console.error('Error enabling orchestrator:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Disable orchestrator for a session
  ipcMain.handle('orchestrator:disable', async (_, sessionId: string) => {
    try {
      await queries.disableOrchestrator(sessionId);
      await queries.resetAutoReplyCount(sessionId);
      return { success: true };
    } catch (error) {
      console.error('Error disabling orchestrator:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Process a turn - this is the main orchestration loop
  ipcMain.handle('orchestrator:processTurn', async (_, sessionId: string) => {
    try {
      // Get session and personas
      const session = await queries.getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      if (!session.orchestratorEnabled || !session.orchestratorPersonaId) {
        return { success: false, error: 'Orchestrator not enabled for this session' };
      }

      // Check circuit breaker
      const circuitCheck = await checkCircuitBreaker(sessionId);
      if (circuitCheck.shouldStop) {
        return { 
          success: false, 
          error: circuitCheck.message,
          code: 'CIRCUIT_BREAKER'
        };
      }

      // Get session personas
      const personas = await queries.getSessionPersonas(sessionId);
      if (personas.length === 0) {
        return { success: false, error: 'No personas in session' };
      }

      // Get recent messages
      const messages = await queries.getLastMessages(sessionId, 10);
      
      // Format messages for selector
      const recentMessages = messages.map(msg => {
        const persona = personas.find(p => p.id === msg.personaId);
        return {
          role: msg.personaId === null ? 'user' as const : 'model' as const,
          content: msg.content,
          personaName: msg.personaId === null ? 'User' : (persona?.name || 'Unknown'),
        };
      });

      // Get blackboard state
      const blackboard = session.blackboard || {
        consensus: '',
        conflicts: '',
        nextStep: '',
        facts: '',
      };

      // Get available personas (exclude orchestrator from selection)
      const availablePersonas = personas
        .filter(p => p.id !== session.orchestratorPersonaId)
        .map(p => ({ id: p.id, name: p.name, role: p.role }));

      // Get orchestrator persona for selector model
      const orchestratorPersona = personas.find(p => p.id === session.orchestratorPersonaId);
      if (!orchestratorPersona) {
        return {
          success: false,
          error: 'Orchestrator persona not found',
        };
      }

      // Call selector agent
      let selectorResult;
      try {
        selectorResult = await callSelectorAgent({
          sessionId,
          selectorModel: orchestratorPersona.geminiModel,
          recentMessages,
          blackboard,
          availablePersonas,
          problemDescription: session.problemDescription,
          outputGoal: session.outputGoal,
        });
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
          code: 'SELECTOR_AGENT_ERROR',
        };
      }

      // Ensure selectorResult is defined (should always be the case unless error thrown)
      if (!selectorResult) {
        return {
          success: false,
          error: 'Selector agent did not return a result',
          code: 'SELECTOR_AGENT_ERROR',
        };
      }

      // Update blackboard if provided
      if (Object.keys(selectorResult.updateBlackboard).length > 0) {
        const updatedBlackboard = {
          ...blackboard,
          ...selectorResult.updateBlackboard,
        };
        await queries.updateBlackboard(sessionId, updatedBlackboard);
      }

      // Handle intervention
      if (selectorResult.isIntervention && selectorResult.interventionMessage) {
        const turnNumber = await queries.getNextTurnNumber(sessionId);
        await queries.createMessage({
          sessionId,
          personaId: orchestratorPersona.id,
          content: selectorResult.interventionMessage,
          turnNumber,
            metadata: { isIntervention: true, selectorReasoning: selectorResult.reasoning },
        });
      }

      // Handle wait for user
      if (selectorResult.selectedPersonaId === 'WAIT_FOR_USER') {
        return {
          success: true,
          action: 'WAIT_FOR_USER',
          reasoning: selectorResult.reasoning,
          blackboardUpdate: selectorResult.updateBlackboard,
        };
      }

      // Validate selected persona exists
      const selectedPersona = personas.find(p => p.id === selectorResult.selectedPersonaId);
      if (!selectedPersona) {
        return {
          success: false,
          error: `Selected persona ${selectorResult.selectedPersonaId} not found`,
        };
      }

      // Increment auto-reply count
      const newCount = await queries.incrementAutoReplyCount(sessionId);

      return {
        success: true,
        action: 'TRIGGER_PERSONA',
        personaId: selectorResult.selectedPersonaId,
        reasoning: selectorResult.reasoning,
        blackboardUpdate: selectorResult.updateBlackboard,
        isIntervention: selectorResult.isIntervention,
        autoReplyCount: newCount,
        warning: circuitCheck.message,
      };

    } catch (error) {
      console.error('Orchestration error:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // Reset circuit breaker (user clicked continue)
  ipcMain.handle('orchestrator:resetCircuitBreaker', async (_, sessionId: string) => {
    try {
      await queries.resetAutoReplyCount(sessionId);
      return { success: true };
    } catch (error) {
      console.error('Error resetting circuit breaker:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get blackboard state
  ipcMain.handle('orchestrator:getBlackboard', async (_, sessionId: string) => {
    try {
      const session = await queries.getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      return {
        success: true,
        data: session.blackboard || {
          consensus: '',
          conflicts: '',
          nextStep: '',
          facts: '',
        },
      };
    } catch (error) {
      console.error('Error getting blackboard:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Update blackboard manually (for testing or debugging)
  ipcMain.handle('orchestrator:updateBlackboard', async (_, { sessionId, blackboard }: { sessionId: string; blackboard: BlackboardState }) => {
    try {
      await queries.updateBlackboard(sessionId, blackboard);
      return { success: true };
    } catch (error) {
      console.error('Error updating blackboard:', error);
      return { success: false, error: (error as Error).message };
    }
  });
}
