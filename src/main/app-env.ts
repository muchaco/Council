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
  logger: {
    info: (message: string, context?: Record<string, unknown>) => void;
    error: (message: string, context?: Record<string, unknown>) => void;
  };
};
