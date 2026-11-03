// Vault tables of the transactions module (M7 prompt, Technical design). Registered with
// registerVaultMigrations('transactions', ...). Never edit a released migration: add a new one.
import type { VaultMigration } from '@shared/ports';

export const transactionsMigrations: VaultMigration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE transactions_transactions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_tx_id TEXT,
        source TEXT NOT NULL CHECK (source IN ('bank', 'manual')),
        booked_at TEXT NOT NULL,
        amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer'),
        description TEXT NOT NULL,
        merchant_raw TEXT,
        merchant_key TEXT,
        category_id TEXT NOT NULL,
        category_source TEXT NOT NULL CHECK (category_source IN ('rule', 'user', 'bank')),
        status TEXT NOT NULL CHECK (status IN ('booked', 'pending')),
        goal_id TEXT,
        -- Version of a manual movement in the backup (transactions.manual). Bank rows keep 0.
        backup_version INTEGER NOT NULL DEFAULT 0,
        CHECK (source = 'manual' OR provider_tx_id IS NOT NULL),
        UNIQUE (account_id, provider_tx_id)
      );
      CREATE INDEX tx_booked_idx ON transactions_transactions (booked_at DESC, id DESC);
      CREATE INDEX tx_account_booked_idx
        ON transactions_transactions (account_id, booked_at DESC, id DESC);
      CREATE INDEX tx_merchant_idx ON transactions_transactions (merchant_key);

      -- Every category change, for the history on the detail screen (HU-018).
      CREATE TABLE transactions_category_changes (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        from_category TEXT NOT NULL,
        to_category TEXT NOT NULL,
        changed_at TEXT NOT NULL
      );
      CREATE INDEX tx_changes_tx_idx
        ON transactions_category_changes (transaction_id, changed_at);

      -- "Aplicar a todos los movimientos de <comercio>": one category per merchant.
      CREATE TABLE transactions_category_overrides (
        merchant_key TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        backup_version INTEGER NOT NULL DEFAULT 0
      );

      -- A category the person picked for one bank movement. Keyed by the bank's id, so a new
      -- phone applies it again when the movement is synced there (transactions.category_overrides).
      CREATE TABLE transactions_tx_overrides (
        provider_tx_id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        backup_version INTEGER NOT NULL DEFAULT 0
      );
    `,
  },
];
