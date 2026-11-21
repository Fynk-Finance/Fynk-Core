import { canRevoke, entityName, shortDate, sortForList, statusAt } from './consentList';

const NOW = new Date('2026-10-29T15:00:00Z');

describe('statusAt (HU-007: estado e información actualizada)', () => {
  it('keeps an active consent active before its end', () => {
    expect(statusAt({ status: 'active', expiresAt: '2027-10-29T15:00:00Z' }, NOW)).toBe('active');
  });

  it('shows an active consent past its end as expired, without waiting for the daily job', () => {
    expect(statusAt({ status: 'active', expiresAt: '2026-10-29T15:00:00Z' }, NOW)).toBe('expired');
  });

  it.each(['pending', 'revoked', 'expired', 'failed'] as const)('keeps %s as it is', (status) => {
    expect(statusAt({ status, expiresAt: '2020-01-01T00:00:00Z' }, NOW)).toBe(status);
  });
});

describe('canRevoke', () => {
  it.each([
    ['active', true],
    ['pending', true],
    ['revoked', false],
    ['expired', false],
    ['failed', false],
  ] as const)('%s → %s', (status, can) => {
    expect(canRevoke(status)).toBe(can);
  });
});

describe('shortDate', () => {
  it('writes the date in Bogotá time like Privacidad y datos', () => {
    expect(shortDate('2026-09-03T15:00:00Z')).toBe('3 sep 2026');
  });

  it('uses the Bogotá day near midnight UTC', () => {
    expect(shortDate('2026-10-28T03:00:00Z')).toBe('27 oct 2026');
  });

  it('is empty without a valid date', () => {
    expect(shortDate(undefined)).toBe('');
    expect(shortDate('not a date')).toBe('');
  });
});

describe('sortForList', () => {
  it('puts live consents first and the newest first inside each group', () => {
    const items = [
      { id: 'old-revoked', status: 'revoked' as const, createdAt: '2026-09-01T00:00:00Z' },
      { id: 'old-active', status: 'active' as const, createdAt: '2026-09-01T00:00:00Z' },
      { id: 'pending', status: 'pending' as const, createdAt: '2026-10-01T00:00:00Z' },
      { id: 'new-active', status: 'active' as const, createdAt: '2026-10-20T00:00:00Z' },
      { id: 'expired', status: 'expired' as const, createdAt: '2026-10-25T00:00:00Z' },
    ];
    expect(sortForList(items).map((c) => c.id)).toEqual([
      'new-active',
      'old-active',
      'pending',
      'expired',
      'old-revoked',
    ]);
  });
});

describe('entityName', () => {
  it('uses the name M5 lists, or the id of an entity no longer listed', () => {
    expect(entityName('banco-demo', { 'banco-demo': 'Banco Demo' })).toBe('Banco Demo');
    expect(entityName('bancolombia', {})).toBe('bancolombia');
  });
});
