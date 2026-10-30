// Bank links and tokens on a real SQLite vault (sql.js) with the module's migrations (HU-009:
// the token is kept on the device; HU-008: a revoked link keeps no token).
import { createInMemoryVault, type InMemoryVault } from '@shared/testing';

import type { BankTokens, NewBankLink } from '../../domain/link';
import { bankMigrations } from './migrations';
import { createVaultLinkStore } from './vaultLinkStore';

const link: NewBankLink = {
  id: 'link-1',
  provider: 'banco-demo',
  consentId: 'consent-1',
  createdAt: '2026-10-29T15:00:00Z',
};
const tokens: BankTokens = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  accessExpiresAt: '2026-10-29T15:05:00Z',
};

let vault: InMemoryVault;
let store: ReturnType<typeof createVaultLinkStore>;

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('bank', bankMigrations);
  await vault.migrate();
  store = createVaultLinkStore(vault.db);
});

afterEach(() => vault.close());

it('keeps a new link active with its tokens, and lists it without them', async () => {
  await store.saveLink(link, tokens);

  expect(await store.getLinks()).toEqual([
    {
      ...link,
      status: 'active',
      lastSyncedAt: null,
      lastAttemptAt: null,
      revokedAt: null,
    },
  ]);
  expect(await store.getTokens('link-1')).toEqual(tokens);
});

it('lists the links oldest first', async () => {
  await store.saveLink(
    { ...link, id: 'link-2', consentId: 'c-2', createdAt: '2026-10-29T16:00:00Z' },
    tokens,
  );
  await store.saveLink(link, tokens);
  expect((await store.getLinks()).map((l) => l.id)).toEqual(['link-1', 'link-2']);
});

it('refuses a second link for the same consent and keeps the first one', async () => {
  await store.saveLink(link, tokens);
  await expect(
    store.saveLink({ ...link, id: 'link-2' }, { ...tokens, accessToken: 'other' }),
  ).rejects.toThrow();
  expect((await store.getLinks()).map((l) => l.id)).toEqual(['link-1']);
  expect(await store.getTokens('link-1')).toEqual(tokens);
  expect(await store.getTokens('link-2')).toBeNull();
});

it('replaces the tokens after a refresh', async () => {
  await store.saveLink(link, tokens);
  const next = {
    accessToken: 'access-2',
    refreshToken: 'refresh-2',
    accessExpiresAt: '2026-10-29T15:10:00Z',
  };
  await store.updateTokens('link-1', next);
  expect(await store.getTokens('link-1')).toEqual(next);
});

it('revokes the links of a consent and deletes their tokens (HU-008)', async () => {
  await store.saveLink(link, tokens);
  await store.saveLink({ ...link, id: 'link-2', consentId: 'c-2' }, tokens);

  const revoked = await store.revokeByConsent('consent-1', '2026-10-30T10:00:00Z');

  expect(revoked).toEqual(['link-1']);
  const [first, second] = await store.getLinks();
  expect(first).toMatchObject({
    id: 'link-1',
    status: 'revoked',
    revokedAt: '2026-10-30T10:00:00Z',
  });
  expect(second).toMatchObject({ id: 'link-2', status: 'active', revokedAt: null });
  expect(await store.getTokens('link-1')).toBeNull();
  expect(await store.getTokens('link-2')).toEqual(tokens);
  const rows = await vault.db.query('SELECT link_id FROM bank_tokens');
  expect(rows).toEqual([{ link_id: 'link-2' }]);
});

it('revokes one link by id, and a second revoke keeps the first date', async () => {
  await store.saveLink(link, tokens);
  await store.revokeLink('link-1', '2026-10-30T10:00:00Z');
  await store.revokeLink('link-1', '2026-10-31T10:00:00Z');
  expect((await store.getLinks())[0]).toMatchObject({
    status: 'revoked',
    revokedAt: '2026-10-30T10:00:00Z',
  });
  expect(await store.getTokens('link-1')).toBeNull();
});

it('does nothing for a consent that has no link', async () => {
  await store.saveLink(link, tokens);
  expect(await store.revokeByConsent('unknown', '2026-10-30T10:00:00Z')).toEqual([]);
  expect((await store.getLinks())[0]?.status).toBe('active');
});

it('never gives the tokens of a revoked link, even if a refresh lands after the revoke', async () => {
  await store.saveLink(link, tokens);
  await store.revokeByConsent('consent-1', '2026-10-30T10:00:00Z');
  await store.updateTokens('link-1', tokens);
  expect(await store.getTokens('link-1')).toBeNull();
});
