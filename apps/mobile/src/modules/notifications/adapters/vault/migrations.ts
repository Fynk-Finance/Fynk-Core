// Vault tables of the notifications module (M12 prompt, Technical design). Registered with
// registerVaultMigrations('notifications', ...). Never edit a released migration: add a new one.
import type { VaultMigration } from '@shared/ports';

export const notificationsMigrations: VaultMigration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE notifications_inbox (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        deep_link TEXT NOT NULL,
        dedupe_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        read_at TEXT
      );
      CREATE INDEX notifications_inbox_created_at ON notifications_inbox (created_at);
      CREATE TABLE notifications_scheduled (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        fire_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        os_id TEXT
      );
      CREATE INDEX notifications_scheduled_fire_at ON notifications_scheduled (fire_at);
      CREATE TABLE notifications_settings (
        kind TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL
      );
    `,
  },
];
