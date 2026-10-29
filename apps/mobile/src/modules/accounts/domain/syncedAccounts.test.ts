import { card, cash, cdt, savings } from '../testing/fixtures';
import { bogotaDate, cleanSyncedAccounts, InvalidSyncedAccountError } from './syncedAccounts';

describe('cleanSyncedAccounts', () => {
  it('keeps one account per provider and provider account id, the last one wins', () => {
    const newer = { ...savings, id: 'other-id', balanceMinor: 1 };
    expect(cleanSyncedAccounts([savings, card, newer])).toEqual([card, newer]);
  });

  it('keeps accounts with the same provider account id at different providers', () => {
    const other = { ...savings, id: 'x', provider: 'bancolombia' as const };
    expect(cleanSyncedAccounts([savings, other])).toHaveLength(2);
  });

  it('stores only the last 4 digits of the number', () => {
    const [clean] = cleanSyncedAccounts([{ ...card, last4: '4532015112833312' }]);
    expect(clean?.last4).toBe('3312');
  });

  it('accepts a CDT with its details', () => {
    expect(cleanSyncedAccounts([cdt])).toEqual([cdt]);
  });

  it.each([
    ['cash', cash],
    ['a manual account', { ...savings, provider: 'manual' as const }],
    ['no provider account id', { ...savings, providerAccountId: null }],
    ['no link', { ...savings, linkId: null }],
    ['a float amount', { ...savings, balanceMinor: 10.5 }],
    ['a float limit', { ...card, creditLimitMinor: 1.2 }],
    ['a CDT without details', { ...cdt, cdt: null }],
  ])('rejects %s', (_, bad) => {
    expect(() => cleanSyncedAccounts([savings, bad])).toThrow(InvalidSyncedAccountError);
  });
});

describe('bogotaDate', () => {
  it('uses the day in Bogotá, 5 hours behind UTC', () => {
    expect(bogotaDate(new Date('2026-10-28T04:59:00Z'))).toBe('2026-10-27');
    expect(bogotaDate(new Date('2026-10-28T05:00:00Z'))).toBe('2026-10-28');
  });
});
