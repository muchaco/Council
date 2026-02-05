import { create } from 'zustand';
import { toast } from 'sonner';
import type { Persona, PersonaInput } from '../lib/types';

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
      const result = await window.electronDB.getPersonas();
      if (result.success && result.data) {
        set({ personas: result.data as Persona[] });
      } else {
        toast.error(result.error || 'Failed to fetch personas');
      }
    } catch (error) {
      toast.error('Error fetching personas');
    } finally {
      set({ isLoading: false });
    }
  },

  createPersona: async (data: PersonaInput) => {
    try {
      set({ isLoading: true });
      const result = await window.electronDB.createPersona(data);
      if (result.success && result.data) {
        const persona = result.data as Persona;
        set(state => ({ personas: [persona, ...state.personas] }));
        toast.success('Persona created successfully');
        return persona;
      } else {
        toast.error(result.error || 'Failed to create persona');
        return null;
      }
    } catch (error) {
      toast.error('Error creating persona');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  updatePersona: async (id: string, data: Partial<PersonaInput>) => {
    try {
      set({ isLoading: true });
      const result = await window.electronDB.updatePersona(id, data);
      if (result.success && result.data) {
        const updated = result.data as Persona;
        set(state => ({
          personas: state.personas.map(p => p.id === id ? updated : p)
        }));
        toast.success('Persona updated successfully');
        return updated;
      } else {
        toast.error(result.error || 'Failed to update persona');
        return null;
      }
    } catch (error) {
      toast.error('Error updating persona');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  deletePersona: async (id: string) => {
    try {
      set({ isLoading: true });
      const result = await window.electronDB.deletePersona(id);
      if (result.success) {
        set(state => ({
          personas: state.personas.filter(p => p.id !== id)
        }));
        toast.success('Persona deleted successfully');
        return true;
      } else {
        toast.error(result.error || 'Failed to delete persona');
        return false;
      }
    } catch (error) {
      toast.error('Error deleting persona');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  getPersonaById: (id: string) => {
    return get().personas.find(p => p.id === id);
  },
}));
