import type { ConductorSelectorPromptInput } from '../../domain/conductor';

const formatConversation = (input: ConductorSelectorPromptInput): string =>
  input.recentConversation
    .map((message) => `${message.personaName}: ${message.content}`)
    .join('\n\n');

const formatAvailablePersonas = (input: ConductorSelectorPromptInput): string =>
  input.availablePersonas.map((persona) => `- ${persona.name} (${persona.role}) - ID: ${persona.id}`).join('\n');

const formatHushedPersonas = (input: ConductorSelectorPromptInput): string => {
  if (input.hushedPersonas.length === 0) {
    return '';
  }

  return `HUSHED PERSONAS (temporarily muted):\n${input.hushedPersonas
    .map((persona) => `- ${persona.name}: ${persona.remainingTurns} turn(s) remaining`)
    .join('\n')}`;
};

const formatLastSpeakerName = (input: ConductorSelectorPromptInput): string => {
  if (input.lastSpeakerId === null) {
    return 'None';
  }

  return (
    input.availablePersonas.find((persona) => persona.id === input.lastSpeakerId)?.name ?? 'Unknown'
  );
};

export const prepareConductorSelectorPrompt = (input: ConductorSelectorPromptInput): string =>
  `You are the Selector Agent for a Council of AI agents discussing a problem. Your job is to analyze the conversation and select the next best speaker.

PROBLEM: ${input.problemDescription}
OUTPUT GOAL: ${input.outputGoal}

CURRENT BLACKBOARD STATE:
- Consensus: ${input.blackboard.consensus || 'None yet'}
- Active Conflicts: ${input.blackboard.conflicts || 'None yet'}
- Next Step: ${input.blackboard.nextStep || 'None defined'}
- Key Facts: ${input.blackboard.facts || 'None yet'}

RECENT CONVERSATION:
${formatConversation(input)}

AVAILABLE PERSONAS:
${formatAvailablePersonas(input)}

${formatHushedPersonas(input)}

IMPORTANT RULES:
- You CANNOT select the persona who spoke last: ${formatLastSpeakerName(input)}
- You CANNOT select hushed personas (they are temporarily muted)
- Each persona should speak only once per cycle - assume they said what they needed to say
- If only the conductor or last speaker remains, select WAIT_FOR_USER

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
