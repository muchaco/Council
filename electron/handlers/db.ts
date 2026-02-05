import { ipcMain } from 'electron';
import * as queries from '../lib/queries.js';

export function setupDatabaseHandlers(): void {
  // Persona handlers
  ipcMain.handle('db:persona:create', async (_, data) => {
    try {
      console.log('Creating persona:', data?.name || 'unnamed');
      const result = await queries.createPersona(data);
      console.log('Persona created successfully:', result.id);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error creating persona:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:persona:getAll', async () => {
    try {
      console.log('Fetching all personas...');
      const result = await queries.getPersonas();
      console.log(`Fetched ${result.length} personas`);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error fetching personas:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:persona:get', async (_, id: string) => {
    try {
      console.log('Fetching persona:', id);
      const persona = await queries.getPersona(id);
      if (!persona) {
        console.log('Persona not found:', id);
        return { success: false, error: 'Persona not found' };
      }
      console.log('Persona fetched:', id);
      return { success: true, data: persona };
    } catch (error) {
      console.error('Error fetching persona:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:persona:update', async (_, id: string, data) => {
    try {
      console.log('Updating persona:', id);
      const result = await queries.updatePersona(id, data);
      console.log('Persona updated:', id);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error updating persona:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:persona:delete', async (_, id: string) => {
    try {
      console.log('Deleting persona:', id);
      await queries.deletePersona(id);
      console.log('Persona deleted:', id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting persona:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Session handlers
  ipcMain.handle('db:session:create', async (_, data) => {
    try {
      console.log('Creating session:', data?.title || 'untitled');
      const { orchestratorConfig, ...sessionData } = data;
      const result = await queries.createSession(sessionData, orchestratorConfig);
      console.log('Session created successfully:', result.id);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error creating session:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:session:getAll', async () => {
    try {
      console.log('Fetching all sessions...');
      const result = await queries.getSessions();
      console.log(`Fetched ${result.length} sessions`);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:session:get', async (_, id: string) => {
    try {
      console.log('Fetching session:', id);
      const session = await queries.getSession(id);
      if (!session) {
        console.log('Session not found:', id);
        return { success: false, error: 'Session not found' };
      }
      console.log('Session fetched:', id);
      return { success: true, data: session };
    } catch (error) {
      console.error('Error fetching session:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:session:update', async (_, id: string, data) => {
    try {
      console.log('Updating session:', id);
      const result = await queries.updateSession(id, data);
      console.log('Session updated:', id);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error updating session:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:session:delete', async (_, id: string) => {
    try {
      console.log('Deleting session:', id);
      await queries.deleteSession(id);
      console.log('Session deleted:', id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting session:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Message handlers
  ipcMain.handle('db:message:create', async (_, data) => {
    try {
      console.log('Creating message for session:', data?.sessionId);
      const result = await queries.createMessage(data);
      console.log('Message created:', result.id);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error creating message:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:message:getBySession', async (_, sessionId: string) => {
    try {
      console.log('Fetching messages for session:', sessionId);
      const result = await queries.getMessagesBySession(sessionId);
      console.log(`Fetched ${result.length} messages for session ${sessionId}`);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error fetching messages:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Session Persona handlers
  ipcMain.handle('db:sessionPersona:add', async (_, sessionId: string, personaId: string, isOrchestrator: boolean) => {
    try {
      console.log('Adding persona', personaId, 'to session', sessionId);
      await queries.addPersonaToSession(sessionId, personaId, isOrchestrator);
      console.log('Persona added to session successfully');
      return { success: true };
    } catch (error) {
      console.error('Error adding persona to session:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:sessionPersona:getBySession', async (_, sessionId: string) => {
    try {
      console.log('Fetching personas for session:', sessionId);
      const result = await queries.getSessionPersonas(sessionId);
      console.log(`Fetched ${result.length} personas for session ${sessionId}`);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error fetching session personas:', error);
      return { success: false, error: (error as Error).message };
    }
  });
}
