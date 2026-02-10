import { ipcMain } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Store from 'electron-store';
import { Effect, Either } from 'effect';

import { decrypt } from './settings.js';
import * as queries from '../lib/queries.js';
import type { BlackboardState } from '../lib/types.js';
import {
  ConductorSelectorGateway,
  ConductorTurnRepository,
  executeConductorTurn,
  type SelectNextSpeakerRequest,
  type SelectNextSpeakerResponse,
} from '../../lib/application/use-cases/conductor/index.js';
import {
  makeConductorTurnRepositoryFromElectronQueries,
} from '../../lib/infrastructure/db/index.js';
import { makeConductorSelectorGatewayFromExecutor } from '../../lib/infrastructure/llm/index.js';

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

async function callSelectorAgent(request: SelectNextSpeakerRequest): Promise<SelectNextSpeakerResponse> {
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
${request.availablePersonas.map(p => `- ${p.name} (${p.role}) - ID: ${p.id}`).join('\n')}

${request.hushedPersonas.length > 0 ? `HUSHED PERSONAS (temporarily muted):
${request.hushedPersonas.map(p => `- ${p.name}: ${p.remainingTurns} turn(s) remaining`).join('\n')}` : ''}

IMPORTANT RULES:
- You CANNOT select the persona who spoke last: ${request.lastSpeakerId ? request.availablePersonas.find(p => p.id === request.lastSpeakerId)?.name || 'Unknown' : 'None'}
- You CANNOT select hushed personas (they are temporarily muted)
- Each persona should speak only once per cycle - assume they said what they needed to say
- If only the orchestrator or last speaker remains, select WAIT_FOR_USER

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
    
    const parsed = JSON.parse(jsonMatch[0]) as SelectNextSpeakerResponse;
    return {
      selectedPersonaId: parsed.selectedPersonaId,
      reasoning: parsed.reasoning || 'No reasoning provided',
      isIntervention: Boolean(parsed.isIntervention),
      interventionMessage: parsed.interventionMessage,
      updateBlackboard: parsed.updateBlackboard || {},
    };
  } catch (error) {
    console.error('Selector agent error:', error);
    throw error;
  }
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
      const repository = makeConductorTurnRepositoryFromElectronQueries(queries);

      const selectorGateway = makeConductorSelectorGatewayFromExecutor(callSelectorAgent);

      const outcome = await Effect.runPromise(
        executeConductorTurn({ sessionId }).pipe(
          Effect.provideService(ConductorTurnRepository, repository),
          Effect.provideService(ConductorSelectorGateway, selectorGateway),
          Effect.either
        )
      );

      if (Either.isLeft(outcome)) {
        const error = outcome.left;

        if (error._tag === 'ConductorInfrastructureError' && error.source === 'selector') {
          return {
            success: false,
            error: error.message,
            code: 'SELECTOR_AGENT_ERROR',
          };
        }

        return {
          success: false,
          error: error.message,
        };
      }

      const result = outcome.right;

      if (result._tag === 'CircuitBreakerStopped') {
        return {
          success: false,
          error: result.message,
          code: 'CIRCUIT_BREAKER',
        };
      }

      if (result._tag === 'WaitForUser') {
        return {
          success: true,
          action: 'WAIT_FOR_USER',
          reasoning: result.reasoning,
          blackboardUpdate: result.blackboardUpdate,
        };
      }

      return {
        success: true,
        action: 'TRIGGER_PERSONA',
        personaId: result.personaId,
        reasoning: result.reasoning,
        blackboardUpdate: result.blackboardUpdate,
        isIntervention: result.isIntervention,
        autoReplyCount: result.autoReplyCount,
        warning: result.warning,
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
