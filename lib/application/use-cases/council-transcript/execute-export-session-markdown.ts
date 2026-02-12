import { Effect } from 'effect';

import type { Message, Session } from '../../../types';
import {
  executeLoadSessionParticipants,
  SessionParticipationRepository,
  type SessionParticipantProfile,
  type SessionParticipationInfrastructureError,
} from '../session-participation';
import {
  executeLoadCouncilTranscript,
  CouncilTranscriptRepository,
  type CouncilTranscriptInfrastructureError,
} from './index';
import {
  executeLoadSessionById,
  QueryLayerRepository,
  type QueryLayerInfrastructureError,
} from '../query-layer';

export type ExportSessionMarkdownUseCaseError =
  | SessionParticipationInfrastructureError
  | CouncilTranscriptInfrastructureError
  | QueryLayerInfrastructureError;

export interface ExportSessionMarkdownResult {
  readonly sessionId: string;
  readonly sessionTitle: string;
  readonly markdown: string;
  readonly messageCount: number;
}

const quoteYaml = (value: string): string => value.replace(/"/g, '\\"');

const resolveMessageSpeakerName = (
  message: Message,
  participantsById: ReadonlyMap<string, SessionParticipantProfile>,
  deletedPersonaNames: Map<string, string>
): { readonly name: string; readonly role: string | null } => {
  const isConductor = message.source === 'conductor' || message.metadata?.isConductorMessage === true;
  if (isConductor) {
    return { name: 'Conductor', role: 'System' };
  }

  if (message.personaId === null) {
    return { name: 'User', role: 'Human' };
  }

  const knownParticipant = participantsById.get(message.personaId);
  if (knownParticipant) {
    return { name: knownParticipant.name, role: knownParticipant.role };
  }

  const existingDeletedPersonaName = deletedPersonaNames.get(message.personaId);
  if (existingDeletedPersonaName) {
    return { name: existingDeletedPersonaName, role: 'Unknown' };
  }

  const nextDeletedPersonaName = `Participant ${deletedPersonaNames.size + 1}`;
  deletedPersonaNames.set(message.personaId, nextDeletedPersonaName);
  return { name: nextDeletedPersonaName, role: 'Unknown' };
};

const formatSessionAsMarkdown = (input: {
  readonly session: Session;
  readonly messages: readonly Message[];
  readonly participants: readonly SessionParticipantProfile[];
}): string => {
  const participantsById = new Map(input.participants.map((participant) => [participant.id, participant] as const));
  const deletedPersonaNames = new Map<string, string>();

  const participantNames = input.participants.map((participant) => participant.name);
  const frontmatter = `---\n${[
    `title: "${quoteYaml(input.session.title)}"`,
    `created_at: "${new Date(input.session.createdAt).toISOString()}"`,
    `updated_at: "${new Date(input.session.updatedAt).toISOString()}"`,
    `status: ${input.session.status}`,
    `participants: [${participantNames.map((name) => `"${quoteYaml(name)}"`).join(', ')}]`,
    input.session.summary ? `summary: "${quoteYaml(input.session.summary)}"` : null,
    `total_tokens: ${input.session.tokenCount}`,
    `estimated_cost: ${input.session.costEstimate.toFixed(4)}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n')}\n---\n\n`;

  let markdown = `${frontmatter}# ${input.session.title}\n\n`;
  markdown += `## Problem Description\n\n${input.session.problemDescription}\n\n`;
  markdown += `## Output Goal\n\n${input.session.outputGoal}\n\n`;

  if (input.session.summary) {
    markdown += `## Session Summary\n\n${input.session.summary}\n\n`;
  }

  if (input.session.blackboard) {
    markdown += '## Blackboard State\n\n';
    markdown += `### Consensus\n${input.session.blackboard.consensus || '*No consensus reached*'}\n\n`;
    markdown += `### Active Conflicts\n${input.session.blackboard.conflicts || '*No active conflicts*'}\n\n`;
    markdown += `### Next Step\n${input.session.blackboard.nextStep || '*No next step defined*'}\n\n`;
    markdown += `### Key Facts\n${input.session.blackboard.facts || '*No facts recorded*'}\n\n`;
  }

  markdown += '## Conversation\n\n';
  if (input.messages.length === 0) {
    markdown += '*No messages in this session*\n\n';
  } else {
    for (const message of input.messages) {
      const speaker = resolveMessageSpeakerName(message, participantsById, deletedPersonaNames);
      const timestamp = new Date(message.createdAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      markdown += `### Turn ${message.turnNumber} - ${speaker.name} (${timestamp})\n\n`;
      if (speaker.role && speaker.role !== 'Human') {
        markdown += `**Role:** ${speaker.role}\n\n`;
      }
      markdown += `${message.content}\n\n---\n\n`;
    }
  }

  markdown += '\n---\n\n';
  markdown += '*Exported from Council - AI Strategic Summit*\n';
  markdown += `*Session ID: ${input.session.id}*\n`;
  return markdown;
};

export const executeExportSessionMarkdown = (
  sessionId: string
): Effect.Effect<
  ExportSessionMarkdownResult,
  ExportSessionMarkdownUseCaseError,
  QueryLayerRepository | CouncilTranscriptRepository | SessionParticipationRepository
> =>
  Effect.gen(function* () {
    const session = yield* executeLoadSessionById(sessionId);
    if (session === null) {
      return yield* Effect.fail({
        _tag: 'QueryLayerInfrastructureError',
        source: 'repository',
        message: 'Session not found',
      } as QueryLayerInfrastructureError);
    }

    const messages = yield* executeLoadCouncilTranscript(sessionId);
    const participants = yield* executeLoadSessionParticipants(sessionId);

    return {
      sessionId,
      sessionTitle: session.title,
      markdown: formatSessionAsMarkdown({
        session,
        messages,
        participants,
      }),
      messageCount: messages.length,
    };
  });
