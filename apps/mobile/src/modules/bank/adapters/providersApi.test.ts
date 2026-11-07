import { createApiClient, isApiError } from '@shared/api';

import { createProvidersApi } from './providersApi';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });

function setup(response: Response) {
  const fetch = jest.fn(async (_: Request) => response);
  const client = createApiClient({
    baseUrl: 'http://api.test/v1',
    hooks: () => ({ getAccessToken: () => 'token' }),
    fetch,
  });
  return { fetch, api: createProvidersApi(client) };
}

it('maps GET /providers in the order the API gives', async () => {
  const { api, fetch } = setup(
    json(200, {
      items: [
        {
          id: 'banco-demo',
          displayName: 'Banco Demo',
          kind: 'bank',
          isSimulated: true,
          supportedScopes: ['balances', 'transactions', 'account_details'],
          logoKey: 'banco-demo',
        },
        {
          id: 'billetera-demo',
          displayName: 'Billetera Demo',
          kind: 'wallet',
          isSimulated: true,
          supportedScopes: ['balances'],
          logoKey: 'billetera-demo',
        },
      ],
    }),
  );
  const providers = await api.list();
  expect(providers.map((p) => [p.id, p.kind, p.isSimulated, p.supportedScopes])).toEqual([
    ['banco-demo', 'bank', true, ['balances', 'transactions', 'account_details']],
    ['billetera-demo', 'wallet', true, ['balances']],
  ]);
  const sent = fetch.mock.calls[0]![0];
  expect(sent.method).toBe('GET');
  expect(sent.url).toBe('http://api.test/v1/providers');
});

it('throws the problem code of a failed call', async () => {
  const { api } = setup(
    json(401, {
      type: '/problems/unauthorized',
      title: 'Unauthorized',
      status: 401,
      code: 'unauthorized',
    }),
  );
  const error = await api.list().catch((e: unknown) => e);
  expect(isApiError(error) && error.code).toBe('unauthorized');
});

it('reads the simulated entities of the person from GET /bank/simulated-entities', async () => {
  const { api, fetch } = setup(json(200, { providerIds: ['banco-demo', 'cooperativa-demo'] }));
  expect(await api.simulatedEntities()).toEqual(['banco-demo', 'cooperativa-demo']);
  const sent = fetch.mock.calls[0]![0];
  expect(sent.method).toBe('GET');
  expect(sent.url).toBe('http://api.test/v1/bank/simulated-entities');
});

it('throws the problem code when the simulator is not available', async () => {
  const { api } = setup(
    json(503, {
      type: '/problems/provider_unavailable',
      title: 'Service Unavailable',
      status: 503,
      code: 'provider_unavailable',
    }),
  );
  const error = await api.simulatedEntities().catch((e: unknown) => e);
  expect(isApiError(error) && error.code).toBe('provider_unavailable');
});
