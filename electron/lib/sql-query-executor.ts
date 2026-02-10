import { ensureDatabaseReady, getDatabase } from './db.js';

import type { SqlQueryExecutor } from '../../lib/infrastructure/db/sql-query-executor';

const ensureDb = async (): Promise<void> => {
  await ensureDatabaseReady();
};

export const makeElectronSqlQueryExecutor = (): SqlQueryExecutor => ({
  run: async (sql, params = []) => {
    await ensureDb();
    const db = getDatabase();
    return new Promise((resolve, reject) => {
      db.run(sql, [...params], (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  },

  get: async <TRow>(sql: string, params: readonly unknown[] = []) => {
    await ensureDb();
    const db = getDatabase();
    return new Promise<TRow | null>((resolve, reject) => {
      db.get(sql, [...params], (error, row) => {
        if (error) {
          reject(error);
          return;
        }
        resolve((row as TRow) ?? null);
      });
    });
  },

  all: async <TRow>(sql: string, params: readonly unknown[] = []) => {
    await ensureDb();
    const db = getDatabase();
    return new Promise<readonly TRow[]>((resolve, reject) => {
      db.all(sql, [...params], (error, rows) => {
        if (error) {
          reject(error);
          return;
        }
        resolve((rows as TRow[]) ?? []);
      });
    });
  },
});
