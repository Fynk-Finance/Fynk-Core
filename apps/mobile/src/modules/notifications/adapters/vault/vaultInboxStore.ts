// InboxStore on the SQLCipher vault (tables in ./migrations.ts). Times are stored as
// normalized ISO strings (Date.toISOString), so they sort and compare as text.
import type { NotificationKind, NotifyInput, VaultDb, VaultTx } from '@shared/ports';

import type { InboxItem } from '../../domain/inbox';
import type { InboxStore, ScheduledRow } from '../../application/ports';

interface InboxRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  deep_link: string;
  created_at: string;
  read_at: string | null;
}

interface ScheduledDbRow {
  id: string;
  kind: string;
  fire_at: string;
  payload_json: string;
}

const toItem = (r: InboxRow): InboxItem => ({
  id: r.id,
  kind: r.kind as NotificationKind,
  title: r.title,
  body: r.body,
  deepLink: r.deep_link,
  createdAt: r.created_at,
  readAt: r.read_at,
});

function storeOn(tx: VaultTx, transaction: InboxStore['transaction']): InboxStore {
  return {
    async insert(row) {
      const existing = await tx.query<{ id: string }>(
        'SELECT id FROM notifications_inbox WHERE dedupe_key = ?',
        [row.dedupeKey],
      );
      if (existing.length > 0) return false;
      await tx.execute(
        `INSERT INTO notifications_inbox
           (id, kind, title, body, deep_link, dedupe_key, created_at, read_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.kind,
          row.title,
          row.body,
          row.deepLink,
          row.dedupeKey,
          row.createdAt,
          row.readAt,
        ],
      );
      return true;
    },
    async list() {
      const rows = await tx.query<InboxRow>(
        `SELECT id, kind, title, body, deep_link, created_at, read_at
           FROM notifications_inbox ORDER BY created_at DESC, id`,
      );
      return rows.map(toItem);
    },
    async unreadCount() {
      const [row] = await tx.query<{ n: number }>(
        'SELECT COUNT(*) AS n FROM notifications_inbox WHERE read_at IS NULL',
      );
      return row?.n ?? 0;
    },
    async markRead(id, at) {
      await tx.execute(
        'UPDATE notifications_inbox SET read_at = ? WHERE id = ? AND read_at IS NULL',
        [at, id],
      );
    },
    async markAllRead(at) {
      await tx.execute('UPDATE notifications_inbox SET read_at = ? WHERE read_at IS NULL', [at]);
    },
    async deleteIds(ids) {
      if (ids.length === 0) return;
      await tx.execute(
        `DELETE FROM notifications_inbox WHERE id IN (${ids.map(() => '?').join(', ')})`,
        ids,
      );
    },
    async isEnabled(kind) {
      const [row] = await tx.query<{ enabled: number }>(
        'SELECT enabled FROM notifications_settings WHERE kind = ?',
        [kind],
      );
      return row ? row.enabled === 1 : true;
    },
    async setEnabled(kind, enabled) {
      await tx.execute(
        `INSERT INTO notifications_settings (kind, enabled) VALUES (?, ?)
         ON CONFLICT (kind) DO UPDATE SET enabled = excluded.enabled`,
        [kind, enabled ? 1 : 0],
      );
    },
    async saveScheduled(row) {
      await tx.execute(
        `INSERT INTO notifications_scheduled (id, kind, fire_at, payload_json, os_id)
         VALUES (?, ?, ?, ?, NULL)
         ON CONFLICT (id) DO UPDATE SET
           kind = excluded.kind, fire_at = excluded.fire_at, payload_json = excluded.payload_json`,
        [row.id, row.kind, row.fireAt, JSON.stringify(row.payload)],
      );
    },
    async deleteScheduled(id) {
      await tx.execute('DELETE FROM notifications_scheduled WHERE id = ?', [id]);
    },
    async listDue(now) {
      const rows = await tx.query<ScheduledDbRow>(
        `SELECT id, kind, fire_at, payload_json FROM notifications_scheduled
          WHERE fire_at <= ? ORDER BY fire_at, id`,
        [now],
      );
      return rows.map((r): ScheduledRow => ({
        id: r.id,
        kind: r.kind as NotificationKind,
        fireAt: r.fire_at,
        payload: JSON.parse(r.payload_json) as NotifyInput,
      }));
    },
    transaction,
  };
}

export function createVaultInboxStore(db: VaultDb): InboxStore {
  const transaction: InboxStore['transaction'] = (fn) =>
    db.transaction((tx) => fn(storeOn(tx, () => Promise.reject(new Error('Nested transaction')))));
  return storeOn(db, transaction);
}
