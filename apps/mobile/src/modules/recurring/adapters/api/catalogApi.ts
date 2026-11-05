// GET /catalog/merchants with the shared API client. A 304 means the phone's copy is current.
import { api } from '@shared/api';

import type { CatalogApi } from '../../application/catalogPorts';

export class CatalogUnavailableError extends Error {
  constructor(status: number) {
    super(`The merchant catalog answered ${status}`);
    this.name = 'CatalogUnavailableError';
  }
}

export function createCatalogApi(client = api): CatalogApi {
  return {
    async fetch(etag) {
      const { data, response } = await client.GET('/catalog/merchants', {
        params: { header: etag ? { 'If-None-Match': etag } : {} },
      });
      if (response.status === 304) return { status: 'unchanged' };
      if (!response.ok || !data) throw new CatalogUnavailableError(response.status);
      return {
        status: 'changed',
        etag: response.headers.get('ETag') ?? '',
        entries: data.merchants.map((m) => ({
          key: m.key,
          displayName: m.displayName,
          category: m.category,
          isSubscription: m.isSubscription,
          matchPatterns: m.matchPatterns,
          cancelUrl: m.cancelUrl ?? null,
          cancelSteps: m.cancelSteps,
        })),
      };
    },
  };
}
