// PriceAlertStore on the SQLCipher vault (table recurring_price_alerts in ./migrations.ts).
import type { VaultDb } from '@shared/ports';

import type { PriceAlert, PriceAlertStore } from '../../application/priceAlertPorts';

interface Row {
  id: string;
  item_id: string;
  transaction_id: string;
  previous_minor: number;
  new_minor: number;
  detected_at: string;
}

const toAlert = (r: Row): PriceAlert => ({
  id: r.id,
  itemId: r.item_id,
  transactionId: r.transaction_id,
  previousMinor: r.previous_minor,
  newMinor: r.new_minor,
  detectedAt: r.detected_at,
});

export function createVaultPriceAlertStore(db: VaultDb): PriceAlertStore {
  return {
    async open() {
      const rows = await db.query<Row>(
        `SELECT id, item_id, transaction_id, previous_minor, new_minor, detected_at
         FROM recurring_price_alerts WHERE dismissed_at IS NULL
         ORDER BY detected_at DESC, id`,
      );
      return rows.map(toAlert);
    },

    async add(a) {
      const [taken] = await db.query<{ id: string }>(
        'SELECT id FROM recurring_price_alerts WHERE transaction_id = ?',
        [a.transactionId],
      );
      if (taken) return false;
      await db.execute(
        `INSERT INTO recurring_price_alerts
           (id, item_id, transaction_id, previous_minor, new_minor, detected_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [a.id, a.itemId, a.transactionId, a.previousMinor, a.newMinor, a.detectedAt],
      );
      return true;
    },

    async dismiss(id, at) {
      await db.execute(
        'UPDATE recurring_price_alerts SET dismissed_at = ? WHERE id = ? AND dismissed_at IS NULL',
        [at, id],
      );
    },
  };
}
