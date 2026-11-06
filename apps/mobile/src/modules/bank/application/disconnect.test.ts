// "Eliminar cuenta" of a connected account revokes its consent (M4 prompt; HU-008).
import type { BankLink } from '../domain/link';
import { disconnectLink } from './disconnect';

const link = (over: Partial<BankLink> = {}): BankLink => ({
  id: 'link-1',
  provider: 'banco-demo',
  consentId: 'c-1',
  createdAt: '2026-10-29T14:00:00Z',
  status: 'active',
  lastSyncedAt: null,
  lastAttemptAt: null,
  revokedAt: null,
  ...over,
});

const setup = (links: BankLink[], answer: 'revoked' | 'cancelled' = 'revoked') => {
  const revoke = jest.fn(async () => answer);
  const deps = { links: async () => links, entityName: async () => 'Banco Demo', revoke };
  return { deps, revoke };
};

it("revokes the link's consent with the entity's name for the identity check", async () => {
  const { deps, revoke } = setup([link()]);
  await expect(disconnectLink(deps, 'link-1')).resolves.toBe('revoked');
  expect(revoke).toHaveBeenCalledWith('c-1', 'Banco Demo');
});

it('reports a cancelled identity check', async () => {
  const { deps } = setup([link()], 'cancelled');
  await expect(disconnectLink(deps, 'link-1')).resolves.toBe('cancelled');
});

it('does nothing for an unknown or already revoked link', async () => {
  const unknown = setup([link()]);
  await expect(disconnectLink(unknown.deps, 'link-9')).resolves.toBe('not_found');
  const revoked = setup([link({ status: 'revoked', revokedAt: '2026-11-01T00:00:00Z' })]);
  await expect(disconnectLink(revoked.deps, 'link-1')).resolves.toBe('revoked');
  expect(unknown.revoke).not.toHaveBeenCalled();
  expect(revoked.revoke).not.toHaveBeenCalled();
});
