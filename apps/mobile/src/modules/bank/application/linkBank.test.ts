// The link flow on the phone (M5 link flow, steps 2 to 5): HU-009 "Flujo seguro", "Estado de
// conexión confirmado", "Errores de autenticación manejados", "El token se custodia en el
// dispositivo"; HU-030 PKCE and state.
import { ApiError } from '@shared/api';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { bankMigrations } from '../adapters/vault/migrations';
import { createVaultLinkStore } from '../adapters/vault/vaultLinkStore';
import { challengeOf } from '../domain/pkce';
import { linkBank, type LinkBankDeps } from './linkBank';
import type { BankApiPort, RemoteAccount } from './ports';

const LINK = '7d5c1c4e-2f1b-4c3a-9a55-0b1c2d3e4f50';
const AUTH = '0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';
const CONSENT = 'c0ffee00-0000-4000-8000-000000000001';
const clock = createFixedClock('2026-10-29T15:00:00Z');

const savings: RemoteAccount = {
  providerAccountId: 'acc-1',
  kind: 'savings',
  displayName: 'Banco Demo · Ahorros',
  last4: '4321',
  currency: 'COP',
  balanceMinor: 320_000_000,
  status: 'active',
  isSimulated: true,
};

// Random bytes that differ on every call, so the state and the verifier are never equal.
function counting() {
  let n = 0;
  return (length: number) => Uint8Array.from({ length }, () => n++ % 256);
}

let vault: InMemoryVault;

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('bank', bankMigrations);
  await vault.migrate();
});

afterEach(() => vault.close());

type Browser = LinkBankDeps['browser'];

function setup(overrides: { api?: Partial<BankApiPort>; browser?: Browser } = {}) {
  let sentState = '';
  let sentChallenge = '';
  const api: BankApiPort = {
    authorize: jest.fn(async (input) => {
      sentState = input.state;
      sentChallenge = input.codeChallenge;
      return {
        authorizationId: AUTH,
        authorizeUrl: 'https://auth.test/authorize?request_uri=x',
        expiresAt: '2026-10-29T15:10:00Z',
      };
    }),
    exchange: jest.fn(async () => ({
      linkId: LINK,
      provider: 'banco-demo',
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      expiresIn: 300,
    })),
    accounts: jest.fn(async () => [savings]),
    transactions: jest.fn(),
    refresh: jest.fn(),
    ...overrides.api,
  };
  const browser: Browser =
    overrides.browser ??
    jest.fn(async () => ({
      type: 'success' as const,
      url: `fynk://bank/callback?code=code-1&state=${sentState}`,
    }));
  const store = createVaultLinkStore(vault.db);
  const deps: LinkBankDeps = { api, browser, store: () => store, random: counting(), clock };
  const run = () => linkBank(deps, { provider: 'banco-demo', consentId: CONSENT });
  return { api, browser, store, run, sent: () => ({ state: sentState, challenge: sentChallenge }) };
}

it('opens the portal, checks the state, keeps the tokens in the vault and shows the accounts', async () => {
  const { api, browser, store, run, sent } = setup();

  const outcome = await run();

  expect(outcome).toEqual({ kind: 'linked', linkId: LINK, accounts: [savings] });
  expect(browser).toHaveBeenCalledWith(
    'https://auth.test/authorize?request_uri=x',
    'fynk://bank/callback',
  );
  const [, exchange] = (api.exchange as jest.Mock).mock.calls[0] as [
    string,
    { code: string; codeVerifier: string },
  ];
  expect(exchange.code).toBe('code-1');
  // The verifier sent at the exchange is the one behind the challenge sent at the start.
  expect(challengeOf(exchange.codeVerifier)).toBe(sent().challenge);
  expect(await store.getLinks()).toMatchObject([
    {
      id: LINK,
      provider: 'banco-demo',
      consentId: CONSENT,
      status: 'active',
      createdAt: '2026-10-29T15:00:00.000Z',
    },
  ]);
  expect(await store.getTokens(LINK)).toEqual({
    accessToken: 'at-1',
    refreshToken: 'rt-1',
    accessExpiresAt: '2026-10-29T15:05:00.000Z',
  });
  expect(api.accounts).toHaveBeenCalledWith(LINK, 'at-1');
});

it('shows a link with no accounts as connected, with an empty list', async () => {
  const { run } = setup({ api: { accounts: jest.fn(async () => []) } });
  expect(await run()).toEqual({ kind: 'linked', linkId: LINK, accounts: [] });
});

it('keeps the link when only the accounts query fails', async () => {
  const { run, store } = setup({
    api: { accounts: jest.fn(async () => Promise.reject(ApiError.network())) },
  });
  expect(await run()).toEqual({ kind: 'linked', linkId: LINK, accounts: null });
  expect(await store.getTokens(LINK)).not.toBeNull();
});

it('refuses a callback with another state and exchanges nothing (HU-030)', async () => {
  const { api, run, store } = setup({
    browser: jest.fn(async () => ({
      type: 'success' as const,
      url: 'fynk://bank/callback?code=stolen&state=other',
    })),
  });
  expect(await run()).toEqual({ kind: 'failed', reason: 'state_mismatch' });
  expect(api.exchange).not.toHaveBeenCalled();
  expect(await store.getLinks()).toEqual([]);
});

it('tells a closed browser from a denied authorization', async () => {
  const closed = setup({ browser: jest.fn(async () => ({ type: 'cancel' as const })) });
  expect(await closed.run()).toEqual({ kind: 'cancelled' });

  const denied = setup();
  (denied.browser as jest.Mock).mockImplementation(async () => ({
    type: 'success',
    url: `fynk://bank/callback?error=access_denied&state=${denied.sent().state}`,
  }));
  expect(await denied.run()).toEqual({ kind: 'denied' });
  expect(denied.api.exchange).not.toHaveBeenCalled();
});

it('reports a bank error in the callback', async () => {
  const s = setup();
  (s.browser as jest.Mock).mockImplementation(async () => ({
    type: 'success',
    url: `fynk://bank/callback?error=server_error&state=${s.sent().state}`,
  }));
  expect(await s.run()).toEqual({ kind: 'failed', reason: 'bank_error' });
});

it.each([
  ['authorize', 'provider_unavailable', 'unavailable'],
  ['authorize', 'network_error', 'offline'],
  ['authorize', 'device_required', 'device_required'],
  ['exchange', 'authorization_not_found', 'expired'],
  ['exchange', 'consent_already_linked', 'already_linked'],
  ['exchange', 'provider_unavailable', 'unavailable'],
  ['exchange', 'something_new', 'unknown'],
] as const)('maps %s failing with %s to %s, and stores nothing', async (step, code, reason) => {
  const error =
    code === 'network_error'
      ? ApiError.network()
      : new ApiError({ status: 409, code, title: code });
  const { run, store } = setup({ api: { [step]: jest.fn(async () => Promise.reject(error)) } });
  expect(await run()).toEqual({ kind: 'failed', reason });
  expect(await store.getLinks()).toEqual([]);
});
