import { ipcMain } from 'electron';
import * as queries from '../lib/queries.js';

export function setupDatabaseHandlers(): void {
  // Persona handlers
  ipcMain.handle('db:persona:create', async (_, data) => {
    try {
      const result = await queries.createPersona(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:persona:getAll', async () => {
    try {
      const result = await queries.getPersonas();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:persona:get', async (_, id: string) => {
    try {
      const persona = await queries.getPersona(id);
      if (!persona) {
        return { success: false, error: 'Persona not found' };
      }
      return { success: true, data: persona };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:persona:update', async (_, id: string, data) => {
    try {
      const result = await queries.updatePersona(id, data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:persona:delete', async (_, id: string) => {
    try {
      await queries.deletePersona(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Session handlers
  ipcMain.handle('db:session:create', async (_, data) => {
    try {
      const result = await queries.createSession(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:session:getAll', async () => {
    try {
      const result = await queries.getSessions();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:session:get', async (_, id: string) => {
    try {
      const session = await queries.getSession(id);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }
      return { success: true, data: session };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:session:update', async (_, id: string, data) => {
    try {
      const result = await queries.updateSession(id, data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:session:delete', async (_, id: string) => {
    try {
      await queries.deleteSession(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Message handlers
  ipcMain.handle('db:message:create', async (_, data) => {
    try {
      const result = await queries.createMessage(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:message:getBySession', async (_, sessionId: string) => {
    try {
      const result = await queries.getMessagesBySession(sessionId);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Session Persona handlers
  ipcMain.handle('db:sessionPersona:add', async (_, sessionId: string, personaId: string, isOrchestrator: boolean) => {
    try {
      await queries.addPersonaToSession(sessionId, personaId, isOrchestrator);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:sessionPersona:getBySession', async (_, sessionId: string) => {
    try {
      const result = await queries.getSessionPersonas(sessionId);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
