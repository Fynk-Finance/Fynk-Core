// AccountsStore on the SQLCipher vault (tables in ./migrations.ts). CDT details are kept in four
// columns that stay null for every other kind.
import type { Account, AccountKind, Id, IsoDate } from '@shared/domain/types';
import type { VaultDb } from '@shared/ports';

import type { AccountsStore, BalancePoint } from '../../application/ports';

interface Row {
  id: string;
  provider: Account['provider'];
  provider_account_id: string | null;
  link_id: string | null;
  kind: AccountKind;
  display_name: string;
  last4: string | null;
  balance_minor: number;
  available_minor: number | null;
  credit_limit_minor: number | null;
  payment_due_on: string | null;
  status: Account['status'];
  is_simulated: number;
  last_synced_at: string | null;
  cdt_rate_ea_bps: number | null;
  cdt_term_days: number | null;
  cdt_opened_on: string | null;
  cdt_matures_on: string | null;
}

const toAccount = (r: Row): Account => ({
  id: r.id,
  provider: r.provider,
  providerAccountId: r.provider_account_id,
  linkId: r.link_id,
  kind: r.kind,
  displayName: r.display_name,
  last4: r.last4,
  currency: 'COP',
  balanceMinor: r.balance_minor,
  availableMinor: r.available_minor,
  creditLimitMinor: r.credit_limit_minor,
  paymentDueOn: r.payment_due_on,
  status: r.status,
  isSimulated: r.is_simulated === 1,
  lastSyncedAt: r.last_synced_at,
  cdt:
    r.cdt_rate_ea_bps !== null && r.cdt_term_days !== null && r.cdt_opened_on && r.cdt_matures_on
      ? {
          rateEaBps: r.cdt_rate_ea_bps,
          termDays: r.cdt_term_days,
          openedOn: r.cdt_opened_on,
          maturesOn: r.cdt_matures_on,
        }
      : null,
});

const COLUMNS = `id, provider, provider_account_id, link_id, kind, display_name, last4, currency,
  balance_minor, available_minor, credit_limit_minor, payment_due_on, status, is_simulated,
  last_synced_at, cdt_rate_ea_bps, cdt_term_days, cdt_opened_on, cdt_matures_on`;

const values = (a: Account) => [
  a.id,
  a.provider,
  a.providerAccountId,
  a.linkId,
  a.kind,
  a.displayName,
  a.last4,
  a.currency,
  a.balanceMinor,
  a.availableMinor,
  a.creditLimitMinor,
  a.paymentDueOn,
  a.status,
  a.isSimulated ? 1 : 0,
  a.lastSyncedAt,
  a.cdt?.rateEaBps ?? null,
  a.cdt?.termDays ?? null,
  a.cdt?.openedOn ?? null,
  a.cdt?.maturesOn ?? null,
];

export function createVaultAccountsStore(db: VaultDb): AccountsStore {
  return {
    async list() {
      const rows = await db.query<Row>(`SELECT ${COLUMNS} FROM accounts_accounts`);
      return rows.map(toAccount);
    },

    async saveSynced(accounts, at) {
      await db.transaction(async (tx) => {
        for (const a of accounts) {
          await tx.execute(
            `INSERT INTO accounts_accounts (${COLUMNS}, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (provider, provider_account_id) DO UPDATE SET
               link_id = excluded.link_id, kind = excluded.kind,
               display_name = excluded.display_name, last4 = excluded.last4,
               balance_minor = excluded.balance_minor, available_minor = excluded.available_minor,
               credit_limit_minor = excluded.credit_limit_minor,
               payment_due_on = excluded.payment_due_on, status = excluded.status,
               is_simulated = excluded.is_simulated, last_synced_at = excluded.last_synced_at,
               cdt_rate_ea_bps = excluded.cdt_rate_ea_bps, cdt_term_days = excluded.cdt_term_days,
               cdt_opened_on = excluded.cdt_opened_on, cdt_matures_on = excluded.cdt_matures_on`,
            [...values(a), at.createdAt],
          );
          // The row may keep an older id, so the history is written from the saved row.
          await tx.execute(
            `INSERT INTO accounts_balance_history (account_id, on_date, balance_minor)
             SELECT id, ?, balance_minor FROM accounts_accounts
             WHERE provider = ? AND provider_account_id = ? AND status = 'active'
             ON CONFLICT (account_id, on_date) DO UPDATE SET balance_minor = excluded.balance_minor`,
            [at.onDate, a.provider, a.providerAccountId],
          );
        }
      });
    },

    async revokeLink(linkId: Id) {
      await db.execute(`UPDATE accounts_accounts SET status = 'revoked' WHERE link_id = ?`, [
        linkId,
      ]);
    },

    async balanceHistory(accountIds: Id[], from: IsoDate) {
      if (accountIds.length === 0) return [];
      const marks = accountIds.map(() => '?').join(', ');
      return db.query<BalancePoint>(
        `SELECT account_id AS accountId, on_date AS onDate, balance_minor AS balanceMinor
         FROM accounts_balance_history
         WHERE account_id IN (${marks}) AND on_date >= ?
         ORDER BY on_date, account_id`,
        [...accountIds, from],
      );
    },
  };
}
