// Ports of the merchant catalog (SCRUM-58). The vault adapter implements CatalogCache
// (adapters/vault/vaultCatalogCache.ts); the API adapter implements CatalogApi
// (adapters/api/catalogApi.ts).
import type { IsoDateTime } from '@shared/domain/types';

import type { CatalogEntry } from '../domain/catalog';

export interface CachedCatalog {
  etag: string;
  entries: CatalogEntry[];
  fetchedAt: IsoDateTime;
}

export interface CatalogCache {
  get(): Promise<CachedCatalog | null>;
  save(catalog: CachedCatalog): Promise<void>;
  /** The copy is still current: only the time of the check changes. */
  touch(fetchedAt: IsoDateTime): Promise<void>;
}

export type CatalogDownload =
  { status: 'unchanged' } | { status: 'changed'; etag: string; entries: CatalogEntry[] };

export interface CatalogApi {
  /** GET /catalog/merchants with If-None-Match. */
  fetch(etag: string | null): Promise<CatalogDownload>;
}
