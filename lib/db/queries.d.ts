import type { Persona, PersonaInput, Session, SessionInput, Message, MessageInput } from '../types.js';
export declare function createPersona(data: PersonaInput): Persona;
export declare function getPersonas(): Persona[];
export declare function getPersona(id: string): Persona | null;
export declare function updatePersona(id: string, data: Partial<PersonaInput>): Persona;
export declare function deletePersona(id: string): void;
export declare function createSession(data: SessionInput): Session;
export declare function getSessions(): Session[];
export declare function getSession(id: string): Session | null;
export declare function updateSession(id: string, data: Partial<SessionInput> & {
    status?: string;
    tokenCount?: number;
    costEstimate?: number;
}): Session;
export declare function deleteSession(id: string): void;
export declare function createMessage(data: MessageInput): Message;
export declare function getMessagesBySession(sessionId: string): Message[];
export declare function getLastMessages(sessionId: string, limit?: number): Message[];
export declare function addPersonaToSession(sessionId: string, personaId: string, isOrchestrator?: boolean): void;
export declare function getSessionPersonas(sessionId: string): (Persona & {
    isOrchestrator: boolean;
})[];
export declare function removePersonaFromSession(sessionId: string, personaId: string): void;
export declare function getNextTurnNumber(sessionId: string): number;
//# sourceMappingURL=queries.d.ts.map