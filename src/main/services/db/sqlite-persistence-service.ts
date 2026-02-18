import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { type Result, err, ok } from "neverthrow";
import type { ModelRef } from "../../../shared/domain/model-ref.js";
import type { ProviderId } from "../../../shared/ipc/dto.js";

type DbError = {
  kind: "DbConnectionError" | "DbMigrationError" | "DbQueryError";
  message: string;
};

type PersistedProviderConfig = {
  providerId: ProviderId;
  endpointUrl: string | null;
  credentialRef: string | null;
  lastSavedAtUtc: string;
  models: ReadonlyArray<string>;
};

type PersistedAgent = {
  id: string;
  name: string;
  systemPrompt: string;
  verbosity: string | null;
  temperature: number | null;
  tags: ReadonlyArray<string>;
  modelRefOrNull: ModelRef | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

type PersistedCouncil = {
  id: string;
  title: string;
  topic: string;
  goal: string | null;
  mode: "autopilot" | "manual";
  tags: ReadonlyArray<string>;
  memberAgentIds: ReadonlyArray<string>;
  memberColorsByAgentId: Readonly<Record<string, string>>;
  conductorModelRefOrNull: ModelRef | null;
  archivedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

type SqlitePersistenceService = {
  initialize: () => Result<void, DbError>;
  loadSettingsState: () => Result<
    {
      globalDefaultModelRef: ModelRef | null;
      providerConfigs: ReadonlyArray<PersistedProviderConfig>;
    },
    DbError
  >;
  saveGlobalDefaultModel: (
    modelRefOrNull: ModelRef | null,
    updatedAtUtc: string,
  ) => Result<void, DbError>;
  saveProviderConfig: (params: PersistedProviderConfig) => Result<void, DbError>;
  loadAgents: () => Result<ReadonlyArray<PersistedAgent>, DbError>;
  saveAgent: (agent: PersistedAgent) => Result<void, DbError>;
  deleteAgent: (agentId: string) => Result<void, DbError>;
  loadCouncils: () => Result<ReadonlyArray<PersistedCouncil>, DbError>;
  saveCouncil: (council: PersistedCouncil) => Result<void, DbError>;
  deleteCouncil: (councilId: string) => Result<void, DbError>;
  countCouncilsUsingAgent: (agentId: string) => Result<number, DbError>;
};

type SqlitePersistenceDependencies = {
  dbFilePath: string;
  migrationsDirPath: string;
};

type ProviderConfigRow = {
  provider_id: string;
  endpoint_url: string | null;
  credential_ref: string | null;
  models_json: string;
  last_saved_at_utc: string;
};

type AgentRow = {
  id: string;
  name: string;
  system_prompt: string;
  verbosity: string | null;
  temperature: number | null;
  tags_json: string;
  model_ref_json: string | null;
  created_at_utc: string;
  updated_at_utc: string;
};

type CouncilRow = {
  id: string;
  title: string;
  topic: string;
  goal: string | null;
  mode: "autopilot" | "manual";
  tags_json: string;
  member_colors_json: string;
  conductor_model_ref_json: string | null;
  archived_at_utc: string | null;
  created_at_utc: string;
  updated_at_utc: string;
};

type CouncilMemberRow = {
  council_id: string;
  agent_id: string;
};

type SettingsRow = {
  global_default_model_ref_json: string | null;
};

const toDbError = (kind: DbError["kind"], message: string): DbError => ({
  kind,
  message,
});

const parseJson = <T>(raw: string | null, fallback: T): T => {
  if (raw === null) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const createSqlitePersistenceService = (
  dependencies: SqlitePersistenceDependencies,
): SqlitePersistenceService => {
  try {
    mkdirSync(path.dirname(dependencies.dbFilePath), { recursive: true });
  } catch {
    // Directory may already exist.
  }

  const db = new Database(dependencies.dbFilePath);
  db.pragma("foreign_keys = ON");

  const initialize = (): Result<void, DbError> => {
    if (!existsSync(dependencies.migrationsDirPath)) {
      return err(
        toDbError(
          "DbMigrationError",
          `Missing migrations directory at ${dependencies.migrationsDirPath}`,
        ),
      );
    }

    try {
      db.exec(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at_utc TEXT NOT NULL)",
      );
    } catch (error) {
      return err(
        toDbError(
          "DbMigrationError",
          `Failed to create schema_migrations table: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }

    const migrationFiles = readdirSync(dependencies.migrationsDirPath)
      .filter((entry) => entry.endsWith(".sql"))
      .sort();

    for (const migrationFile of migrationFiles) {
      const applied = db
        .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
        .get(migrationFile) as { 1: number } | undefined;
      if (applied !== undefined) {
        continue;
      }

      const migrationSql = readFileSync(
        path.join(dependencies.migrationsDirPath, migrationFile),
        "utf8",
      );
      try {
        const apply = db.transaction((version: string, sql: string) => {
          db.exec(sql);
          db.prepare("INSERT INTO schema_migrations(version, applied_at_utc) VALUES(?, ?)").run(
            version,
            new Date().toISOString(),
          );
        });
        apply(migrationFile, migrationSql);
      } catch (error) {
        return err(
          toDbError(
            "DbMigrationError",
            `Failed applying migration ${migrationFile}: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }

    return ok(undefined);
  };

  const loadSettingsState = (): Result<
    {
      globalDefaultModelRef: ModelRef | null;
      providerConfigs: ReadonlyArray<PersistedProviderConfig>;
    },
    DbError
  > => {
    try {
      const settingsRow = db
        .prepare("SELECT global_default_model_ref_json FROM settings WHERE singleton_id = 1")
        .get() as SettingsRow | undefined;
      const providerRows = db
        .prepare(
          "SELECT provider_id, endpoint_url, credential_ref, models_json, last_saved_at_utc FROM provider_configs",
        )
        .all() as Array<ProviderConfigRow>;

      return ok({
        globalDefaultModelRef: parseJson<ModelRef | null>(
          settingsRow?.global_default_model_ref_json ?? null,
          null,
        ),
        providerConfigs: providerRows.map((row) => ({
          providerId: row.provider_id as ProviderId,
          endpointUrl: row.endpoint_url,
          credentialRef: row.credential_ref,
          lastSavedAtUtc: row.last_saved_at_utc,
          models: parseJson<ReadonlyArray<string>>(row.models_json, []),
        })),
      });
    } catch (error) {
      return err(
        toDbError(
          "DbQueryError",
          `Failed loading settings state: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  };

  const saveGlobalDefaultModel = (
    modelRefOrNull: ModelRef | null,
    updatedAtUtc: string,
  ): Result<void, DbError> => {
    try {
      db.prepare(
        `INSERT INTO settings(singleton_id, global_default_model_ref_json, context_last_n, updated_at_utc)
         VALUES(1, ?, 20, ?)
         ON CONFLICT(singleton_id) DO UPDATE SET
           global_default_model_ref_json = excluded.global_default_model_ref_json,
           updated_at_utc = excluded.updated_at_utc`,
      ).run(modelRefOrNull === null ? null : JSON.stringify(modelRefOrNull), updatedAtUtc);
      return ok(undefined);
    } catch (error) {
      return err(
        toDbError(
          "DbQueryError",
          `Failed saving global default model: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  };

  const saveProviderConfig = (params: PersistedProviderConfig): Result<void, DbError> => {
    try {
      db.prepare(
        `INSERT INTO provider_configs(provider_id, endpoint_url, credential_ref, models_json, last_saved_at_utc)
         VALUES(?, ?, ?, ?, ?)
         ON CONFLICT(provider_id) DO UPDATE SET
           endpoint_url = excluded.endpoint_url,
           credential_ref = excluded.credential_ref,
           models_json = excluded.models_json,
           last_saved_at_utc = excluded.last_saved_at_utc`,
      ).run(
        params.providerId,
        params.endpointUrl,
        params.credentialRef,
        JSON.stringify(params.models),
        params.lastSavedAtUtc,
      );
      return ok(undefined);
    } catch (error) {
      return err(
        toDbError(
          "DbQueryError",
          `Failed saving provider config: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  };

  const loadAgents = (): Result<ReadonlyArray<PersistedAgent>, DbError> => {
    try {
      const rows = db
        .prepare(
          "SELECT id, name, system_prompt, verbosity, temperature, tags_json, model_ref_json, created_at_utc, updated_at_utc FROM agents",
        )
        .all() as Array<AgentRow>;

      return ok(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          systemPrompt: row.system_prompt,
          verbosity: row.verbosity,
          temperature: row.temperature,
          tags: parseJson<ReadonlyArray<string>>(row.tags_json, []),
          modelRefOrNull: parseJson<ModelRef | null>(row.model_ref_json, null),
          createdAtUtc: row.created_at_utc,
          updatedAtUtc: row.updated_at_utc,
        })),
      );
    } catch (error) {
      return err(
        toDbError(
          "DbQueryError",
          `Failed loading agents: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  };

  const saveAgent = (agent: PersistedAgent): Result<void, DbError> => {
    try {
      db.prepare(
        `INSERT INTO agents(id, name, system_prompt, verbosity, temperature, tags_json, model_ref_json, created_at_utc, updated_at_utc)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           system_prompt = excluded.system_prompt,
           verbosity = excluded.verbosity,
           temperature = excluded.temperature,
           tags_json = excluded.tags_json,
           model_ref_json = excluded.model_ref_json,
           updated_at_utc = excluded.updated_at_utc`,
      ).run(
        agent.id,
        agent.name,
        agent.systemPrompt,
        agent.verbosity,
        agent.temperature,
        JSON.stringify(agent.tags),
        agent.modelRefOrNull === null ? null : JSON.stringify(agent.modelRefOrNull),
        agent.createdAtUtc,
        agent.updatedAtUtc,
      );
      return ok(undefined);
    } catch (error) {
      return err(
        toDbError(
          "DbQueryError",
          `Failed saving agent: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  };

  const deleteAgent = (agentId: string): Result<void, DbError> => {
    try {
      db.prepare("DELETE FROM agents WHERE id = ?").run(agentId);
      return ok(undefined);
    } catch (error) {
      return err(
        toDbError(
          "DbQueryError",
          `Failed deleting agent: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  };

  const loadCouncils = (): Result<ReadonlyArray<PersistedCouncil>, DbError> => {
    try {
      const councilRows = db
        .prepare(
          "SELECT id, title, topic, goal, mode, tags_json, member_colors_json, conductor_model_ref_json, archived_at_utc, created_at_utc, updated_at_utc FROM councils",
        )
        .all() as Array<CouncilRow>;

      const memberRows = db
        .prepare("SELECT council_id, agent_id FROM council_members ORDER BY rowid ASC")
        .all() as Array<CouncilMemberRow>;

      const membersByCouncilId = new Map<string, Array<string>>();
      for (const row of memberRows) {
        const current = membersByCouncilId.get(row.council_id) ?? [];
        current.push(row.agent_id);
        membersByCouncilId.set(row.council_id, current);
      }

      return ok(
        councilRows.map((row) => ({
          id: row.id,
          title: row.title,
          topic: row.topic,
          goal: row.goal,
          mode: row.mode,
          tags: parseJson<ReadonlyArray<string>>(row.tags_json, []),
          memberAgentIds: membersByCouncilId.get(row.id) ?? [],
          memberColorsByAgentId: parseJson<Readonly<Record<string, string>>>(
            row.member_colors_json,
            {},
          ),
          conductorModelRefOrNull: parseJson<ModelRef | null>(row.conductor_model_ref_json, null),
          archivedAtUtc: row.archived_at_utc,
          createdAtUtc: row.created_at_utc,
          updatedAtUtc: row.updated_at_utc,
        })),
      );
    } catch (error) {
      return err(
        toDbError(
          "DbQueryError",
          `Failed loading councils: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  };

  const saveCouncil = (council: PersistedCouncil): Result<void, DbError> => {
    try {
      const save = db.transaction((next: PersistedCouncil) => {
        db.prepare(
          `INSERT INTO councils(id, title, topic, goal, mode, tags_json, member_colors_json, conductor_model_ref_json, archived_at_utc, created_at_utc, updated_at_utc)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             topic = excluded.topic,
             goal = excluded.goal,
             mode = excluded.mode,
             tags_json = excluded.tags_json,
             member_colors_json = excluded.member_colors_json,
             conductor_model_ref_json = excluded.conductor_model_ref_json,
             archived_at_utc = excluded.archived_at_utc,
             updated_at_utc = excluded.updated_at_utc`,
        ).run(
          next.id,
          next.title,
          next.topic,
          next.goal,
          next.mode,
          JSON.stringify(next.tags),
          JSON.stringify(next.memberColorsByAgentId),
          next.conductorModelRefOrNull === null
            ? null
            : JSON.stringify(next.conductorModelRefOrNull),
          next.archivedAtUtc,
          next.createdAtUtc,
          next.updatedAtUtc,
        );

        db.prepare("DELETE FROM council_members WHERE council_id = ?").run(next.id);
        const insertMember = db.prepare(
          "INSERT INTO council_members(council_id, agent_id) VALUES(?, ?)",
        );
        for (const memberAgentId of next.memberAgentIds) {
          insertMember.run(next.id, memberAgentId);
        }
      });

      save(council);
      return ok(undefined);
    } catch (error) {
      return err(
        toDbError(
          "DbQueryError",
          `Failed saving council: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  };

  const deleteCouncil = (councilId: string): Result<void, DbError> => {
    try {
      db.prepare("DELETE FROM councils WHERE id = ?").run(councilId);
      return ok(undefined);
    } catch (error) {
      return err(
        toDbError(
          "DbQueryError",
          `Failed deleting council: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  };

  const countCouncilsUsingAgent = (agentId: string): Result<number, DbError> => {
    try {
      const row = db
        .prepare(
          "SELECT COUNT(DISTINCT council_id) as count FROM council_members WHERE agent_id = ?",
        )
        .get(agentId) as { count: number };
      return ok(row.count);
    } catch (error) {
      return err(
        toDbError(
          "DbQueryError",
          `Failed counting councils for agent: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  };

  return {
    initialize,
    loadSettingsState,
    saveGlobalDefaultModel,
    saveProviderConfig,
    loadAgents,
    saveAgent,
    deleteAgent,
    loadCouncils,
    saveCouncil,
    deleteCouncil,
    countCouncilsUsingAgent,
  };
};

export type {
  DbError,
  PersistedAgent,
  PersistedCouncil,
  PersistedProviderConfig,
  SqlitePersistenceService,
};
