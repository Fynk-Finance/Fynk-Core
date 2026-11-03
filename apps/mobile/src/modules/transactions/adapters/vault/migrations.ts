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
  {
    version: 2,
    up: `
      -- Search (HU-017): an FTS5 index over description and merchant, case and accent
      -- insensitive. It keeps no copy of the text (content=) and triggers keep it in step.
      CREATE VIRTUAL TABLE transactions_fts USING fts5 (
        description, merchant_raw,
        content='transactions_transactions', content_rowid='rowid',
        tokenize='unicode61 remove_diacritics 2'
      );
      CREATE TRIGGER transactions_fts_ai AFTER INSERT ON transactions_transactions BEGIN
        INSERT INTO transactions_fts (rowid, description, merchant_raw)
          VALUES (new.rowid, new.description, new.merchant_raw);
      END;
      CREATE TRIGGER transactions_fts_ad AFTER DELETE ON transactions_transactions BEGIN
        INSERT INTO transactions_fts (transactions_fts, rowid, description, merchant_raw)
          VALUES ('delete', old.rowid, old.description, old.merchant_raw);
      END;
      CREATE TRIGGER transactions_fts_au
        AFTER UPDATE OF description, merchant_raw ON transactions_transactions BEGIN
        INSERT INTO transactions_fts (transactions_fts, rowid, description, merchant_raw)
          VALUES ('delete', old.rowid, old.description, old.merchant_raw);
        INSERT INTO transactions_fts (rowid, description, merchant_raw)
          VALUES (new.rowid, new.description, new.merchant_raw);
      END;
      -- Movements saved before this version.
      INSERT INTO transactions_fts (transactions_fts) VALUES ('rebuild');
    `,
  },
];
