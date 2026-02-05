"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPersona = createPersona;
exports.getPersonas = getPersonas;
exports.getPersona = getPersona;
exports.updatePersona = updatePersona;
exports.deletePersona = deletePersona;
exports.createSession = createSession;
exports.getSessions = getSessions;
exports.getSession = getSession;
exports.updateSession = updateSession;
exports.deleteSession = deleteSession;
exports.createMessage = createMessage;
exports.getMessagesBySession = getMessagesBySession;
exports.getLastMessages = getLastMessages;
exports.addPersonaToSession = addPersonaToSession;
exports.getSessionPersonas = getSessionPersonas;
exports.removePersonaFromSession = removePersonaFromSession;
exports.getNextTurnNumber = getNextTurnNumber;
exports.updateBlackboard = updateBlackboard;
exports.updateSessionSummary = updateSessionSummary;
exports.incrementAutoReplyCount = incrementAutoReplyCount;
exports.resetAutoReplyCount = resetAutoReplyCount;
exports.enableOrchestrator = enableOrchestrator;
exports.disableOrchestrator = disableOrchestrator;
const db_js_1 = require("./db.js");
// Ensure database is initialized before any query
async function ensureDb() {
    await (0, db_js_1.ensureDatabaseReady)();
}
// Simple UUID generator
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
// Promisify database operations
async function runQuery(sql, params = []) {
    await ensureDb();
    const db = (0, db_js_1.getDatabase)();
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
}
async function getOne(sql, params = []) {
    await ensureDb();
    const db = (0, db_js_1.getDatabase)();
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row || null);
        });
    });
}
async function getAll(sql, params = []) {
    await ensureDb();
    const db = (0, db_js_1.getDatabase)();
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
}
// Persona operations
async function createPersona(data) {
    const id = generateUUID();
    const now = new Date().toISOString();
    await runQuery(`INSERT INTO personas (id, name, role, system_prompt, gemini_model, temperature, color, hidden_agenda, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, data.name, data.role, data.systemPrompt, data.geminiModel, data.temperature, data.color, data.hiddenAgenda || null, now, now]);
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
async function getPersonas() {
    return getAll(`
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
async function getPersona(id) {
    return getOne(`
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
  `, [id]);
}
async function updatePersona(id, data) {
    const now = new Date().toISOString();
    const updates = [];
    const values = [];
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
    await runQuery(`UPDATE personas SET ${updates.join(', ')} WHERE id = ?`, values);
    const updated = await getPersona(id);
    if (!updated) {
        throw new Error('Persona not found after update');
    }
    return updated;
}
async function deletePersona(id) {
    await runQuery('DELETE FROM personas WHERE id = ?', [id]);
}
// Session operations
async function createSession(data, orchestratorConfig) {
    const id = generateUUID();
    const now = new Date().toISOString();
    const orchestratorEnabled = orchestratorConfig?.enabled ?? false;
    const orchestratorPersonaId = orchestratorConfig?.orchestratorPersonaId || null;
    await runQuery(`INSERT INTO sessions (id, title, problem_description, output_goal, status, token_count, cost_estimate, orchestrator_enabled, orchestrator_persona_id, blackboard, auto_reply_count, token_budget, summary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, data.title, data.problemDescription, data.outputGoal, 'active', 0, 0.0, orchestratorEnabled ? 1 : 0, orchestratorPersonaId, null, 0, 100000, null, now, now]);
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
        createdAt: now,
        updatedAt: now,
    };
}
async function getSessions() {
    const rows = await getAll(`
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
      created_at as createdAt,
      updated_at as updatedAt
    FROM sessions
    ORDER BY updated_at DESC
  `);
    return rows.map(row => ({
        ...row,
        orchestratorEnabled: Boolean(row.orchestratorEnabled),
        blackboard: row.blackboard ? JSON.parse(row.blackboard) : null,
    }));
}
async function getSession(id) {
    const row = await getOne(`
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
      created_at as createdAt,
      updated_at as updatedAt
    FROM sessions
    WHERE id = ?
  `, [id]);
    if (!row)
        return null;
    return {
        ...row,
        orchestratorEnabled: Boolean(row.orchestratorEnabled),
        blackboard: row.blackboard ? JSON.parse(row.blackboard) : null,
    };
}
async function updateSession(id, data) {
    const now = new Date().toISOString();
    const updates = [];
    const values = [];
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
    await runQuery(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`, values);
    const updated = await getSession(id);
    if (!updated) {
        throw new Error('Session not found after update');
    }
    return updated;
}
async function deleteSession(id) {
    await runQuery('DELETE FROM sessions WHERE id = ?', [id]);
}
// Message operations
async function createMessage(data) {
    const id = generateUUID();
    const now = new Date().toISOString();
    const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;
    await runQuery(`INSERT INTO messages (id, session_id, persona_id, content, turn_number, token_count, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, data.sessionId, data.personaId, data.content, data.turnNumber, data.tokenCount || 0, metadataJson, now]);
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
async function getMessagesBySession(sessionId) {
    const rows = await getAll(`
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
async function getLastMessages(sessionId, limit = 10) {
    const rows = await getAll(`
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
async function addPersonaToSession(sessionId, personaId, isOrchestrator = false) {
    await runQuery(`INSERT INTO session_personas (session_id, persona_id, is_orchestrator)
     VALUES (?, ?, ?)
     ON CONFLICT(session_id, persona_id) DO UPDATE SET is_orchestrator = excluded.is_orchestrator`, [sessionId, personaId, isOrchestrator ? 1 : 0]);
}
async function getSessionPersonas(sessionId) {
    return getAll(`
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
async function removePersonaFromSession(sessionId, personaId) {
    await runQuery('DELETE FROM session_personas WHERE session_id = ? AND persona_id = ?', [sessionId, personaId]);
}
// Get next turn number
async function getNextTurnNumber(sessionId) {
    const result = await getOne(`
    SELECT MAX(turn_number) as maxTurn
    FROM messages
    WHERE session_id = ?
  `, [sessionId]);
    return (result?.maxTurn || 0) + 1;
}
// Orchestrator operations
async function updateBlackboard(sessionId, blackboard) {
    const blackboardJson = JSON.stringify(blackboard);
    await runQuery('UPDATE sessions SET blackboard = ? WHERE id = ?', [blackboardJson, sessionId]);
}
async function updateSessionSummary(sessionId, summary) {
    await runQuery('UPDATE sessions SET summary = ? WHERE id = ?', [summary, sessionId]);
}
async function incrementAutoReplyCount(sessionId) {
    await runQuery('UPDATE sessions SET auto_reply_count = auto_reply_count + 1 WHERE id = ?', [sessionId]);
    const session = await getSession(sessionId);
    return session?.autoReplyCount || 0;
}
async function resetAutoReplyCount(sessionId) {
    await runQuery('UPDATE sessions SET auto_reply_count = 0 WHERE id = ?', [sessionId]);
}
async function enableOrchestrator(sessionId, orchestratorPersonaId) {
    await runQuery('UPDATE sessions SET orchestrator_enabled = 1, orchestrator_persona_id = ? WHERE id = ?', [orchestratorPersonaId, sessionId]);
}
async function disableOrchestrator(sessionId) {
    await runQuery('UPDATE sessions SET orchestrator_enabled = 0, orchestrator_persona_id = NULL WHERE id = ?', [sessionId]);
}
//# sourceMappingURL=queries.js.map