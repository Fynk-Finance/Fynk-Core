// ProposalStore on the SQLCipher vault (table recurring_proposals in ./migrations.ts). The
// proposal itself is kept as JSON: it is recomputed after every sync and never edited in place.
import type { MoneyMinor } from '@shared/domain/types';
import type { VaultDb } from '@shared/ports';

import type { ProposalStore } from '../../application/detectionPorts';
import type { Proposal } from '../../domain/detect';

interface Row {
  merchant_key: string;
  data_json: string;
  status: 'pending' | 'dismissed' | 'confirmed';
  amount_minor: number;
}

export function createVaultProposalStore(db: VaultDb): ProposalStore {
  return {
    async pending() {
      const rows = await db.query<Row>(
        `SELECT merchant_key, data_json, status, amount_minor FROM recurring_proposals
         WHERE status = 'pending' ORDER BY score DESC, merchant_key`,
      );
      return rows.map((r) => JSON.parse(r.data_json) as Proposal);
    },

    async get(merchantKey) {
      const [row] = await db.query<Row>(
        `SELECT data_json FROM recurring_proposals
         WHERE merchant_key = ? AND status = 'pending'`,
        [merchantKey],
      );
      return row ? (JSON.parse(row.data_json) as Proposal) : null;
    },

    async decisions() {
      const rows = await db.query<Row>(
        `SELECT merchant_key, status, amount_minor FROM recurring_proposals
         WHERE status <> 'pending'`,
      );
      const dismissed = new Map<string, MoneyMinor>();
      const confirmed = new Set<string>();
      for (const r of rows) {
        if (r.status === 'dismissed') dismissed.set(r.merchant_key, r.amount_minor);
        else confirmed.add(r.merchant_key);
      }
      return { dismissed, confirmed };
    },

    async replacePending(proposals, at) {
      const before = new Set(
        (
          await db.query<{ merchant_key: string }>(
            `SELECT merchant_key FROM recurring_proposals WHERE status = 'pending'`,
          )
        ).map((r) => r.merchant_key),
      );
      let added = 0;
      await db.transaction(async (tx) => {
        // A pending proposal that is no longer detected (the charges stopped) goes away.
        await tx.execute(`DELETE FROM recurring_proposals WHERE status = 'pending'`);
        for (const p of proposals) {
          if (!before.has(p.merchantKey)) added++;
          // A dismissed one that is proposed again (its amount changed) becomes pending.
          await tx.execute(
            `INSERT INTO recurring_proposals
               (merchant_key, score, data_json, status, amount_minor, detected_at, decided_at)
             VALUES (?, ?, ?, 'pending', ?, ?, NULL)
             ON CONFLICT (merchant_key) DO UPDATE SET
               score = excluded.score, data_json = excluded.data_json, status = 'pending',
               amount_minor = excluded.amount_minor, detected_at = excluded.detected_at,
               decided_at = NULL`,
            [p.merchantKey, p.score, JSON.stringify(p), p.amountMinor, at],
          );
        }
      });
      return added;
    },

    async decide(merchantKey, status, at) {
      await db.execute(
        `UPDATE recurring_proposals SET status = ?, decided_at = ?
         WHERE merchant_key = ? AND status = 'pending'`,
        [status, at, merchantKey],
      );
    },
  };
}
