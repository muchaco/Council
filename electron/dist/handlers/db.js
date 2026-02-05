"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupDatabaseHandlers = setupDatabaseHandlers;
const electron_1 = require("electron");
const queries = __importStar(require("../lib/queries.js"));
function setupDatabaseHandlers() {
    // Persona handlers
    electron_1.ipcMain.handle('db:persona:create', async (_, data) => {
        try {
            const result = await queries.createPersona(data);
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:persona:getAll', async () => {
        try {
            const result = await queries.getPersonas();
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:persona:get', async (_, id) => {
        try {
            const persona = await queries.getPersona(id);
            if (!persona) {
                return { success: false, error: 'Persona not found' };
            }
            return { success: true, data: persona };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:persona:update', async (_, id, data) => {
        try {
            const result = await queries.updatePersona(id, data);
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:persona:delete', async (_, id) => {
        try {
            await queries.deletePersona(id);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // Session handlers
    electron_1.ipcMain.handle('db:session:create', async (_, data) => {
        try {
            const result = await queries.createSession(data);
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:session:getAll', async () => {
        try {
            const result = await queries.getSessions();
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:session:get', async (_, id) => {
        try {
            const session = await queries.getSession(id);
            if (!session) {
                return { success: false, error: 'Session not found' };
            }
            return { success: true, data: session };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:session:update', async (_, id, data) => {
        try {
            const result = await queries.updateSession(id, data);
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:session:delete', async (_, id) => {
        try {
            await queries.deleteSession(id);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // Message handlers
    electron_1.ipcMain.handle('db:message:create', async (_, data) => {
        try {
            const result = await queries.createMessage(data);
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:message:getBySession', async (_, sessionId) => {
        try {
            const result = await queries.getMessagesBySession(sessionId);
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // Session Persona handlers
    electron_1.ipcMain.handle('db:sessionPersona:add', async (_, sessionId, personaId, isOrchestrator) => {
        try {
            await queries.addPersonaToSession(sessionId, personaId, isOrchestrator);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:sessionPersona:getBySession', async (_, sessionId) => {
        try {
            const result = await queries.getSessionPersonas(sessionId);
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
//# sourceMappingURL=db.js.map