// Vault tables of the bank module (00-shared-contracts.md, section 3.1). Registered with
// registerVaultMigrations('bank', ...). Never edit a released migration: add a new one.
// Bank tokens and links are never registered for backup (section 3.2): a new phone links again.
import type { VaultMigration } from '@shared/ports';

export const bankMigrations: VaultMigration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE bank_links (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        consent_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
        created_at TEXT NOT NULL,
        last_synced_at TEXT,
        last_attempt_at TEXT,
        revoked_at TEXT
      );
      CREATE TABLE bank_tokens (
        link_id TEXT PRIMARY KEY REFERENCES bank_links (id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        access_expires_at TEXT NOT NULL
      );
    `,
  },
];
