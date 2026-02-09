"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabasePath = getDatabasePath;
exports.initializeDatabase = initializeDatabase;
exports.getDatabase = getDatabase;
exports.isDatabaseInitialized = isDatabaseInitialized;
exports.ensureDatabaseReady = ensureDatabaseReady;
exports.closeDatabase = closeDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let db = null;
let initPromise = null;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;
const CURRENT_SCHEMA_VERSION = 7;
function getDatabasePath() {
    try {
        const userDataPath = electron_1.app.getPath('userData');
        const dbDir = path_1.default.join(userDataPath, 'data');
        if (!fs_1.default.existsSync(dbDir)) {
            fs_1.default.mkdirSync(dbDir, { recursive: true });
        }
        return path_1.default.join(dbDir, 'council.db');
    }
    catch (error) {
        console.error('Error getting database path:', error);
        throw new Error(`Failed to get database path: ${error.message}`);
    }
}
async function initializeDatabase() {
    // If already initialized, return existing database
    if (db && initPromise) {
        try {
            return await initPromise;
        }
        catch {
            // If previous init failed, we'll retry
            initPromise = null;
        }
    }
    // Start new initialization
    initPromise = initializeWithRetry();
    return initPromise;
}
async function initializeWithRetry() {
    while (initAttempts < MAX_INIT_ATTEMPTS) {
        initAttempts++;
        console.log(`Database initialization attempt ${initAttempts}/${MAX_INIT_ATTEMPTS}`);
        try {
            const database = await doInitialize();
            initAttempts = 0; // Reset counter on success
            return database;
        }
        catch (error) {
            console.error(`Database initialization attempt ${initAttempts} failed:`, error);
            if (initAttempts >= MAX_INIT_ATTEMPTS) {
                initAttempts = 0;
                throw new Error(`Failed to initialize database after ${MAX_INIT_ATTEMPTS} attempts: ${error.message}`);
            }
            // Wait before retry with exponential backoff
            const delay = Math.pow(2, initAttempts - 1) * 100;
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Unexpected exit from initialization retry loop');
}
async function doInitialize() {
    const dbPath = getDatabasePath();
    return new Promise((resolve, reject) => {
        const database = new sqlite3_1.default.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
                reject(new Error(`Failed to open database: ${err.message}`));
                return;
            }
            console.log('Database opened at:', dbPath);
            // Enable foreign keys and WAL mode for better concurrency
            database.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
                if (pragmaErr) {
                    console.error('Error enabling foreign keys:', pragmaErr);
                    database.close();
                    reject(new Error(`Failed to enable foreign keys: ${pragmaErr.message}`));
                    return;
                }
                // Enable WAL mode for better performance
                database.run('PRAGMA journal_mode = WAL', (walErr) => {
                    if (walErr) {
                        console.warn('Warning: Could not enable WAL mode:', walErr);
                        // Non-fatal, continue anyway
                    }
                    // Initialize schema with migrations
                    initializeSchemaWithMigrations(database)
                        .then(() => {
                        db = database;
                        console.log('Database initialized successfully');
                        resolve(database);
                    })
                        .catch((schemaErr) => {
                        console.error('Error initializing schema:', schemaErr);
                        database.close();
                        reject(new Error(`Failed to initialize schema: ${schemaErr.message}`));
                    });
                });
            });
        });
    });
}
async function initializeSchemaWithMigrations(database) {
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
    // Helper to promisify db.get
    const get = (sql) => {
        return new Promise((resolve, reject) => {
            database.get(sql, (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
    };
    // Create schema version table
    await run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `);
    // Get current schema version
    let currentVersion = 0;
    try {
        const result = await get('SELECT version FROM schema_version');
        if (result) {
            currentVersion = result.version;
        }
    }
    catch {
        // No version yet, start at 0
    }
    console.log(`Current schema version: ${currentVersion}, Target: ${CURRENT_SCHEMA_VERSION}`);
    // Run migrations
    if (currentVersion < 1) {
        console.log('Running migration to version 1...');
        await runMigrationV1(database, run);
        await run('INSERT OR REPLACE INTO schema_version (version) VALUES (1)');
        console.log('Migration to version 1 complete');
    }
    if (currentVersion < 2) {
        console.log('Running migration to version 2...');
        await runMigrationV2(database, run);
        await run('INSERT OR REPLACE INTO schema_version (version) VALUES (2)');
        console.log('Migration to version 2 complete');
    }
    if (currentVersion < 3) {
        console.log('Running migration to version 3...');
        await runMigrationV3(database, run);
        await run('INSERT OR REPLACE INTO schema_version (version) VALUES (3)');
        console.log('Migration to version 3 complete');
    }
    if (currentVersion < 4) {
        console.log('Running migration to version 4...');
        await runMigrationV4(database, run);
        await run('INSERT OR REPLACE INTO schema_version (version) VALUES (4)');
        console.log('Migration to version 4 complete');
    }
    if (currentVersion < 5) {
        console.log('Running migration to version 5...');
        await runMigrationV5(database, run);
        await run('INSERT OR REPLACE INTO schema_version (version) VALUES (5)');
        console.log('Migration to version 5 complete');
    }
    if (currentVersion < 6) {
        console.log('Running migration to version 6...');
        await runMigrationV6(database, run);
        await run('INSERT OR REPLACE INTO schema_version (version) VALUES (6)');
        console.log('Migration to version 6 complete');
    }
    if (currentVersion < 7) {
        console.log('Running migration to version 7...');
        await runMigrationV7(database, run);
        await run('INSERT OR REPLACE INTO schema_version (version) VALUES (7)');
        console.log('Migration to version 7 complete');
    }
    console.log('All migrations complete');
}
async function runMigrationV1(database, run) {
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
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE SET NULL
    )
  `);
    await run(`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`);
}
async function runMigrationV2(database, run) {
    // Add orchestrator columns to sessions table
    try {
        await run(`ALTER TABLE sessions ADD COLUMN orchestrator_enabled BOOLEAN DEFAULT 0`);
        console.log('Added orchestrator_enabled column');
    }
    catch (err) {
        // Column might already exist
        console.log('Note: orchestrator_enabled column may already exist');
    }
    try {
        await run(`ALTER TABLE sessions ADD COLUMN orchestrator_persona_id TEXT`);
        console.log('Added orchestrator_persona_id column');
    }
    catch (err) {
        // Column might already exist
        console.log('Note: orchestrator_persona_id column may already exist');
    }
    try {
        await run(`ALTER TABLE sessions ADD COLUMN blackboard TEXT`);
        console.log('Added blackboard column');
    }
    catch (err) {
        // Column might already exist
        console.log('Note: blackboard column may already exist');
    }
    try {
        await run(`ALTER TABLE sessions ADD COLUMN auto_reply_count INTEGER DEFAULT 0`);
        console.log('Added auto_reply_count column');
    }
    catch (err) {
        // Column might already exist
        console.log('Note: auto_reply_count column may already exist');
    }
    try {
        await run(`ALTER TABLE sessions ADD COLUMN token_budget INTEGER DEFAULT 100000`);
        console.log('Added token_budget column');
    }
    catch (err) {
        // Column might already exist
        console.log('Note: token_budget column may already exist');
    }
    try {
        await run(`ALTER TABLE sessions ADD COLUMN summary TEXT`);
        console.log('Added summary column');
    }
    catch (err) {
        // Column might already exist
        console.log('Note: summary column may already exist');
    }
}
async function runMigrationV3(database, run) {
    // Add metadata column to messages table (was missing in databases created before Migration V1)
    try {
        await run(`ALTER TABLE messages ADD COLUMN metadata TEXT`);
        console.log('Added metadata column to messages table');
    }
    catch (err) {
        // Column might already exist
        console.log('Note: metadata column may already exist');
    }
}
async function runMigrationV4(database, run) {
    // Add verbosity column to personas table
    try {
        await run(`ALTER TABLE personas ADD COLUMN verbosity TEXT`);
        console.log('Added verbosity column to personas table');
    }
    catch (err) {
        // Column might already exist
        console.log('Note: verbosity column may already exist');
    }
}
async function runMigrationV5(database, run) {
    // Add archived_at column to sessions table
    try {
        await run(`ALTER TABLE sessions ADD COLUMN archived_at DATETIME`);
        console.log('Added archived_at column to sessions table');
    }
    catch (err) {
        // Column might already exist
        console.log('Note: archived_at column may already exist');
    }
}
async function runMigrationV6(database, run) {
    // Create tags table
    await run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    console.log('Created tags table');
    // Create session_tags junction table
    await run(`
    CREATE TABLE IF NOT EXISTS session_tags (
      session_id TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, tag_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);
    console.log('Created session_tags junction table');
    // Create index for efficient tag lookups
    await run(`CREATE INDEX IF NOT EXISTS idx_session_tags_tag ON session_tags(tag_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_session_tags_session ON session_tags(session_id)`);
    console.log('Created indexes on session_tags');
}
async function runMigrationV7(database, run) {
    // Add hush columns to session_personas table for "The Hush Button" feature
    try {
        await run(`ALTER TABLE session_personas ADD COLUMN hush_turns_remaining INTEGER DEFAULT 0`);
        console.log('Added hush_turns_remaining column to session_personas table');
    }
    catch (err) {
        // Column might already exist
        console.log('Note: hush_turns_remaining column may already exist');
    }
    try {
        await run(`ALTER TABLE session_personas ADD COLUMN hushed_at DATETIME`);
        console.log('Added hushed_at column to session_personas table');
    }
    catch (err) {
        // Column might already exist
        console.log('Note: hushed_at column may already exist');
    }
}
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return db;
}
function isDatabaseInitialized() {
    return db !== null;
}
async function ensureDatabaseReady() {
    if (!db) {
        return await initializeDatabase();
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
        initPromise = null;
        initAttempts = 0;
    }
}
//# sourceMappingURL=db.js.map