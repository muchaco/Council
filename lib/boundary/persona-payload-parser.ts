import { z } from 'zod';

import type { Persona } from '../types';

const personaSchema: z.ZodType<Persona> = z.object({
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
}) as z.ZodType<Persona>;

export const parsePersonaPayload = (value: unknown): Persona | null => {
  const parsed = personaSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const parsePersonaPayloadList = (value: unknown): Persona[] | null => {
  const parsed = z.array(personaSchema).safeParse(value);
  return parsed.success ? parsed.data : null;
};
