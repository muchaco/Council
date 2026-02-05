import sqlite3 from 'sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

let db: sqlite3.Database | null = null;
let initPromise: Promise<void> | null = null;

export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'data');
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  return path.join(dbDir, 'council.db');
}

export async function initializeDatabase(): Promise<sqlite3.Database> {
  if (db && initPromise) {
    await initPromise;
    return db;
  }
  
  const dbPath = getDatabasePath();
  
  initPromise = new Promise<void>((resolve, reject) => {
    db = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      
      console.log('Database opened at:', dbPath);
      
      // Enable foreign keys
      db!.run('PRAGMA foreign_keys = ON', async (pragmaErr) => {
        if (pragmaErr) {
          reject(pragmaErr);
          return;
        }
        
        try {
          await initializeSchema();
          resolve();
        } catch (schemaErr) {
          reject(schemaErr);
        }
      });
    });
  });
  
  await initPromise;
  return db!;
}

export function getDatabase(): sqlite3.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database closed');
      }
    });
    db = null;
  }
}

async function initializeSchema(): Promise<void> {
  const database = getDatabase();
  
  // Helper to promisify db.run
  const run = (sql: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      database.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };
  
  // Create tables sequentially to ensure proper order
  await run(`
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      gemini_model TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
      temperature REAL NOT NULL DEFAULT 0.7,
      color TEXT NOT NULL,
      hidden_agenda TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      problem_description TEXT NOT NULL,
      output_goal TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      token_count INTEGER DEFAULT 0,
      cost_estimate REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await run(`
    CREATE TABLE IF NOT EXISTS session_personas (
      session_id TEXT NOT NULL,
      persona_id TEXT NOT NULL,
      is_orchestrator BOOLEAN DEFAULT 0,
      PRIMARY KEY (session_id, persona_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
    )
  `);
  
  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      persona_id TEXT,
      content TEXT NOT NULL,
      turn_number INTEGER NOT NULL,
      token_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE SET NULL
    )
  `);
  
  await run(`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`);
  
  console.log('Database schema initialized successfully');
}
