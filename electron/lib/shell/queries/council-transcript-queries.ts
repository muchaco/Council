import type { Message, MessageInput } from '../../types.js';
import {
  executeCreateCouncilTranscriptMessage,
  executeLoadCouncilTranscript,
  executeLoadNextCouncilTurnNumber,
  executeLoadRecentCouncilTranscript,
} from '../../../../lib/application/use-cases';
import { runCouncilTranscriptRead } from './context.js';

export async function createMessage(data: MessageInput): Promise<Message> {
  return runCouncilTranscriptRead(executeCreateCouncilTranscriptMessage(data));
}

export async function getMessagesBySession(sessionId: string): Promise<Message[]> {
  return runCouncilTranscriptRead(executeLoadCouncilTranscript(sessionId));
}

export async function getLastMessages(sessionId: string, limit: number = 10): Promise<Message[]> {
  return runCouncilTranscriptRead(executeLoadRecentCouncilTranscript(sessionId, limit));
}

export async function getNextTurnNumber(sessionId: string): Promise<number> {
  return runCouncilTranscriptRead(executeLoadNextCouncilTurnNumber(sessionId));
}
