import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { BankProvider } from '../domain/provider';
import type { ProvidersPort } from './ports';
import { useProviders } from './useProviders';

const entity = (id: string): BankProvider => ({
  id,
  displayName: id,
  kind: 'bank',
  isSimulated: true,
  supportedScopes: ['balances'],
  logoKey: id,
});
const catalog = [
  entity('banco-demo'),
  entity('billetera-demo'),
  entity('banco-digital-demo'),
  entity('cooperativa-demo'),
  entity('bancolombia'),
];

const clients: QueryClient[] = [];
afterEach(() => {
  for (const c of clients.splice(0)) c.clear();
});

async function run(simulatedEntities: ProvidersPort['simulatedEntities']) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const port: ProvidersPort = { list: async () => catalog, simulatedEntities };
  return await renderHook(() => useProviders(port), { wrapper });
}

describe('useProviders', () => {
  it('lists the simulated entities of the person plus Bancolombia', async () => {
    const { result } = await run(async () => ['banco-demo', 'cooperativa-demo']);
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((p) => p.id)).toEqual([
      'banco-demo',
      'cooperativa-demo',
      'bancolombia',
    ]);
  });

  it('lists every entity when the simulated list fails, so the step never blocks', async () => {
    const { result } = await run(async () => {
      throw new Error('provider_unavailable');
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((p) => p.id)).toEqual(catalog.map((p) => p.id));
  });
});
