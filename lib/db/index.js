"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabasePath = getDatabasePath;
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let db = null;
function getDatabasePath() {
    const userDataPath = electron_1.app.getPath('userData');
    const dbDir = path_1.default.join(userDataPath, 'data');
    if (!fs_1.default.existsSync(dbDir)) {
        fs_1.default.mkdirSync(dbDir, { recursive: true });
    }
    return path_1.default.join(dbDir, 'council.db');
}
function getDatabase() {
    if (!db) {
        const dbPath = getDatabasePath();
        db = new sqlite3_1.default.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            }
            else {
                console.log('Database opened at:', dbPath);
            }
        });
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');
        // Initialize schema
        initializeSchema();
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
function initializeSchema() {
    const database = getDatabase();
    // Personas table
    database.run(`
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
    // Sessions table
    database.run(`
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
    // Session personas junction table
    database.run(`
    CREATE TABLE IF NOT EXISTS session_personas (
      session_id TEXT NOT NULL,
      persona_id TEXT NOT NULL,
      is_orchestrator BOOLEAN DEFAULT 0,
      PRIMARY KEY (session_id, persona_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
    )
  `);
    // Messages table
    database.run(`
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
    // Create indexes
    database.run(`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`);
    database.run(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`);
    database.run(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`);
}
//# sourceMappingURL=index.js.map