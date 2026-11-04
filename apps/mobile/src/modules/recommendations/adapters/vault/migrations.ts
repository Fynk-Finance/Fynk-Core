// Vault tables of the recommendations module. Registered with
// registerVaultMigrations('recommendations', recommendationsMigrations).
import type { VaultMigration } from '@shared/ports';

export const recommendationsMigrations: VaultMigration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE recommendations_cache (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        snapshot_hash TEXT NOT NULL,
        response_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE recommendations_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        ai_enabled INTEGER NOT NULL DEFAULT 1
      );
    `,
  },
];
