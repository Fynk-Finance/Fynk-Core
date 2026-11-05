// GET /catalog/merchants against a fake server: the catalog with its ETag, If-None-Match sent
// back, and a 304 when nothing changed (contract test of the adapter).
import { createApiClient } from '@shared/api';

import { CatalogUnavailableError, createCatalogApi } from './catalogApi';

const BASE = 'https://api.test/v1';
const merchants = [
  {
    key: 'netflix',
    displayName: 'Netflix',
    category: 'subscriptions',
    isSubscription: true,
    matchPatterns: ['netflix'],
    cancelUrl: 'https://www.netflix.com/cancelplan',
    cancelSteps: ['Entra a netflix.com e inicia sesión.'],
  },
];

function server(answer: (req: Request) => Response) {
  const seen: Request[] = [];
  const client = createApiClient({
    baseUrl: BASE,
    hooks: () => ({}),
    fetch: async (req) => {
      seen.push(req);
      return answer(req);
    },
  });
  return { api: createCatalogApi(client), seen };
}

describe('catalog API', () => {
  it('downloads the catalog with its ETag', async () => {
    const { api, seen } = server(
      () =>
        new Response(JSON.stringify({ updatedAt: '2026-11-05T15:00:00Z', merchants }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ETag: '"c1"' },
        }),
    );
    expect(await api.fetch(null)).toEqual({ status: 'changed', etag: '"c1"', entries: merchants });
    expect(seen[0]!.url).toBe(`${BASE}/catalog/merchants`);
    expect(seen[0]!.headers.get('If-None-Match')).toBeNull();
  });

  it('sends the ETag it has and reads a 304 as unchanged', async () => {
    const { api, seen } = server(
      () => new Response(null, { status: 304, headers: { ETag: '"c1"' } }),
    );
    expect(await api.fetch('"c1"')).toEqual({ status: 'unchanged' });
    expect(seen[0]!.headers.get('If-None-Match')).toBe('"c1"');
  });

  it('fails on an error answer', async () => {
    const { api } = server(() => new Response(null, { status: 503 }));
    await expect(api.fetch(null)).rejects.toBeInstanceOf(CatalogUnavailableError);
  });
});
