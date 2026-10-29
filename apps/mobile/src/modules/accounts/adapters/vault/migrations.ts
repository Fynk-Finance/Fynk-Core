// Vault tables of the accounts module (M6 prompt, Technical design). Registered with
// registerVaultMigrations('accounts', ...). Never edit a released migration: add a new one.
import type { VaultMigration } from '@shared/ports';

export const accountsMigrations: VaultMigration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE accounts_accounts (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL
          CHECK (provider IN ('banco-demo', 'billetera-demo', 'bancolombia', 'manual')),
        provider_account_id TEXT,
        link_id TEXT,
        kind TEXT NOT NULL
          CHECK (kind IN ('savings', 'checking', 'wallet', 'credit_card', 'cdt', 'cash')),
        display_name TEXT NOT NULL,
        last4 TEXT CHECK (last4 IS NULL OR (length(last4) BETWEEN 1 AND 4 AND last4 NOT GLOB '*[^0-9]*')),
        currency TEXT NOT NULL CHECK (currency = 'COP'),
        balance_minor INTEGER NOT NULL,
        available_minor INTEGER,
        credit_limit_minor INTEGER,
        payment_due_on TEXT,
        status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'revoked')),
        is_simulated INTEGER NOT NULL,
        last_synced_at TEXT,
        cdt_rate_ea_bps INTEGER,
        cdt_term_days INTEGER,
        cdt_opened_on TEXT,
        cdt_matures_on TEXT,
        created_at TEXT NOT NULL
      );
      -- One row per account of a bank (HU-014 sin duplicados) and a single cash account.
      CREATE UNIQUE INDEX accounts_accounts_provider_key
        ON accounts_accounts (provider, provider_account_id);
      CREATE UNIQUE INDEX accounts_accounts_single_cash
        ON accounts_accounts (kind) WHERE kind = 'cash';
      CREATE INDEX accounts_accounts_link ON accounts_accounts (link_id);

      -- One balance per account per day in Bogotá, the last sync of the day wins (M15 chart).
      CREATE TABLE accounts_balance_history (
        account_id TEXT NOT NULL,
        on_date TEXT NOT NULL,
        balance_minor INTEGER NOT NULL,
        PRIMARY KEY (account_id, on_date)
      );
    `,
  },
  {
    version: 2,
    up: `
      -- Every amount the person registered as cash (HU-054), newest last.
      CREATE TABLE accounts_cash_history (
        id TEXT PRIMARY KEY,
        amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
        set_at TEXT NOT NULL
      );
      -- Version of the cash account in the backup (accounts.cash). Bank accounts keep 0.
      ALTER TABLE accounts_accounts ADD COLUMN backup_version INTEGER NOT NULL DEFAULT 0;
    `,
  },
];
