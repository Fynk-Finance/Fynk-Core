import type { Consent } from '../domain/consent';
import { createRevocation } from './revocation';

const revoked: Consent = {
  id: 'c-1',
  provider: 'banco-demo',
  scopes: ['balances'],
  purpose: 'Mostrarte tus finanzas y recomendaciones dentro de Fynk.',
  termDays: 365,
  status: 'revoked',
  textVersion: '2026-10-v1',
  createdAt: '2026-10-01T00:00:00Z',
  acceptedAt: '2026-10-01T00:00:00Z',
  revokedAt: '2026-10-29T15:00:00Z',
};

const setup = () => {
  const api = { revoke: jest.fn(async () => revoked) };
  return { api, revocation: createRevocation(api) };
};

describe('revokeConsent (HU-008)', () => {
  it('revokes through the API and returns the revoked consent', async () => {
    const { api, revocation } = setup();
    await expect(revocation.revokeConsent('c-1')).resolves.toEqual(revoked);
    expect(api.revoke).toHaveBeenCalledWith('c-1');
  });

  it('tells every listener, so M5 can delete the link token', async () => {
    const { revocation } = setup();
    const a = jest.fn();
    const b = jest.fn();
    revocation.onConsentRevoked(a);
    revocation.onConsentRevoked(b);
    await revocation.revokeConsent('c-1');
    const event = { consentId: 'c-1', provider: 'banco-demo', revokedAt: '2026-10-29T15:00:00Z' };
    expect(a).toHaveBeenCalledWith(event);
    expect(b).toHaveBeenCalledWith(event);
  });

  it('keeps the revocation when a listener fails', async () => {
    const { revocation } = setup();
    const after = jest.fn();
    revocation.onConsentRevoked(() => Promise.reject(new Error('vault locked')));
    revocation.onConsentRevoked(after);
    await expect(revocation.revokeConsent('c-1')).resolves.toEqual(revoked);
    expect(after).toHaveBeenCalled();
  });

  it('stops telling a listener that unsubscribed', async () => {
    const { revocation } = setup();
    const listener = jest.fn();
    const off = revocation.onConsentRevoked(listener);
    off();
    await revocation.revokeConsent('c-1');
    expect(listener).not.toHaveBeenCalled();
  });

  it('tells nobody when the API refuses', async () => {
    const api = { revoke: jest.fn(async () => Promise.reject(new Error('409'))) };
    const revocation = createRevocation(api);
    const listener = jest.fn();
    revocation.onConsentRevoked(listener);
    await expect(revocation.revokeConsent('c-1')).rejects.toThrow('409');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('identity check', () => {
  const request = { reason: 'revoke_consent' as const, entity: 'Banco Demo' };

  it('passes while no check is installed, and says so', async () => {
    const { revocation } = setup();
    expect(revocation.hasIdentityCheck()).toBe(false);
    await expect(revocation.checkIdentity(request)).resolves.toBe(true);
  });

  it('uses the check M1 or M2 install, which can refuse', async () => {
    const { revocation } = setup();
    const check = jest.fn(async () => false);
    revocation.installIdentityCheck(check);
    expect(revocation.hasIdentityCheck()).toBe(true);
    await expect(revocation.checkIdentity(request)).resolves.toBe(false);
    expect(check).toHaveBeenCalledWith(request);
  });
});
