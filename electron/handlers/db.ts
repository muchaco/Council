import { setupPersonaHandlers } from './persona-handlers.js';
import { setupSessionMessageHandlers } from './session-message-handlers.js';
import { setupSessionParticipationHandlers } from './session-participation-handlers.js';
import { setupSessionStateDbHandlers } from './session-state-db-handlers.js';
import { setupSessionTagsHandlers } from './session-tags-handlers.js';

export function setupDatabaseHandlers(): void {
  setupPersonaHandlers();
  setupSessionStateDbHandlers();
  setupSessionParticipationHandlers();
  setupSessionMessageHandlers();
  setupSessionTagsHandlers();
}
