import { z } from 'zod';

import type { Message, Persona, Tag } from '../types';

export interface SessionTransportPersona extends Persona {
  isConductor: boolean;
  hushTurnsRemaining: number;
  hushedAt: string | null;
}

const messageMetadataSchema = z
  .object({
    isIntervention: z.boolean().optional(),
    driftDetected: z.boolean().optional(),
    selectorReasoning: z.string().optional(),
    isConductorMessage: z.boolean().optional(),
  })
  .passthrough()
  .nullable();

const messageSchema: z.ZodType<Message> = z.object({
  id: z.string(),
  sessionId: z.string(),
  personaId: z.string().nullable(),
  source: z.enum(['user', 'persona', 'conductor']).optional().default('user'),
  content: z.string(),
  turnNumber: z.number(),
  tokenCount: z.number(),
  metadata: messageMetadataSchema.optional().default(null),
  createdAt: z.string(),
}) as z.ZodType<Message>;

const sessionPersonaSchema: z.ZodType<SessionTransportPersona> = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  systemPrompt: z.string(),
  geminiModel: z.string(),
  temperature: z.number(),
  color: z.string(),
  hiddenAgenda: z.string().optional(),
  verbosity: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isConductor: z.boolean(),
  hushTurnsRemaining: z.number(),
  hushedAt: z.string().nullable(),
}) as z.ZodType<SessionTransportPersona>;

const tagSchema: z.ZodType<Tag> = z.object({
  id: z.number(),
  name: z.string(),
  createdAt: z.string(),
}) as z.ZodType<Tag>;

export const parseSessionTransportMessages = (value: unknown): Message[] | null => {
  const parsed = z.array(messageSchema).safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const parseSessionTransportParticipants = (value: unknown): SessionTransportPersona[] | null => {
  const parsed = z.array(sessionPersonaSchema).safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const parseSessionTransportTags = (value: unknown): Tag[] | null => {
  const parsed = z.array(tagSchema).safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const parseSessionTransportTagNames = (value: unknown): string[] | null => {
  const parsed = z.array(z.string()).safeParse(value);
  return parsed.success ? parsed.data : null;
};
