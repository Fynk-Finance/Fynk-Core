import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Consent } from '../domain/consent';
import { fakeConsentsApi } from '../testing/fakeConsentsApi';
import { createRevocation } from './revocation';
import { useConsent, useConsents, useEntityNames, useRevokeConsent } from './useConsents';

const active: Consent = {
  id: 'c-1',
  provider: 'banco-demo',
  scopes: ['balances', 'transactions', 'account_details'],
  purpose: 'Mostrarte tus finanzas y recomendaciones dentro de Fynk.',
  termDays: 365,
  status: 'active',
  textVersion: '2026-10-v1',
  createdAt: '2026-10-01T00:00:00Z',
  acceptedAt: '2026-10-01T00:00:00Z',
  grantedAt: '2026-10-01T00:01:00Z',
  expiresAt: '2027-10-01T00:01:00Z',
};
const revoked: Consent = { ...active, status: 'revoked', revokedAt: '2026-10-29T15:00:00Z' };

function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
const newClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 }, mutations: { gcTime: Infinity } },
  });

it('lists the consents and fetches them again each time a screen shows them (HU-007)', async () => {
  const api = fakeConsentsApi({ list: async () => [active] });
  const client = newClient();
  const first = await renderHook(() => useConsents(api).data, { wrapper: wrapperWith(client) });
  await waitFor(() => expect(first.result.current).toEqual([active]));
  await renderHook(() => useConsents(api).data, { wrapper: wrapperWith(client) });
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
});

it('reads one consent and the entity names', async () => {
  const api = fakeConsentsApi({
    get: async () => active,
    entityNames: async () => ({ 'banco-demo': 'Banco Demo' }),
  });
  const { result } = await renderHook(
    () => ({ one: useConsent(api, 'c-1').data, names: useEntityNames(api).data }),
    { wrapper: wrapperWith(newClient()) },
  );
  await waitFor(() => expect(result.current.one).toEqual(active));
  await waitFor(() => expect(result.current.names).toEqual({ 'banco-demo': 'Banco Demo' }));
  expect(api.get).toHaveBeenCalledWith('c-1');
});

it('shows the revoked status in the list and the detail at once (HU-008)', async () => {
  let current = [active];
  const api = fakeConsentsApi({
    list: async () => current,
    get: async () => current[0]!,
    revoke: async () => {
      current = [revoked];
      return revoked;
    },
  });
  const revocation = createRevocation(api);
  const { result } = await renderHook(
    () => ({
      list: useConsents(api).data,
      one: useConsent(api, 'c-1').data,
      revoke: useRevokeConsent(revocation),
    }),
    { wrapper: wrapperWith(newClient()) },
  );
  await waitFor(() => expect(result.current.list).toEqual([active]));

  await act(async () => {
    await result.current.revoke.mutateAsync('c-1');
  });
  await waitFor(() => expect(result.current.list?.[0]?.status).toBe('revoked'));
  await waitFor(() => expect(result.current.one?.status).toBe('revoked'));
});
