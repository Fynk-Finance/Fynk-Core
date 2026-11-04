// RecommendationsStore on the vault: one cached answer (the last one) and the AI switch.
import type { VaultDb } from '@shared/ports';

import type { CachedTexts, RecommendationsStore } from '../../application/ports';
import type { ModelTexts } from '../../domain/steps';

interface CacheRow {
  snapshot_hash: string;
  response_json: string;
  created_at: string;
}

export function createVaultRecommendationsStore(db: () => VaultDb): RecommendationsStore {
  return {
    async getCached() {
      const [row] = await db().query<CacheRow>(
        'SELECT snapshot_hash, response_json, created_at FROM recommendations_cache WHERE id = 1',
      );
      if (!row) return null;
      try {
        return {
          snapshotKey: row.snapshot_hash,
          texts: JSON.parse(row.response_json) as ModelTexts,
          createdAt: row.created_at,
        };
      } catch {
        return null;
      }
    },
    async putCached(entry: CachedTexts) {
      await db().execute(
        `INSERT INTO recommendations_cache (id, snapshot_hash, response_json, created_at)
         VALUES (1, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           snapshot_hash = excluded.snapshot_hash,
           response_json = excluded.response_json,
           created_at = excluded.created_at`,
        [entry.snapshotKey, JSON.stringify(entry.texts), entry.createdAt],
      );
    },
    async clearCached() {
      await db().execute('DELETE FROM recommendations_cache');
    },
    async isAiEnabled() {
      const [row] = await db().query<{ ai_enabled: number }>(
        'SELECT ai_enabled FROM recommendations_settings WHERE id = 1',
      );
      return row ? row.ai_enabled === 1 : true;
    },
    async setAiEnabled(enabled) {
      await db().execute(
        `INSERT INTO recommendations_settings (id, ai_enabled) VALUES (1, ?)
         ON CONFLICT (id) DO UPDATE SET ai_enabled = excluded.ai_enabled`,
        [enabled ? 1 : 0],
      );
    },
  };
}
