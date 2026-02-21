import type { Logger } from "./logging/index.js";
import type {
  AiService,
  DbService,
  KeychainService,
  ModelCatalogService,
} from "./services/interfaces.js";

export type AppEnv = {
  db: DbService;
  keychain: KeychainService;
  ai: AiService;
  modelCatalog: ModelCatalogService;
  clock: () => Date;
  uuid: () => string;
  logger: Logger;
};
