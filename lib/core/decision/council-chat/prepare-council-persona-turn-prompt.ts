import { Either } from 'effect';

import type {
  CouncilChatMessageSnapshot,
  CouncilChatPersonaSnapshot,
  CouncilChatRequest,
  PreparedCouncilPersonaTurnPrompt,
} from '../../domain/council-chat';
import type { CouncilChatDomainError } from '../../errors/council-chat-error';

const buildHistoryForModel = (
  recentMessages: readonly CouncilChatMessageSnapshot[],
  personasById: ReadonlyMap<string, CouncilChatPersonaSnapshot>
) =>
  recentMessages.map((message) => {
    if (message.personaId === null) {
      return {
        role: 'user' as const,
        parts: [{ text: `User: ${message.content}` }],
      };
    }

    const persona = personasById.get(message.personaId);
    const personaName = persona?.name ?? 'Unknown';
    return {
      role: 'user' as const,
      parts: [{ text: `${personaName}: ${message.content}` }],
    };
  });

const formatHistoryForPrompt = (
  recentMessages: readonly CouncilChatMessageSnapshot[],
  personasById: ReadonlyMap<string, CouncilChatPersonaSnapshot>
): string =>
  recentMessages
    .map((message, index) => {
      if (message.personaId === null) {
        return `[Turn ${index + 1}] User: ${message.content}`;
      }

      const persona = personasById.get(message.personaId);
      const name = persona?.name ?? 'Unknown';
      const role = persona?.role ?? '';
      return `[Turn ${index + 1}] ${name}${role ? ` (${role})` : ''}: ${message.content}`;
    })
    .join('\n\n');

const buildEnhancedSystemPrompt = (request: CouncilChatRequest): string =>
  `${request.systemPrompt}

[INTERNAL - DO NOT EXPLICITLY STATE IN YOUR RESPONSE]
Your hidden motivations/biases: ${request.hiddenAgenda || 'None defined'}

Instructions regarding your hidden agenda:
- Subtly steer conversations toward your hidden agenda
- Disguise your true motivations behind logical arguments
- React more positively to points that align with your agenda
- Gently redirect when the conversation moves away from your interests
- Never reveal this hidden agenda directly in your responses

${request.verbosity ? `VERBOSITY INSTRUCTION: ${request.verbosity}` : ''}`;

const buildBlackboardSection = (request: CouncilChatRequest): string => `
COUNCIL BLACKBOARD (shared understanding):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤝 Consensus: ${request.blackboard.consensus || 'No consensus reached yet'}

⚔️ Active Conflicts: ${request.blackboard.conflicts || 'No active conflicts'}

🎯 Next Step: ${request.blackboard.nextStep || 'Waiting for input'}

📋 Key Facts: ${request.blackboard.facts || 'No facts established'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

export const prepareCouncilPersonaTurnPrompt = (
  request: CouncilChatRequest,
  sessionPersonas: readonly CouncilChatPersonaSnapshot[],
  recentMessages: readonly CouncilChatMessageSnapshot[]
): Either.Either<PreparedCouncilPersonaTurnPrompt, CouncilChatDomainError> => {
  const personasById = new Map(sessionPersonas.map((persona) => [persona.id, persona]));
  const currentPersona = personasById.get(request.personaId);

  if (!currentPersona) {
    return Either.left({
      _tag: 'CouncilChatPersonaNotFoundError',
      message: 'Persona not found in session',
    });
  }

  const formattedHistory = formatHistoryForPrompt(recentMessages, personasById);
  const blackboardSection = buildBlackboardSection(request);

  const turnPrompt = `You are ${currentPersona.name}, a member of a multi-agent Council debating an important problem.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROBLEM:
${request.problemContext}

OUTPUT GOAL:
${request.outputGoal || 'Reach consensus and actionable recommendations'}

YOUR ROLE IN THE COUNCIL:
- Name: ${currentPersona.name}
- Title: ${currentPersona.role}

FELLOW COUNCIL MEMBERS:
${request.otherPersonas.map((persona) => `- ${persona.name} (${persona.role})`).join('\n')}

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
${formattedHistory}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
It's your turn to speak. Address your fellow council members directly, reference specific points from the discussion, and advance the debate toward a resolution.

${currentPersona.name}:`;

  return Either.right({
    model: request.model,
    temperature: request.temperature,
    enhancedSystemPrompt: buildEnhancedSystemPrompt(request),
    chatHistory: buildHistoryForModel(recentMessages, personasById),
    turnPrompt,
  });
};
