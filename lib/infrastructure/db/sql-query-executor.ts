export interface SqlQueryExecutor {
  readonly run: (sql: string, params?: readonly unknown[]) => Promise<void>;
  readonly get: <TRow>(sql: string, params?: readonly unknown[]) => Promise<TRow | null>;
  readonly all: <TRow>(sql: string, params?: readonly unknown[]) => Promise<readonly TRow[]>;
}
