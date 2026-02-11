import { getDatabase, ensureDatabaseReady } from './db.js';
import type { Session, Message, Persona, MessageMetadata } from './types.js';

interface ExportableMessage extends Message {
  personaName: string;
  personaRole?: string;
  personaColor?: string;
}

interface SessionExportData {
  session: Session;
  messages: ExportableMessage[];
  participants: Map<string, { name: string; role: string; color: string; order: number }>;
}

// Ensure database is initialized before any query
async function ensureDb(): Promise<void> {
  await ensureDatabaseReady();
}

// Promisify database operations
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

export async function getSessionForExport(sessionId: string): Promise<SessionExportData> {
  // Get session details
  const sessionRow = await getOne<any>(`
    SELECT 
      id,
      title,
      problem_description as problemDescription,
      output_goal as outputGoal,
      status,
      token_count as tokenCount,
      cost_estimate as costEstimate,
      orchestrator_enabled as conductorEnabled,
      orchestrator_persona_id as conductorPersonaId,
      blackboard,
      auto_reply_count as autoReplyCount,
      token_budget as tokenBudget,
      summary,
      created_at as createdAt,
      updated_at as updatedAt
    FROM sessions
    WHERE id = ?
  `, [sessionId]);

  if (!sessionRow) {
    throw new Error('Session not found');
  }

  const session: Session = {
    ...sessionRow,
    conductorEnabled: Boolean(sessionRow.conductorEnabled),
    blackboard: sessionRow.blackboard ? JSON.parse(sessionRow.blackboard) : null,
  };

  // Get all messages with persona info
  const messageRows = await getAll<any>(`
    SELECT 
      m.id,
      m.session_id as sessionId,
      m.persona_id as personaId,
      m.content,
      m.turn_number as turnNumber,
      m.token_count as tokenCount,
      m.metadata,
      m.created_at as createdAt,
      p.name as personaName,
      p.role as personaRole,
      p.color as personaColor
    FROM messages m
    LEFT JOIN personas p ON m.persona_id = p.id
    WHERE m.session_id = ?
    ORDER BY m.turn_number ASC, m.created_at ASC
  `, [sessionId]);

  // Track deleted personas for naming
  let deletedPersonaCounter = 0;
  const deletedPersonaNames = new Map<string, string>();
  const participants = new Map<string, { name: string; role: string; color: string; order: number }>();

  const messages: ExportableMessage[] = messageRows.map((row, index) => {
    const metadata: MessageMetadata | null = row.metadata ? JSON.parse(row.metadata) : null;
    const isConductorMessage = metadata?.isConductorMessage || false;
    
    let personaName: string;
    let personaRole: string | undefined;
    let personaColor: string | undefined;

    if (row.personaId && row.personaName) {
      // Known persona
      personaName = row.personaName;
      personaRole = row.personaRole;
      personaColor = row.personaColor;
      
      if (!participants.has(row.personaId)) {
        participants.set(row.personaId, {
          name: row.personaName,
          role: row.personaRole,
          color: row.personaColor,
          order: participants.size,
        });
      }
    } else if (isConductorMessage) {
      // Conductor message (no persona_id or persona was deleted)
      personaName = 'Conductor';
      personaRole = 'System';
      personaColor = '#8B5CF6';
    } else if (row.personaId && !row.personaName) {
      // Deleted persona
      if (!deletedPersonaNames.has(row.personaId)) {
        deletedPersonaCounter++;
        deletedPersonaNames.set(row.personaId, `Participant ${deletedPersonaCounter}`);
      }
      personaName = deletedPersonaNames.get(row.personaId)!;
      personaRole = 'Unknown';
      personaColor = '#6B7280';
    } else {
      // User message
      personaName = 'User';
      personaRole = 'Human';
      personaColor = '#3B82F6';
    }

    return {
      id: row.id,
      sessionId: row.sessionId,
      personaId: row.personaId,
      content: row.content,
      turnNumber: row.turnNumber,
      tokenCount: row.tokenCount,
      metadata,
      createdAt: row.createdAt,
      personaName,
      personaRole,
      personaColor,
    };
  });

  return {
    session,
    messages,
    participants,
  };
}

export function formatSessionAsMarkdown(data: SessionExportData): string {
  const { session, messages } = data;
  
  // Get participant names in order
  const participantNames = Array.from(data.participants.values())
    .sort((a, b) => a.order - b.order)
    .map(p => p.name);
  
  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toISOString();
  };

  // YAML Frontmatter
  const frontmatter = `---
title: "${session.title.replace(/"/g, '\\"')}"
created_at: "${formatDate(session.createdAt)}"
updated_at: "${formatDate(session.updatedAt)}"
status: ${session.status}
participants: [${participantNames.map(n => `"${n}"`).join(', ')}]${session.summary ? `\nsummary: "${session.summary.replace(/"/g, '\\"')}"` : ''}
total_tokens: ${session.tokenCount}
estimated_cost: ${session.costEstimate.toFixed(4)}
---

`;

  // Session header
  let markdown = frontmatter;
  markdown += `# ${session.title}\n\n`;

  // Problem description
  markdown += `## Problem Description\n\n${session.problemDescription}\n\n`;

  // Output goal
  markdown += `## Output Goal\n\n${session.outputGoal}\n\n`;

  // Session summary (if exists)
  if (session.summary) {
    markdown += `## Session Summary\n\n${session.summary}\n\n`;
  }

  // Blackboard state (if exists)
  if (session.blackboard) {
    markdown += `## Blackboard State\n\n`;
    markdown += `### Consensus\n${session.blackboard.consensus || '*No consensus reached*'}\n\n`;
    markdown += `### Active Conflicts\n${session.blackboard.conflicts || '*No active conflicts*'}\n\n`;
    markdown += `### Next Step\n${session.blackboard.nextStep || '*No next step defined*'}\n\n`;
    markdown += `### Key Facts\n${session.blackboard.facts || '*No facts recorded*'}\n\n`;
  }

  // Conversation
  markdown += `## Conversation\n\n`;

  if (messages.length === 0) {
    markdown += `*No messages in this session*\n\n`;
  } else {
    messages.forEach((message) => {
      const timestamp = new Date(message.createdAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      markdown += `### Turn ${message.turnNumber} - ${message.personaName} (${timestamp})\n\n`;
      
      if (message.personaRole && message.personaRole !== 'User' && message.personaRole !== 'Human') {
        markdown += `**Role:** ${message.personaRole}\n\n`;
      }

      markdown += `${message.content}\n\n`;
      markdown += `---\n\n`;
    });
  }

  // Footer
  markdown += `\n---\n\n`;
  markdown += `*Exported from Council - AI Strategic Summit*\n`;
  markdown += `*Session ID: ${session.id}*\n`;

  return markdown;
}
