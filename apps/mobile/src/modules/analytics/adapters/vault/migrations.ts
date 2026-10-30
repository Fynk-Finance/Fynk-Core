// Vault tables of the analytics module (shared contracts 3.1). Registered with
// registerVaultMigrations('analytics', analyticsMigrations).
import type { VaultMigration } from '@shared/ports';

export const analyticsMigrations: VaultMigration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE analytics_caps (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        period TEXT NOT NULL CHECK (period IN ('week', 'month')),
        cap_minor INTEGER NOT NULL CHECK (cap_minor > 0),
        created_at TEXT NOT NULL,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE analytics_settings (
        id TEXT PRIMARY KEY CHECK (id = 'settings'),
        treats_threshold_minor INTEGER NOT NULL CHECK (treats_threshold_minor > 0),
        version INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE analytics_cap_alerts (
        cap_id TEXT NOT NULL,
        period_key TEXT NOT NULL,
        level TEXT NOT NULL CHECK (level IN ('warning', 'reached')),
        sent_at TEXT NOT NULL,
        PRIMARY KEY (cap_id, period_key, level)
      );
    `,
  },
];
