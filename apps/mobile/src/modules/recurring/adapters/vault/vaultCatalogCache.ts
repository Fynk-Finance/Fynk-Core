// CatalogCache on the SQLCipher vault (table recurring_catalog in ./migrations.ts).
import type { VaultDb } from '@shared/ports';

import type { CatalogCache } from '../../application/catalogPorts';
import type { CatalogEntry } from '../../domain/catalog';

export function createVaultCatalogCache(db: VaultDb): CatalogCache {
  return {
    async get() {
      const [row] = await db.query<{ etag: string; entries_json: string; fetched_at: string }>(
        'SELECT etag, entries_json, fetched_at FROM recurring_catalog WHERE id = 1',
      );
      if (!row) return null;
      return {
        etag: row.etag,
        entries: JSON.parse(row.entries_json) as CatalogEntry[],
        fetchedAt: row.fetched_at,
      };
    },
    async save(c) {
      await db.execute(
        `INSERT INTO recurring_catalog (id, etag, entries_json, fetched_at) VALUES (1, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           etag = excluded.etag, entries_json = excluded.entries_json,
           fetched_at = excluded.fetched_at`,
        [c.etag, JSON.stringify(c.entries), c.fetchedAt],
      );
    },
    async touch(fetchedAt) {
      await db.execute('UPDATE recurring_catalog SET fetched_at = ? WHERE id = 1', [fetchedAt]);
    },
  };
}
