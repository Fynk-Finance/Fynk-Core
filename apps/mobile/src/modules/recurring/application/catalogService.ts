// The merchant catalog on the phone (SCRUM-58, M9 prompt "Catalog backend"): kept in the vault,
// read into memory when the vault opens, and asked again at most once a day while the app is
// open, with the ETag (a 304 changes nothing). Detection and Detalle de suscripción read it
// synchronously. Without a copy yet, every lookup is null and nothing breaks.
import type { Clock } from '@shared/domain/types';

import { findMerchant, type CatalogEntry } from '../domain/catalog';
import type { CatalogApi, CatalogCache } from './catalogPorts';

/** How often the phone asks for a new catalog: once a day (M9 prompt). */
export const CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface CatalogDeps {
  cache: () => CatalogCache;
  api: CatalogApi;
  clock: Clock;
}

export interface CatalogService {
  /** Reads the vault copy into memory. */
  load(): Promise<void>;
  /** Downloads a new copy when the one kept is older than a day. True when it changed. */
  refresh(): Promise<boolean>;
  lookup(merchantKey: string | null): CatalogEntry | null;
}

export function createCatalogService(deps: CatalogDeps): CatalogService {
  let entries: CatalogEntry[] = [];

  return {
    async load() {
      entries = (await deps.cache().get())?.entries ?? [];
    },

    async refresh() {
      const cache = deps.cache();
      const kept = await cache.get();
      const now = deps.clock.now();
      if (kept && now.getTime() - Date.parse(kept.fetchedAt) < CATALOG_MAX_AGE_MS) return false;
      const result = await deps.api.fetch(kept?.etag ?? null);
      if (result.status === 'unchanged') {
        await cache.touch(now.toISOString());
        return false;
      }
      await cache.save({
        etag: result.etag,
        entries: result.entries,
        fetchedAt: now.toISOString(),
      });
      entries = result.entries;
      return true;
    },

    lookup: (merchantKey) => findMerchant(entries, merchantKey),
  };
}
