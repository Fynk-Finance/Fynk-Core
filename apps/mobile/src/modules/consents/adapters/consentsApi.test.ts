import { createApiClient, isApiError } from '@shared/api';

import type { CreateConsentRequest } from '../domain/consent';
import { createConsentsApi } from './consentsApi';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });

const SHA = '9f2c4e0b7a1d3c5e8f6a2b4d6e8f0a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f';

const request: CreateConsentRequest = {
  provider: 'banco-demo',
  scopes: ['balances', 'transactions', 'account_details'],
  purpose: 'Mostrarte tus finanzas y recomendaciones dentro de Fynk.',
  termDays: 365,
  textVersion: '2026-10-v1',
  textSha256: SHA,
  appVersion: '0.1.0',
  locale: 'es-CO',
};

function setup(response: Response) {
  const fetch = jest.fn(async (_: Request) => response);
  const client = createApiClient({
    baseUrl: 'http://api.test/v1',
    hooks: () => ({ getAccessToken: () => 'token', getDeviceId: () => 'device-1' }),
    fetch,
  });
  return { fetch, api: createConsentsApi(client) };
}

it('reads the current text with its hash, purpose and term', async () => {
  const { api, fetch } = setup(
    json(200, {
      version: '2026-10-v1',
      bodyMd: '# Autorización',
      sha256: SHA,
      publishedAt: '2026-10-27T00:00:00Z',
      purpose: 'Mostrarte tus finanzas y recomendaciones dentro de Fynk.',
      termDays: 365,
    }),
  );
  await expect(api.currentText()).resolves.toEqual({
    version: '2026-10-v1',
    bodyMd: '# Autorización',
    sha256: SHA,
    publishedAt: '2026-10-27T00:00:00Z',
    purpose: 'Mostrarte tus finanzas y recomendaciones dentro de Fynk.',
    termDays: 365,
  });
  const sent = fetch.mock.calls[0]![0];
  expect(sent.method).toBe('GET');
  expect(sent.url).toBe('http://api.test/v1/consent-texts/current');
});

it('posts the request as shown, with the Idempotency-Key and the device header', async () => {
  const { api, fetch } = setup(
    json(201, {
      id: '01928c7e-5b1a-7c3d-9e2f-4a6b8c0d2e4f',
      ...request,
      status: 'pending',
      createdAt: '2026-10-27T15:04:05Z',
      acceptedAt: '2026-10-27T15:04:05Z',
    }),
  );
  const consent = await api.create(request, 'key-1');

  expect(consent).toEqual({
    id: '01928c7e-5b1a-7c3d-9e2f-4a6b8c0d2e4f',
    provider: 'banco-demo',
    scopes: ['balances', 'transactions', 'account_details'],
    purpose: request.purpose,
    termDays: 365,
    status: 'pending',
    textVersion: '2026-10-v1',
    createdAt: '2026-10-27T15:04:05Z',
    acceptedAt: '2026-10-27T15:04:05Z',
  });
  const sent = fetch.mock.calls[0]![0];
  expect(sent.method).toBe('POST');
  expect(sent.url).toBe('http://api.test/v1/consents');
  expect(sent.headers.get('Idempotency-Key')).toBe('key-1');
  expect(sent.headers.get('X-Device-Id')).toBe('device-1');
  await expect(sent.json()).resolves.toEqual(request);
});

it('throws the problem code of a refused consent', async () => {
  const { api } = setup(
    json(422, {
      type: '/problems/device_required',
      title: 'Device required',
      status: 422,
      code: 'device_required',
    }),
  );
  const error = await api.create(request, 'key-1').catch((e: unknown) => e);
  expect(isApiError(error) && error.code).toBe('device_required');
});
