// HU-008 on the phone: when M4 revokes a consent, M5 forgets the link's bank token at once.
import { createFixedClock } from '@shared/testing';

import { revokeLinksOfConsent } from './linkRevocation';
import type { LinkStore } from './ports';

const clock = createFixedClock('2026-10-30T10:00:00Z');

function storeWith(revoked: string[]) {
  return { revokeByConsent: jest.fn(async () => revoked) } satisfies Pick<
    LinkStore,
    'revokeByConsent'
  >;
}

it('revokes the links of the consent at the time the API gave', async () => {
  const store = storeWith(['link-1']);
  const ids = await revokeLinksOfConsent(
    { store: () => store, clock },
    { consentId: 'consent-1', provider: 'banco-demo', revokedAt: '2026-10-30T09:59:00Z' },
  );
  expect(store.revokeByConsent).toHaveBeenCalledWith('consent-1', '2026-10-30T09:59:00Z');
  expect(ids).toEqual(['link-1']);
});

it('uses the clock when the API gave no time', async () => {
  const store = storeWith([]);
  await revokeLinksOfConsent(
    { store: () => store, clock },
    { consentId: 'consent-1', provider: 'banco-demo', revokedAt: undefined },
  );
  expect(store.revokeByConsent).toHaveBeenCalledWith('consent-1', '2026-10-30T10:00:00.000Z');
});

it('fails when the vault is locked, so M4 knows the token was not deleted yet', async () => {
  const locked = () => {
    throw new Error('The vault is locked');
  };
  await expect(
    revokeLinksOfConsent(
      { store: locked, clock },
      { consentId: 'consent-1', provider: 'banco-demo', revokedAt: undefined },
    ),
  ).rejects.toThrow('locked');
});
