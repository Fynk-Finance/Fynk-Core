// Vault tables of the recurring module (M9 prompt, Technical design). Registered with
// registerVaultMigrations('recurring', ...). Never edit a released migration: add a new one.
// The proposals and price alert tables come with detection and price alerts.
import type { VaultMigration } from '@shared/ports';

export const recurringMigrations: VaultMigration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE recurring_items (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('fixed', 'subscription')),
        name TEXT NOT NULL,
        category_id TEXT NOT NULL,
        merchant_key TEXT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        periodicity TEXT NOT NULL
          CHECK (periodicity IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
        anchor_day INTEGER,
        weekdays_mask INTEGER,
        anchor_date TEXT,
        account_id TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
        usage TEXT CHECK (usage IN ('high', 'some', 'low')),
        reminder_enabled INTEGER NOT NULL DEFAULT 1,
        source TEXT NOT NULL CHECK (source IN ('manual', 'detected')),
        created_at TEXT NOT NULL,
        cancelled_at TEXT
      );
      CREATE INDEX recurring_items_status ON recurring_items (status);
    `,
  },
  {
    // HU-045: the encrypted backup of M2. Every write bumps `version` (the highest one wins on a
    // restore), and deleting an item leaves a tombstone, so the deletion reaches the other
    // phone. The usage mark is a column of the item, so it travels with it. The rows that exist
    // before this version wait in `recurring_backup_pending` until the vault opens.
    version: 2,
    up: `
      ALTER TABLE recurring_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE recurring_items ADD COLUMN deleted_at TEXT;
      CREATE TABLE recurring_backup_pending (
        collection TEXT NOT NULL,
        record_id TEXT NOT NULL,
        PRIMARY KEY (collection, record_id)
      );
      INSERT INTO recurring_backup_pending (collection, record_id)
        SELECT 'recurring.items', id FROM recurring_items;
    `,
  },
  {
    // SCRUM-55: what detection proposed and what the person decided. A dismissed proposal
    // keeps its amount, so it comes back only when the amount changes by more than 30 %. A
    // confirmed one is not proposed again, even after its item is deleted.
    version: 3,
    up: `
      CREATE TABLE recurring_proposals (
        merchant_key TEXT PRIMARY KEY,
        score REAL NOT NULL,
        data_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'dismissed', 'confirmed')),
        amount_minor INTEGER NOT NULL,
        detected_at TEXT NOT NULL,
        decided_at TEXT
      );
    `,
  },
];
