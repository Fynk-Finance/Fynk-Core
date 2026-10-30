// CapsStore on the encrypted vault (tables in migrations.ts).
import { isCategoryId, type CategoryId } from '@shared/domain';
import type { BackupRecord, VaultDb } from '@shared/ports';

import type { CapsBackupData, CapRecord, CapsStore } from '../../application/ports';
import type { CapPeriod, SpendingCap } from '../../domain/types';

interface CapRow {
  id: string;
  category_id: string;
  period: string;
  cap_minor: number;
  created_at: string;
  deleted_at: string | null;
  version: number;
}

const SETTINGS_ID = 'settings';

function toCap(row: CapRow): CapRecord {
  if (!isCategoryId(row.category_id)) throw new Error('Unknown category in analytics_caps');
  return {
    id: row.id,
    categoryId: row.category_id,
    period: row.period as CapPeriod,
    capMinor: row.cap_minor,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    version: row.version,
  };
}

function toSpendingCap({ deletedAt: _d, version: _v, ...cap }: CapRecord): SpendingCap {
  return cap;
}

export function createVaultCapsStore(db: () => VaultDb): CapsStore {
  const getSettings = async () => {
    const [row] = await db().query<{ treats_threshold_minor: number; version: number }>(
      'SELECT treats_threshold_minor, version FROM analytics_settings WHERE id = ?',
      [SETTINGS_ID],
    );
    return row ? { treatsThresholdMinor: row.treats_threshold_minor, version: row.version } : null;
  };

  return {
    async listActive() {
      const rows = await db().query<CapRow>(
        'SELECT * FROM analytics_caps WHERE deleted_at IS NULL ORDER BY created_at, id',
      );
      return rows.map(toCap).map(toSpendingCap);
    },
    async get(id) {
      const [row] = await db().query<CapRow>('SELECT * FROM analytics_caps WHERE id = ?', [id]);
      return row ? toCap(row) : null;
    },
    async save(cap) {
      await db().execute(
        `INSERT INTO analytics_caps (id, category_id, period, cap_minor, created_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, NULL, 1)
         ON CONFLICT (id) DO UPDATE SET
           category_id = excluded.category_id,
           period = excluded.period,
           cap_minor = excluded.cap_minor,
           deleted_at = NULL,
           version = analytics_caps.version + 1`,
        [cap.id, cap.categoryId, cap.period, cap.capMinor, cap.createdAt],
      );
    },
    async softDelete(id, at) {
      await db().execute(
        'UPDATE analytics_caps SET deleted_at = ?, version = version + 1 WHERE id = ? AND deleted_at IS NULL',
        [at, id],
      );
    },
    getSettings,
    async setTreatsThreshold(minor) {
      await db().execute(
        `INSERT INTO analytics_settings (id, treats_threshold_minor, version) VALUES (?, ?, 1)
         ON CONFLICT (id) DO UPDATE SET
           treats_threshold_minor = excluded.treats_threshold_minor,
           version = analytics_settings.version + 1`,
        [SETTINGS_ID, minor],
      );
    },
    async sentAlertKeys() {
      const rows = await db().query<{ cap_id: string; period_key: string; level: string }>(
        'SELECT cap_id, period_key, level FROM analytics_cap_alerts',
      );
      return new Set(rows.map((r) => `${r.cap_id}|${r.period_key}|${r.level}`));
    },
    async recordAlerts(alerts, at) {
      if (alerts.length === 0) return;
      await db().transaction(async (tx) => {
        for (const a of alerts) {
          await tx.execute(
            `INSERT OR IGNORE INTO analytics_cap_alerts (cap_id, period_key, level, sent_at)
             VALUES (?, ?, ?, ?)`,
            [a.capId, a.periodKey, a.level, at],
          );
        }
      });
    },
    async exportAll() {
      const caps = await db().query<CapRow>('SELECT * FROM analytics_caps ORDER BY id');
      const records: BackupRecord<CapsBackupData>[] = caps.map(toCap).map((c) => ({
        id: c.id,
        version: c.version,
        deleted: c.deletedAt !== null,
        data: {
          type: 'cap',
          categoryId: c.categoryId,
          period: c.period,
          capMinor: c.capMinor,
          createdAt: c.createdAt,
          deletedAt: c.deletedAt,
        },
      }));
      const settings = await getSettings();
      if (settings) {
        records.push({
          id: SETTINGS_ID,
          version: settings.version,
          deleted: false,
          data: { type: 'settings', treatsThresholdMinor: settings.treatsThresholdMinor },
        });
      }
      return records;
    },
    async importAll(records) {
      await db().transaction(async (tx) => {
        for (const r of records) {
          if (r.data.type === 'settings') {
            await tx.execute(
              `INSERT INTO analytics_settings (id, treats_threshold_minor, version) VALUES (?, ?, ?)
               ON CONFLICT (id) DO UPDATE SET
                 treats_threshold_minor = excluded.treats_threshold_minor,
                 version = excluded.version
               WHERE excluded.version > analytics_settings.version`,
              [SETTINGS_ID, r.data.treatsThresholdMinor, r.version],
            );
            continue;
          }
          const categoryId: CategoryId | null = isCategoryId(r.data.categoryId)
            ? r.data.categoryId
            : null;
          if (!categoryId) continue;
          await tx.execute(
            `INSERT INTO analytics_caps (id, category_id, period, cap_minor, created_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET
               category_id = excluded.category_id,
               period = excluded.period,
               cap_minor = excluded.cap_minor,
               deleted_at = excluded.deleted_at,
               version = excluded.version
             WHERE excluded.version > analytics_caps.version`,
            [
              r.id,
              categoryId,
              r.data.period,
              r.data.capMinor,
              r.data.createdAt,
              r.deleted ? (r.data.deletedAt ?? r.data.createdAt) : null,
              r.version,
            ],
          );
        }
      });
    },
  };
}
