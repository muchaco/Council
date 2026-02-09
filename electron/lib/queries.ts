import { getDatabase, ensureDatabaseReady } from './db.js';
import type { Persona, PersonaInput, Session, SessionInput, Message, MessageInput, Tag, TagInput, SessionPersona } from './types.js';

// Ensure database is initialized before any query
async function ensureDb(): Promise<void> {
  await ensureDatabaseReady();
}

// Simple UUID generator
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Promisify database operations
async function runQuery(sql: string, params: unknown[] = []): Promise<void> {
  await ensureDb();
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function getOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  await ensureDb();
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T || null);
    });
  });
}

async function getAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensureDb();
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

// Persona operations
export async function createPersona(data: PersonaInput): Promise<Persona> {
  const id = generateUUID();
  const now = new Date().toISOString();

  await runQuery(
    `INSERT INTO personas (id, name, role, system_prompt, gemini_model, temperature, color, hidden_agenda, verbosity, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.role, data.systemPrompt, data.geminiModel, data.temperature, data.color, data.hiddenAgenda || null, data.verbosity || null, now, now]
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
    verbosity: data.verbosity,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getPersonas(): Promise<Persona[]> {
  return getAll<Persona>(`
    SELECT
      id,
      name,
      role,
      system_prompt as systemPrompt,
      gemini_model as geminiModel,
      temperature,
      color,
      hidden_agenda as hiddenAgenda,
      verbosity,
      created_at as createdAt,
      updated_at as updatedAt
    FROM personas
    ORDER BY created_at DESC
  `);
}

export async function getPersona(id: string): Promise<Persona | null> {
  return getOne<Persona>(`
    SELECT
      id,
      name,
      role,
      system_prompt as systemPrompt,
      gemini_model as geminiModel,
      temperature,
      color,
      hidden_agenda as hiddenAgenda,
      verbosity,
      created_at as createdAt,
      updated_at as updatedAt
    FROM personas
    WHERE id = ?
  `, [id]);
}

export async function updatePersona(id: string, data: Partial<PersonaInput>): Promise<Persona> {
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
  if (data.verbosity !== undefined) {
    updates.push('verbosity = ?');
    values.push(data.verbosity);
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  await runQuery(
    `UPDATE personas SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  const updated = await getPersona(id);
  if (!updated) {
    throw new Error('Persona not found after update');
  }
  return updated;
}

export async function deletePersona(id: string): Promise<void> {
  await runQuery('DELETE FROM personas WHERE id = ?', [id]);
}

// Session operations
export async function createSession(
  data: SessionInput,
  orchestratorConfig?: { enabled: boolean; orchestratorPersonaId?: string }
): Promise<Session> {
  const id = generateUUID();
  const now = new Date().toISOString();
  
  const orchestratorEnabled = orchestratorConfig?.enabled ?? false;
  const orchestratorPersonaId = orchestratorConfig?.orchestratorPersonaId || null;
  
  await runQuery(
    `INSERT INTO sessions (id, title, problem_description, output_goal, status, token_count, cost_estimate, orchestrator_enabled, orchestrator_persona_id, blackboard, auto_reply_count, token_budget, summary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.title, data.problemDescription, data.outputGoal, 'active', 0, 0.0, orchestratorEnabled ? 1 : 0, orchestratorPersonaId, null, 0, 100000, null, now, now]
  );
  
  return {
    id,
    title: data.title,
    problemDescription: data.problemDescription,
    outputGoal: data.outputGoal,
    status: 'active',
    tokenCount: 0,
    costEstimate: 0.0,
    orchestratorEnabled,
    orchestratorPersonaId,
    blackboard: null,
    autoReplyCount: 0,
    tokenBudget: 100000,
    summary: null,
    archivedAt: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function getSessions(): Promise<Session[]> {
  const rows = await getAll<any>(`
    SELECT 
      id,
      title,
      problem_description as problemDescription,
      output_goal as outputGoal,
      status,
      token_count as tokenCount,
      cost_estimate as costEstimate,
      orchestrator_enabled as orchestratorEnabled,
      orchestrator_persona_id as orchestratorPersonaId,
      blackboard,
      auto_reply_count as autoReplyCount,
      token_budget as tokenBudget,
      summary,
      archived_at as archivedAt,
      created_at as createdAt,
      updated_at as updatedAt
    FROM sessions
    ORDER BY updated_at DESC
  `);

  // Fetch tags for all sessions
  const sessionIds = rows.map(row => row.id);
  const tagsMap = new Map<string, string[]>();

  if (sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => '?').join(',');
    const tagRows = await getAll<{ session_id: string; name: string }>(`
      SELECT st.session_id, t.name
      FROM session_tags st
      JOIN tags t ON st.tag_id = t.id
      WHERE st.session_id IN (${placeholders})
      ORDER BY st.created_at ASC
    `, sessionIds);

    for (const row of tagRows) {
      if (!tagsMap.has(row.session_id)) {
        tagsMap.set(row.session_id, []);
      }
      tagsMap.get(row.session_id)!.push(row.name);
    }
  }

  return rows.map(row => ({
    ...row,
    orchestratorEnabled: Boolean(row.orchestratorEnabled),
    blackboard: row.blackboard ? JSON.parse(row.blackboard) : null,
    archivedAt: row.archivedAt || null,
    tags: tagsMap.get(row.id) || [],
  }));
}

export async function getSession(id: string): Promise<Session | null> {
  const row = await getOne<any>(`
    SELECT 
      id,
      title,
      problem_description as problemDescription,
      output_goal as outputGoal,
      status,
      token_count as tokenCount,
      cost_estimate as costEstimate,
      orchestrator_enabled as orchestratorEnabled,
      orchestrator_persona_id as orchestratorPersonaId,
      blackboard,
      auto_reply_count as autoReplyCount,
      token_budget as tokenBudget,
      summary,
      archived_at as archivedAt,
      created_at as createdAt,
      updated_at as updatedAt
    FROM sessions
    WHERE id = ?
  `, [id]);

  if (!row) return null;

  // Fetch tags for this session
  const tags = await getTagsBySession(id);

  return {
    ...row,
    orchestratorEnabled: Boolean(row.orchestratorEnabled),
    blackboard: row.blackboard ? JSON.parse(row.blackboard) : null,
    archivedAt: row.archivedAt || null,
    tags,
  };
}

export async function updateSession(
  id: string, 
  data: Partial<SessionInput> & { 
    status?: string; 
    tokenCount?: number; 
    costEstimate?: number;
    orchestratorEnabled?: boolean;
    orchestratorPersonaId?: string | null;
    blackboard?: any;
    autoReplyCount?: number;
    tokenBudget?: number;
    summary?: string | null;
  }
): Promise<Session> {
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
  if (data.orchestratorEnabled !== undefined) {
    updates.push('orchestrator_enabled = ?');
    values.push(data.orchestratorEnabled ? 1 : 0);
  }
  if (data.orchestratorPersonaId !== undefined) {
    updates.push('orchestrator_persona_id = ?');
    values.push(data.orchestratorPersonaId);
  }
  if (data.blackboard !== undefined) {
    updates.push('blackboard = ?');
    values.push(JSON.stringify(data.blackboard));
  }
  if (data.autoReplyCount !== undefined) {
    updates.push('auto_reply_count = ?');
    values.push(data.autoReplyCount);
  }
  if (data.tokenBudget !== undefined) {
    updates.push('token_budget = ?');
    values.push(data.tokenBudget);
  }
  if (data.summary !== undefined) {
    updates.push('summary = ?');
    values.push(data.summary);
  }
  
  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  await runQuery(
    `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  const updated = await getSession(id);
  if (!updated) {
    throw new Error('Session not found after update');
  }
  return updated;
}

export async function deleteSession(id: string): Promise<void> {
  await runQuery('DELETE FROM sessions WHERE id = ?', [id]);
}

// Message operations
export async function createMessage(data: MessageInput): Promise<Message> {
  const id = generateUUID();
  const now = new Date().toISOString();
  const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;
  
  await runQuery(
    `INSERT INTO messages (id, session_id, persona_id, content, turn_number, token_count, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.sessionId, data.personaId, data.content, data.turnNumber, data.tokenCount || 0, metadataJson, now]
  );
  
  return {
    id,
    sessionId: data.sessionId,
    personaId: data.personaId,
    content: data.content,
    turnNumber: data.turnNumber,
    tokenCount: data.tokenCount || 0,
    metadata: data.metadata || null,
    createdAt: now,
  };
}

export async function getMessagesBySession(sessionId: string): Promise<Message[]> {
  const rows = await getAll<any>(`
    SELECT 
      id,
      session_id as sessionId,
      persona_id as personaId,
      content,
      turn_number as turnNumber,
      token_count as tokenCount,
      metadata,
      created_at as createdAt
    FROM messages
    WHERE session_id = ?
    ORDER BY turn_number ASC, created_at ASC
  `, [sessionId]);
  
  return rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }));
}

export async function getLastMessages(sessionId: string, limit: number = 10): Promise<Message[]> {
  const rows = await getAll<any>(`
    SELECT 
      id,
      session_id as sessionId,
      persona_id as personaId,
      content,
      turn_number as turnNumber,
      token_count as tokenCount,
      metadata,
      created_at as createdAt
    FROM messages
    WHERE session_id = ?
    ORDER BY turn_number DESC, created_at DESC
    LIMIT ?
  `, [sessionId, limit]);
  
  const messages = rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }));
  
  return messages.reverse();
}

// Session Persona operations
export async function addPersonaToSession(sessionId: string, personaId: string, isOrchestrator: boolean = false): Promise<void> {
  await runQuery(
    `INSERT INTO session_personas (session_id, persona_id, is_orchestrator)
     VALUES (?, ?, ?)
     ON CONFLICT(session_id, persona_id) DO UPDATE SET is_orchestrator = excluded.is_orchestrator`,
    [sessionId, personaId, isOrchestrator ? 1 : 0]
  );
}

export async function getSessionPersonas(sessionId: string): Promise<SessionPersona[]> {
  const rows = await getAll<any>(`
    SELECT
      p.id,
      p.name,
      p.role,
      p.system_prompt as systemPrompt,
      p.gemini_model as geminiModel,
      p.temperature,
      p.color,
      p.hidden_agenda as hiddenAgenda,
      p.verbosity,
      p.created_at as createdAt,
      p.updated_at as updatedAt,
      sp.is_orchestrator as isOrchestrator,
      sp.hush_turns_remaining as hushTurnsRemaining,
      sp.hushed_at as hushedAt
    FROM personas p
    JOIN session_personas sp ON p.id = sp.persona_id
    WHERE sp.session_id = ?
    ORDER BY p.name
  `, [sessionId]);

  return rows.map(row => ({
    ...row,
    isOrchestrator: Boolean(row.isOrchestrator),
    hushTurnsRemaining: row.hushTurnsRemaining || 0,
    hushedAt: row.hushedAt || null,
  }));
}

// Hush operations - "The Hush Button" feature
export async function setPersonaHush(sessionId: string, personaId: string, turns: number): Promise<void> {
  const now = new Date().toISOString();
  await runQuery(
    `UPDATE session_personas 
     SET hush_turns_remaining = ?, hushed_at = ? 
     WHERE session_id = ? AND persona_id = ?`,
    [turns, now, sessionId, personaId]
  );
}

export async function decrementPersonaHush(sessionId: string, personaId: string): Promise<number> {
  await runQuery(
    `UPDATE session_personas 
     SET hush_turns_remaining = MAX(0, hush_turns_remaining - 1) 
     WHERE session_id = ? AND persona_id = ? AND hush_turns_remaining > 0`,
    [sessionId, personaId]
  );
  
  const row = await getOne<{ hushTurnsRemaining: number }>(`
    SELECT hush_turns_remaining as hushTurnsRemaining 
    FROM session_personas 
    WHERE session_id = ? AND persona_id = ?
  `, [sessionId, personaId]);
  
  return row?.hushTurnsRemaining || 0;
}

export async function clearPersonaHush(sessionId: string, personaId: string): Promise<void> {
  await runQuery(
    `UPDATE session_personas 
     SET hush_turns_remaining = 0, hushed_at = NULL 
     WHERE session_id = ? AND persona_id = ?`,
    [sessionId, personaId]
  );
}

export async function decrementAllHushTurns(sessionId: string): Promise<void> {
  await runQuery(
    `UPDATE session_personas 
     SET hush_turns_remaining = MAX(0, hush_turns_remaining - 1) 
     WHERE session_id = ? AND hush_turns_remaining > 0`,
    [sessionId]
  );
}

export async function getHushedPersonas(sessionId: string): Promise<string[]> {
  const rows = await getAll<{ persona_id: string }>(`
    SELECT persona_id 
    FROM session_personas 
    WHERE session_id = ? AND hush_turns_remaining > 0
  `, [sessionId]);
  
  return rows.map(row => row.persona_id);
}

export async function removePersonaFromSession(sessionId: string, personaId: string): Promise<void> {
  await runQuery('DELETE FROM session_personas WHERE session_id = ? AND persona_id = ?', [sessionId, personaId]);
}

// Get next turn number
export async function getNextTurnNumber(sessionId: string): Promise<number> {
  const result = await getOne<{ maxTurn: number }>(`
    SELECT MAX(turn_number) as maxTurn
    FROM messages
    WHERE session_id = ?
  `, [sessionId]);
  
  return (result?.maxTurn || 0) + 1;
}

// Orchestrator operations
export async function updateBlackboard(sessionId: string, blackboard: any): Promise<void> {
  const blackboardJson = JSON.stringify(blackboard);
  await runQuery(
    'UPDATE sessions SET blackboard = ? WHERE id = ?',
    [blackboardJson, sessionId]
  );
}

export async function updateSessionSummary(sessionId: string, summary: string): Promise<void> {
  await runQuery(
    'UPDATE sessions SET summary = ? WHERE id = ?',
    [summary, sessionId]
  );
}

export async function incrementAutoReplyCount(sessionId: string): Promise<number> {
  await runQuery(
    'UPDATE sessions SET auto_reply_count = auto_reply_count + 1 WHERE id = ?',
    [sessionId]
  );
  
  const session = await getSession(sessionId);
  return session?.autoReplyCount || 0;
}

export async function resetAutoReplyCount(sessionId: string): Promise<void> {
  await runQuery(
    'UPDATE sessions SET auto_reply_count = 0 WHERE id = ?',
    [sessionId]
  );
}

export async function enableOrchestrator(sessionId: string, orchestratorPersonaId: string): Promise<void> {
  await runQuery(
    'UPDATE sessions SET orchestrator_enabled = 1, orchestrator_persona_id = ? WHERE id = ?',
    [orchestratorPersonaId, sessionId]
  );
}

export async function disableOrchestrator(sessionId: string): Promise<void> {
  await runQuery(
    'UPDATE sessions SET orchestrator_enabled = 0, orchestrator_persona_id = NULL WHERE id = ?',
    [sessionId]
  );
}

// Session archiving
export async function archiveSession(sessionId: string): Promise<void> {
  const now = new Date().toISOString();
  await runQuery(
    'UPDATE sessions SET archived_at = ?, status = ? WHERE id = ?',
    [now, 'archived', sessionId]
  );
}

export async function unarchiveSession(sessionId: string): Promise<void> {
  await runQuery(
    'UPDATE sessions SET archived_at = NULL, status = ? WHERE id = ?',
    ['active', sessionId]
  );
}

export async function isSessionArchived(sessionId: string): Promise<boolean> {
  const session = await getOne<{ archivedAt: string | null }>(
    'SELECT archived_at as archivedAt FROM sessions WHERE id = ?',
    [sessionId]
  );
  return session?.archivedAt !== null && session?.archivedAt !== undefined;
}

// Tag operations
export async function createTag(data: TagInput): Promise<Tag> {
  const now = new Date().toISOString();

  await runQuery(
    `INSERT INTO tags (name, created_at) VALUES (?, ?)`,
    [data.name, now]
  );

  const tag = await getOne<Tag>(
    `SELECT id, name, created_at as createdAt FROM tags WHERE name = ?`,
    [data.name]
  );

  if (!tag) {
    throw new Error('Tag not found after creation');
  }

  return tag;
}

export async function getTagByName(name: string): Promise<Tag | null> {
  return getOne<Tag>(
    `SELECT id, name, created_at as createdAt FROM tags WHERE name = ?`,
    [name]
  );
}

export async function getAllTags(): Promise<Tag[]> {
  // Only return tags that have at least one session association
  // This prevents orphaned tags from appearing in autocomplete
  return getAll<Tag>(
    `SELECT t.id, t.name, t.created_at as createdAt 
     FROM tags t
     INNER JOIN session_tags st ON t.id = st.tag_id
     GROUP BY t.id, t.name, t.created_at
     ORDER BY t.name ASC`
  );
}

export async function deleteTag(id: number): Promise<void> {
  await runQuery('DELETE FROM tags WHERE id = ?', [id]);
}

// Session-Tag operations
export async function addTagToSession(sessionId: string, tagId: number): Promise<void> {
  await runQuery(
    `INSERT INTO session_tags (session_id, tag_id) VALUES (?, ?)
     ON CONFLICT(session_id, tag_id) DO NOTHING`,
    [sessionId, tagId]
  );
}

export async function removeTagFromSession(sessionId: string, tagId: number): Promise<void> {
  await runQuery(
    'DELETE FROM session_tags WHERE session_id = ? AND tag_id = ?',
    [sessionId, tagId]
  );
}

export async function getTagsBySession(sessionId: string): Promise<string[]> {
  const rows = await getAll<{ name: string }>(
    `SELECT t.name
     FROM tags t
     JOIN session_tags st ON t.id = st.tag_id
     WHERE st.session_id = ?
     ORDER BY st.created_at ASC`,
    [sessionId]
  );

  return rows.map(row => row.name);
}

export async function cleanupOrphanedTags(): Promise<number> {
  const result = await runQuery(
    `DELETE FROM tags 
     WHERE id NOT IN (SELECT DISTINCT tag_id FROM session_tags)`
  );
  // Return number of deleted rows (this is a rough approximation)
  return 0;
}
