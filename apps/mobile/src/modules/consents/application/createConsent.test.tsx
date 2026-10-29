import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError } from '@shared/api';

import type { Consent, ConsentProvider, ConsentText } from '../domain/consent';
import { createConsent, useCreateConsent } from './createConsent';
import type { ConsentsApiPort, ConsentsDeps } from './ports';
import { CONSENT_TEXT_QUERY_KEY, useConsentText } from './useConsentText';
import { fakeConsentsApi } from '../testing/fakeConsentsApi';

const text: ConsentText = {
  version: '2026-10-v1',
  bodyMd: '# Autorización',
  sha256: '9f2c4e0b7a1d3c5e8f6a2b4d6e8f0a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f',
  publishedAt: '2026-10-27T00:00:00Z',
  purpose: 'Mostrarte tus finanzas y recomendaciones dentro de Fynk.',
  termDays: 365,
};

const provider: ConsentProvider = {
  id: 'banco-demo',
  displayName: 'Banco Demo',
  supportedScopes: ['balances', 'transactions', 'account_details'],
};

const pending: Consent = {
  id: '01928c7e-5b1a-7c3d-9e2f-4a6b8c0d2e4f',
  provider: 'banco-demo',
  scopes: ['balances', 'transactions', 'account_details'],
  purpose: text.purpose,
  termDays: 365,
  status: 'pending',
  textVersion: '2026-10-v1',
  createdAt: '2026-10-27T15:04:05Z',
  acceptedAt: '2026-10-27T15:04:05Z',
};

function fakeDeps(create: ConsentsApiPort['create'] = async () => pending) {
  let n = 0;
  const api = fakeConsentsApi({ currentText: async () => text, create });
  const deps: ConsentsDeps = { api, appVersion: '0.1.0', newIdempotencyKey: () => `key-${++n}` };
  return { api, deps };
}

function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const newClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retryDelay: 0, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });

describe('createConsent', () => {
  it('sends what was shown with a fresh Idempotency-Key and returns the pending consent', async () => {
    const { api, deps } = fakeDeps();
    await expect(createConsent(deps, { provider, text })).resolves.toEqual(pending);
    expect(api.create).toHaveBeenCalledWith(
      {
        provider: 'banco-demo',
        scopes: ['balances', 'transactions', 'account_details'],
        purpose: text.purpose,
        termDays: 365,
        textVersion: '2026-10-v1',
        textSha256: text.sha256,
        appVersion: '0.1.0',
        locale: 'es-CO',
      },
      'key-1',
    );
  });

  it('reuses the key it is given', async () => {
    const { api, deps } = fakeDeps();
    await createConsent(deps, { provider, text, idempotencyKey: 'mine' });
    expect(api.create.mock.calls[0]![1]).toBe('mine');
  });
});

describe('useCreateConsent', () => {
  it('keeps one key for the same provider and text, so a retry records one consent', async () => {
    let fail = true;
    const { api, deps } = fakeDeps(async () => {
      if (fail) throw ApiError.network();
      return pending;
    });
    const { result } = await renderHook(() => useCreateConsent(deps), {
      wrapper: wrapperWith(newClient()),
    });

    await act(async () => {
      await result.current.submit({ provider, text }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.errorKind).toBe('network'));

    fail = false;
    let consent: Consent | undefined;
    await act(async () => {
      consent = await result.current.submit({ provider, text });
    });
    expect(consent).toEqual(pending);
    expect(api.create.mock.calls.map((c) => c[1])).toEqual(['key-1', 'key-1']);
  });

  it('uses a new key for another provider', async () => {
    const { api, deps } = fakeDeps();
    const { result } = await renderHook(() => useCreateConsent(deps), {
      wrapper: wrapperWith(newClient()),
    });
    await act(async () => {
      await result.current.submit({ provider, text });
      await result.current.submit({
        provider: { ...provider, id: 'billetera-demo' },
        text,
      });
    });
    expect(api.create.mock.calls.map((c) => c[1])).toEqual(['key-1', 'key-2']);
  });

  it.each([
    ['device_required', 'device'],
    ['invalid_scopes', 'provider'],
    ['idempotency_conflict', 'unknown'],
  ] as const)('reports %s as %s', async (code, kind) => {
    const { deps } = fakeDeps(async () => {
      throw new ApiError({ status: 422, code, title: code });
    });
    const { result } = await renderHook(() => useCreateConsent(deps), {
      wrapper: wrapperWith(newClient()),
    });
    await act(async () => {
      await result.current.submit({ provider, text }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.errorKind).toBe(kind));
  });

  it('loads the text again when it changed since it was shown', async () => {
    const client = newClient();
    const { deps } = fakeDeps(async () => {
      throw new ApiError({ status: 422, code: 'text_mismatch', title: 'Text mismatch' });
    });
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = await renderHook(() => useCreateConsent(deps), {
      wrapper: wrapperWith(client),
    });
    await act(async () => {
      await result.current.submit({ provider, text }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.errorKind).toBe('text_changed'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: CONSENT_TEXT_QUERY_KEY });
  });
});

describe('useConsentText', () => {
  it('returns the published text', async () => {
    const { api } = fakeDeps();
    const { result } = await renderHook(() => useConsentText(api).data, {
      wrapper: wrapperWith(newClient()),
    });
    await waitFor(() => expect(result.current).toEqual(text));
  });
});
