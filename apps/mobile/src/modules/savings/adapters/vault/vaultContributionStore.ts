// ContributionStore on the SQLCipher vault (table savings_contributions in ./migrations.ts).
// "Deshacer" only marks a row deleted, so the record of what happened stays in the vault.
import type { Id } from '@shared/domain/types';
import type { VaultDb } from '@shared/ports';

import { MovementAlreadyLinkedError } from '../../application/contributionService';
import type { Contribution } from '../../domain/contribution';
import type { ContributionStore } from '../../application/contributionPorts';

interface Row {
  id: string;
  goal_id: string;
  amount_minor: number;
  contributed_on: string;
  source: 'manual' | 'movement';
  transaction_id: string | null;
  note: string | null;
}

const toContribution = (r: Row): Contribution => ({
  id: r.id,
  goalId: r.goal_id,
  amountMinor: r.amount_minor,
  contributedOn: r.contributed_on,
  source: r.source,
  transactionId: r.transaction_id,
  note: r.note,
});

const COLUMNS = 'id, goal_id, amount_minor, contributed_on, source, transaction_id, note';

export function createVaultContributionStore(db: VaultDb): ContributionStore {
  return {
    async list(goalId: Id) {
      const rows = await db.query<Row>(
        `SELECT ${COLUMNS} FROM savings_contributions
         WHERE goal_id = ? AND deleted_at IS NULL
         ORDER BY contributed_on DESC, rowid DESC`,
        [goalId],
      );
      return rows.map(toContribution);
    },

    async get(id: Id) {
      const [row] = await db.query<Row>(
        `SELECT ${COLUMNS} FROM savings_contributions
         WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      return row ? toContribution(row) : null;
    },

    async add(c) {
      if (c.transactionId) {
        const [taken] = await db.query<{ id: string }>(
          `SELECT id FROM savings_contributions
           WHERE transaction_id = ? AND deleted_at IS NULL`,
          [c.transactionId],
        );
        if (taken) throw new MovementAlreadyLinkedError();
      }
      await db.execute(
        `INSERT INTO savings_contributions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.goalId, c.amountMinor, c.contributedOn, c.source, c.transactionId, c.note],
      );
    },

    async markDeleted(id, at) {
      await db.execute('UPDATE savings_contributions SET deleted_at = ? WHERE id = ?', [at, id]);
    },

    async linkedTransactionIds(goalId) {
      const rows = await db.query<{ transaction_id: string }>(
        `SELECT transaction_id FROM savings_contributions
         WHERE goal_id = ? AND deleted_at IS NULL AND transaction_id IS NOT NULL`,
        [goalId],
      );
      return rows.map((r) => r.transaction_id);
    },
  };
}
