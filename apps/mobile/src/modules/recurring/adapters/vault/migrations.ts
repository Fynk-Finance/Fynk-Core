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
];
