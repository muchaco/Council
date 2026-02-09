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
            console.log('Creating persona:', data?.name || 'unnamed');
            const result = await queries.createPersona(data);
            console.log('Persona created successfully:', result.id);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error creating persona:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:persona:getAll', async () => {
        try {
            console.log('Fetching all personas...');
            const result = await queries.getPersonas();
            console.log(`Fetched ${result.length} personas`);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error fetching personas:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:persona:get', async (_, id) => {
        try {
            console.log('Fetching persona:', id);
            const persona = await queries.getPersona(id);
            if (!persona) {
                console.log('Persona not found:', id);
                return { success: false, error: 'Persona not found' };
            }
            console.log('Persona fetched:', id);
            return { success: true, data: persona };
        }
        catch (error) {
            console.error('Error fetching persona:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:persona:update', async (_, id, data) => {
        try {
            console.log('Updating persona:', id);
            const result = await queries.updatePersona(id, data);
            console.log('Persona updated:', id);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error updating persona:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:persona:delete', async (_, id) => {
        try {
            console.log('Deleting persona:', id);
            await queries.deletePersona(id);
            console.log('Persona deleted:', id);
            return { success: true };
        }
        catch (error) {
            console.error('Error deleting persona:', error);
            return { success: false, error: error.message };
        }
    });
    // Session handlers
    electron_1.ipcMain.handle('db:session:create', async (_, data) => {
        try {
            console.log('Creating session:', data?.title || 'untitled');
            const { orchestratorConfig, ...sessionData } = data;
            const result = await queries.createSession(sessionData, orchestratorConfig);
            console.log('Session created successfully:', result.id);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error creating session:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:session:getAll', async () => {
        try {
            console.log('Fetching all sessions...');
            const result = await queries.getSessions();
            console.log(`Fetched ${result.length} sessions`);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error fetching sessions:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:session:get', async (_, id) => {
        try {
            console.log('Fetching session:', id);
            const session = await queries.getSession(id);
            if (!session) {
                console.log('Session not found:', id);
                return { success: false, error: 'Session not found' };
            }
            console.log('Session fetched:', id);
            return { success: true, data: session };
        }
        catch (error) {
            console.error('Error fetching session:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:session:update', async (_, id, data) => {
        try {
            console.log('Updating session:', id);
            const result = await queries.updateSession(id, data);
            console.log('Session updated:', id);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error updating session:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:session:delete', async (_, id) => {
        try {
            console.log('Deleting session:', id);
            await queries.deleteSession(id);
            console.log('Session deleted:', id);
            return { success: true };
        }
        catch (error) {
            console.error('Error deleting session:', error);
            return { success: false, error: error.message };
        }
    });
    // Message handlers
    electron_1.ipcMain.handle('db:message:create', async (_, data) => {
        try {
            console.log('Creating message for session:', data?.sessionId);
            const result = await queries.createMessage(data);
            console.log('Message created:', result.id);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error creating message:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:message:getBySession', async (_, sessionId) => {
        try {
            console.log('Fetching messages for session:', sessionId);
            const result = await queries.getMessagesBySession(sessionId);
            console.log(`Fetched ${result.length} messages for session ${sessionId}`);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error fetching messages:', error);
            return { success: false, error: error.message };
        }
    });
    // Session Persona handlers
    electron_1.ipcMain.handle('db:sessionPersona:add', async (_, sessionId, personaId, isOrchestrator) => {
        try {
            console.log('Adding persona', personaId, 'to session', sessionId);
            await queries.addPersonaToSession(sessionId, personaId, isOrchestrator);
            console.log('Persona added to session successfully');
            return { success: true };
        }
        catch (error) {
            console.error('Error adding persona to session:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:sessionPersona:getBySession', async (_, sessionId) => {
        try {
            console.log('Fetching personas for session:', sessionId);
            const result = await queries.getSessionPersonas(sessionId);
            console.log(`Fetched ${result.length} personas for session ${sessionId}`);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error fetching session personas:', error);
            return { success: false, error: error.message };
        }
    });
    // Hush handlers - "The Hush Button" feature
    electron_1.ipcMain.handle('db:persona:hush', async (_, sessionId, personaId, turns) => {
        try {
            console.log(`Hushing persona ${personaId} in session ${sessionId} for ${turns} turns`);
            await queries.setPersonaHush(sessionId, personaId, turns);
            console.log('Persona hushed successfully');
            return { success: true };
        }
        catch (error) {
            console.error('Error hushing persona:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:persona:unhush', async (_, sessionId, personaId) => {
        try {
            console.log(`Unhushing persona ${personaId} in session ${sessionId}`);
            await queries.clearPersonaHush(sessionId, personaId);
            console.log('Persona unhushed successfully');
            return { success: true };
        }
        catch (error) {
            console.error('Error unhushing persona:', error);
            return { success: false, error: error.message };
        }
    });
    // Archive handlers
    electron_1.ipcMain.handle('db:session:archive', async (_, id) => {
        try {
            console.log('Archiving session:', id);
            await queries.archiveSession(id);
            console.log('Session archived:', id);
            return { success: true };
        }
        catch (error) {
            console.error('Error archiving session:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:session:unarchive', async (_, id) => {
        try {
            console.log('Unarchiving session:', id);
            await queries.unarchiveSession(id);
            console.log('Session unarchived:', id);
            return { success: true };
        }
        catch (error) {
            console.error('Error unarchiving session:', error);
            return { success: false, error: error.message };
        }
    });
    // Tag handlers
    electron_1.ipcMain.handle('db:tag:create', async (_, name) => {
        try {
            console.log('Creating tag:', name);
            const result = await queries.createTag({ name });
            console.log('Tag created successfully:', result.id);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error creating tag:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:tag:getAll', async () => {
        try {
            console.log('Fetching all tags...');
            const result = await queries.getAllTags();
            console.log(`Fetched ${result.length} tags`);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error fetching tags:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:tag:getByName', async (_, name) => {
        try {
            console.log('Fetching tag by name:', name);
            const result = await queries.getTagByName(name);
            console.log('Tag fetch result:', result ? 'found' : 'not found');
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error fetching tag by name:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:tag:delete', async (_, id) => {
        try {
            console.log('Deleting tag:', id);
            await queries.deleteTag(id);
            console.log('Tag deleted:', id);
            return { success: true };
        }
        catch (error) {
            console.error('Error deleting tag:', error);
            return { success: false, error: error.message };
        }
    });
    // Session-Tag handlers
    electron_1.ipcMain.handle('db:sessionTag:add', async (_, sessionId, tagId) => {
        try {
            console.log('Adding tag', tagId, 'to session', sessionId);
            await queries.addTagToSession(sessionId, tagId);
            console.log('Tag added to session successfully');
            return { success: true };
        }
        catch (error) {
            console.error('Error adding tag to session:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:sessionTag:remove', async (_, sessionId, tagId) => {
        try {
            console.log('Removing tag', tagId, 'from session', sessionId);
            await queries.removeTagFromSession(sessionId, tagId);
            console.log('Tag removed from session successfully');
            return { success: true };
        }
        catch (error) {
            console.error('Error removing tag from session:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('db:sessionTag:getBySession', async (_, sessionId) => {
        try {
            console.log('Fetching tags for session:', sessionId);
            const result = await queries.getTagsBySession(sessionId);
            console.log(`Fetched ${result.length} tags for session ${sessionId}`);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error fetching session tags:', error);
            return { success: false, error: error.message };
        }
    });
    // Cleanup orphaned tags handler
    electron_1.ipcMain.handle('db:tag:cleanupOrphaned', async () => {
        try {
            console.log('Cleaning up orphaned tags');
            await queries.cleanupOrphanedTags();
            console.log('Orphaned tags cleaned up');
            return { success: true };
        }
        catch (error) {
            console.error('Error cleaning up orphaned tags:', error);
            return { success: false, error: error.message };
        }
    });
}
//# sourceMappingURL=db.js.map