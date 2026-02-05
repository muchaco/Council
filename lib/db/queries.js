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
const index_js_1 = require("./index.js");
const uuid_1 = require("uuid");
// Persona operations
function createPersona(data) {
    const db = (0, index_js_1.getDatabase)();
    const id = (0, uuid_1.v4)();
    const now = new Date().toISOString();
    db.run(`INSERT INTO personas (id, name, role, system_prompt, gemini_model, temperature, color, hidden_agenda, created_at, updated_at)
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
function getPersonas() {
    const db = (0, index_js_1.getDatabase)();
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
function getPersona(id) {
    const db = (0, index_js_1.getDatabase)();
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
function updatePersona(id, data) {
    const db = (0, index_js_1.getDatabase)();
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
    db.run(`UPDATE personas SET ${updates.join(', ')} WHERE id = ?`, values);
    const updated = getPersona(id);
    if (!updated) {
        throw new Error('Persona not found after update');
    }
    return updated;
}
function deletePersona(id) {
    const db = (0, index_js_1.getDatabase)();
    db.run('DELETE FROM personas WHERE id = ?', [id]);
}
// Session operations
function createSession(data) {
    const db = (0, index_js_1.getDatabase)();
    const id = (0, uuid_1.v4)();
    const now = new Date().toISOString();
    db.run(`INSERT INTO sessions (id, title, problem_description, output_goal, status, token_count, cost_estimate, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, data.title, data.problemDescription, data.outputGoal, 'active', 0, 0.0, now, now]);
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
function getSessions() {
    const db = (0, index_js_1.getDatabase)();
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
function getSession(id) {
    const db = (0, index_js_1.getDatabase)();
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
function updateSession(id, data) {
    const db = (0, index_js_1.getDatabase)();
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
    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);
    db.run(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`, values);
    const updated = getSession(id);
    if (!updated) {
        throw new Error('Session not found after update');
    }
    return updated;
}
function deleteSession(id) {
    const db = (0, index_js_1.getDatabase)();
    db.run('DELETE FROM sessions WHERE id = ?', [id]);
}
// Message operations
function createMessage(data) {
    const db = (0, index_js_1.getDatabase)();
    const id = (0, uuid_1.v4)();
    const now = new Date().toISOString();
    db.run(`INSERT INTO messages (id, session_id, persona_id, content, turn_number, token_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, data.sessionId, data.personaId, data.content, data.turnNumber, data.tokenCount || 0, now]);
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
function getMessagesBySession(sessionId) {
    const db = (0, index_js_1.getDatabase)();
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
function getLastMessages(sessionId, limit = 10) {
    const db = (0, index_js_1.getDatabase)();
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
function addPersonaToSession(sessionId, personaId, isOrchestrator = false) {
    const db = (0, index_js_1.getDatabase)();
    db.run(`INSERT INTO session_personas (session_id, persona_id, is_orchestrator)
     VALUES (?, ?, ?)
     ON CONFLICT(session_id, persona_id) DO UPDATE SET is_orchestrator = excluded.is_orchestrator`, [sessionId, personaId, isOrchestrator ? 1 : 0]);
}
function getSessionPersonas(sessionId) {
    const db = (0, index_js_1.getDatabase)();
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
function removePersonaFromSession(sessionId, personaId) {
    const db = (0, index_js_1.getDatabase)();
    db.run('DELETE FROM session_personas WHERE session_id = ? AND persona_id = ?', [sessionId, personaId]);
}
// Get next turn number
function getNextTurnNumber(sessionId) {
    const db = (0, index_js_1.getDatabase)();
    const result = db.get(`
    SELECT MAX(turn_number) as maxTurn
    FROM messages
    WHERE session_id = ?
  `, [sessionId]);
    return (result?.maxTurn || 0) + 1;
}
//# sourceMappingURL=queries.js.map