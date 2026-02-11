import { create } from 'zustand';
import { toast } from 'sonner';
import type { Persona, PersonaInput } from '../lib/types';
import {
  createPersonaCatalogEntry,
  deletePersonaCatalogEntry,
  loadPersonaCatalog,
  updatePersonaCatalogEntry,
} from '../lib/shell/renderer/persona-catalog-client';

interface PersonasState {
  personas: Persona[];
  isLoading: boolean;
  
  // Actions
  fetchPersonas: () => Promise<void>;
  createPersona: (data: PersonaInput) => Promise<Persona | null>;
  updatePersona: (id: string, data: Partial<PersonaInput>) => Promise<Persona | null>;
  deletePersona: (id: string) => Promise<boolean>;
  getPersonaById: (id: string) => Persona | undefined;
}

export const usePersonasStore = create<PersonasState>((set, get) => ({
  personas: [],
  isLoading: false,

  fetchPersonas: async () => {
    try {
      set({ isLoading: true });
      const personas = await loadPersonaCatalog(window.electronDB);
      set({ personas });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error fetching personas');
    } finally {
      set({ isLoading: false });
    }
  },

  createPersona: async (data: PersonaInput) => {
    try {
      set({ isLoading: true });
      const persona = await createPersonaCatalogEntry(window.electronDB, data);
      set(state => ({ personas: [persona, ...state.personas] }));
      toast.success('Persona created successfully');
      return persona;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error creating persona');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  updatePersona: async (id: string, data: Partial<PersonaInput>) => {
    try {
      set({ isLoading: true });
      const updated = await updatePersonaCatalogEntry(window.electronDB, id, data);
      set(state => ({
        personas: state.personas.map(p => p.id === id ? updated : p)
      }));
      toast.success('Persona updated successfully');
      return updated;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error updating persona');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  deletePersona: async (id: string) => {
    try {
      set({ isLoading: true });
      await deletePersonaCatalogEntry(window.electronDB, id);
      set(state => ({
        personas: state.personas.filter(p => p.id !== id)
      }));
      toast.success('Persona deleted successfully');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error deleting persona');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  getPersonaById: (id: string) => {
    return get().personas.find(p => p.id === id);
  },
}));
