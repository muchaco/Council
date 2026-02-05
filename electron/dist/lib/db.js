"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabasePath = getDatabasePath;
exports.initializeDatabase = initializeDatabase;
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let db = null;
let initPromise = null;
function getDatabasePath() {
    const userDataPath = electron_1.app.getPath('userData');
    const dbDir = path_1.default.join(userDataPath, 'data');
    if (!fs_1.default.existsSync(dbDir)) {
        fs_1.default.mkdirSync(dbDir, { recursive: true });
    }
    return path_1.default.join(dbDir, 'council.db');
}
async function initializeDatabase() {
    if (db && initPromise) {
        await initPromise;
        return db;
    }
    const dbPath = getDatabasePath();
    initPromise = new Promise((resolve, reject) => {
        db = new sqlite3_1.default.Database(dbPath, async (err) => {
            if (err) {
                console.error('Error opening database:', err);
                reject(err);
                return;
            }
            console.log('Database opened at:', dbPath);
            // Enable foreign keys
            db.run('PRAGMA foreign_keys = ON', async (pragmaErr) => {
                if (pragmaErr) {
                    reject(pragmaErr);
                    return;
                }
                try {
                    await initializeSchema();
                    resolve();
                }
                catch (schemaErr) {
                    reject(schemaErr);
                }
            });
        });
    });
    await initPromise;
    return db;
}
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return db;
}
function closeDatabase() {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            }
            else {
                console.log('Database closed');
            }
        });
        db = null;
    }
}
async function initializeSchema() {
    const database = getDatabase();
    // Helper to promisify db.run
    const run = (sql) => {
        return new Promise((resolve, reject) => {
            database.run(sql, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
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
//# sourceMappingURL=db.js.map