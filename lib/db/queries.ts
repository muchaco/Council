import { getDatabase } from './index.js';
import type { 
  Persona, 
  PersonaInput, 
  Session, 
  SessionInput, 
  Message, 
  MessageInput,
  SessionPersona 
} from '../types.js';
import { v4 as uuidv4 } from 'uuid';

// Persona operations
export function createPersona(data: PersonaInput): Persona {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.run(
    `INSERT INTO personas (id, name, role, system_prompt, gemini_model, temperature, color, hidden_agenda, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.role, data.systemPrompt, data.geminiModel, data.temperature, data.color, data.hiddenAgenda || null, now, now]
  );
  
  return {
    id,
    name: data.name,
    role: data.role,
    systemPrompt: data.systemPrompt,
    geminiModel: data.geminiModel,
    temperature: data.temperature,
    color: data.color,
    hiddenAgenda: data.hiddenAgenda,
    createdAt: now,
    updatedAt: now,
  };
}

export function getPersonas(): Persona[] {
  const db = getDatabase();
  
  return db.all(`
    SELECT 
      id,
      name,
      role,
      system_prompt as systemPrompt,
      gemini_model as geminiModel,
      temperature,
      color,
      hidden_agenda as hiddenAgenda,
      created_at as createdAt,
      updated_at as updatedAt
    FROM personas
    ORDER BY created_at DESC
  `);
}

export function getPersona(id: string): Persona | null {
  const db = getDatabase();
  
  return db.get(`
    SELECT 
      id,
      name,
      role,
      system_prompt as systemPrompt,
      gemini_model as geminiModel,
      temperature,
      color,
      hidden_agenda as hiddenAgenda,
      created_at as createdAt,
      updated_at as updatedAt
    FROM personas
    WHERE id = ?
  `, [id]) || null;
}

export function updatePersona(id: string, data: Partial<PersonaInput>): Persona {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  
  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.role !== undefined) {
    updates.push('role = ?');
    values.push(data.role);
  }
  if (data.systemPrompt !== undefined) {
    updates.push('system_prompt = ?');
    values.push(data.systemPrompt);
  }
  if (data.geminiModel !== undefined) {
    updates.push('gemini_model = ?');
    values.push(data.geminiModel);
  }
  if (data.temperature !== undefined) {
    updates.push('temperature = ?');
    values.push(data.temperature);
  }
  if (data.color !== undefined) {
    updates.push('color = ?');
    values.push(data.color);
  }
  if (data.hiddenAgenda !== undefined) {
    updates.push('hidden_agenda = ?');
    values.push(data.hiddenAgenda);
  }
  
  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  db.run(
    `UPDATE personas SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  const updated = getPersona(id);
  if (!updated) {
    throw new Error('Persona not found after update');
  }
  return updated;
}

export function deletePersona(id: string): void {
  const db = getDatabase();
  db.run('DELETE FROM personas WHERE id = ?', [id]);
}

// Session operations
export function createSession(data: SessionInput): Session {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.run(
    `INSERT INTO sessions (id, title, problem_description, output_goal, status, token_count, cost_estimate, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.title, data.problemDescription, data.outputGoal, 'active', 0, 0.0, now, now]
  );
  
  return {
    id,
    title: data.title,
    problemDescription: data.problemDescription,
    outputGoal: data.outputGoal,
    status: 'active',
    tokenCount: 0,
    costEstimate: 0.0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getSessions(): Session[] {
  const db = getDatabase();
  
  return db.all(`
    SELECT 
      id,
      title,
      problem_description as problemDescription,
      output_goal as outputGoal,
      status,
      token_count as tokenCount,
      cost_estimate as costEstimate,
      created_at as createdAt,
      updated_at as updatedAt
    FROM sessions
    ORDER BY updated_at DESC
  `);
}

export function getSession(id: string): Session | null {
  const db = getDatabase();
  
  return db.get(`
    SELECT 
      id,
      title,
      problem_description as problemDescription,
      output_goal as outputGoal,
      status,
      token_count as tokenCount,
      cost_estimate as costEstimate,
      created_at as createdAt,
      updated_at as updatedAt
    FROM sessions
    WHERE id = ?
  `, [id]) || null;
}

export function updateSession(id: string, data: Partial<SessionInput> & { status?: string; tokenCount?: number; costEstimate?: number }): Session {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  
  if (data.title !== undefined) {
    updates.push('title = ?');
    values.push(data.title);
  }
  if (data.problemDescription !== undefined) {
    updates.push('problem_description = ?');
    values.push(data.problemDescription);
  }
  if (data.outputGoal !== undefined) {
    updates.push('output_goal = ?');
    values.push(data.outputGoal);
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    values.push(data.status);
  }
  if (data.tokenCount !== undefined) {
    updates.push('token_count = ?');
    values.push(data.tokenCount);
  }
  if (data.costEstimate !== undefined) {
    updates.push('cost_estimate = ?');
    values.push(data.costEstimate);
  }
  
  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  db.run(
    `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  const updated = getSession(id);
  if (!updated) {
    throw new Error('Session not found after update');
  }
  return updated;
}

export function deleteSession(id: string): void {
  const db = getDatabase();
  db.run('DELETE FROM sessions WHERE id = ?', [id]);
}

// Message operations
export function createMessage(data: MessageInput): Message {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.run(
    `INSERT INTO messages (id, session_id, persona_id, content, turn_number, token_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.sessionId, data.personaId, data.content, data.turnNumber, data.tokenCount || 0, now]
  );
  
  return {
    id,
    sessionId: data.sessionId,
    personaId: data.personaId,
    content: data.content,
    turnNumber: data.turnNumber,
    tokenCount: data.tokenCount || 0,
    createdAt: now,
  };
}

export function getMessagesBySession(sessionId: string): Message[] {
  const db = getDatabase();
  
  return db.all(`
    SELECT 
      id,
      session_id as sessionId,
      persona_id as personaId,
      content,
      turn_number as turnNumber,
      token_count as tokenCount,
      created_at as createdAt
    FROM messages
    WHERE session_id = ?
    ORDER BY turn_number ASC, created_at ASC
  `, [sessionId]);
}

export function getLastMessages(sessionId: string, limit: number = 10): Message[] {
  const db = getDatabase();
  
  return db.all(`
    SELECT 
      id,
      session_id as sessionId,
      persona_id as personaId,
      content,
      turn_number as turnNumber,
      token_count as tokenCount,
      created_at as createdAt
    FROM messages
    WHERE session_id = ?
    ORDER BY turn_number DESC, created_at DESC
    LIMIT ?
  `, [sessionId, limit]).reverse();
}

// Session Persona operations
export function addPersonaToSession(sessionId: string, personaId: string, isOrchestrator: boolean = false): void {
  const db = getDatabase();
  
  db.run(
    `INSERT INTO session_personas (session_id, persona_id, is_orchestrator)
     VALUES (?, ?, ?)
     ON CONFLICT(session_id, persona_id) DO UPDATE SET is_orchestrator = excluded.is_orchestrator`,
    [sessionId, personaId, isOrchestrator ? 1 : 0]
  );
}

export function getSessionPersonas(sessionId: string): (Persona & { isOrchestrator: boolean })[] {
  const db = getDatabase();
  
  return db.all(`
    SELECT 
      p.id,
      p.name,
      p.role,
      p.system_prompt as systemPrompt,
      p.gemini_model as geminiModel,
      p.temperature,
      p.color,
      p.hidden_agenda as hiddenAgenda,
      p.created_at as createdAt,
      p.updated_at as updatedAt,
      sp.is_orchestrator as isOrchestrator
    FROM personas p
    JOIN session_personas sp ON p.id = sp.persona_id
    WHERE sp.session_id = ?
    ORDER BY p.name
  `, [sessionId]);
}

export function removePersonaFromSession(sessionId: string, personaId: string): void {
  const db = getDatabase();
  db.run('DELETE FROM session_personas WHERE session_id = ? AND persona_id = ?', [sessionId, personaId]);
}

// Get next turn number
export function getNextTurnNumber(sessionId: string): number {
  const db = getDatabase();
  const result = db.get(`
    SELECT MAX(turn_number) as maxTurn
    FROM messages
    WHERE session_id = ?
  `, [sessionId]) as { maxTurn: number } | undefined;
  
  return (result?.maxTurn || 0) + 1;
}
