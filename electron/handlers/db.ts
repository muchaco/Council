import { setupPersonaHandlers } from './persona-handlers.js';
import { setupSessionMessageHandlers } from './session-message-handlers.js';
import { setupSessionParticipationHandlers } from './session-participation-handlers.js';
import { setupSessionTagsHandlers } from './session-tags-handlers.js';

export function setupDatabaseHandlers(): void {
  setupPersonaHandlers();
  setupSessionParticipationHandlers();
  setupSessionMessageHandlers();
  setupSessionTagsHandlers();
}
