// Detection on the shared 12 month fixture of M16 and on small hand-made cases (SCRUM-55).
import type { CategoryId, Transaction } from '@shared/domain/types';

import { detectRecurring, MIN_SCORE, type CatalogMerchant, type DetectInput } from './detect';
import { MON_TO_FRI, WEEKDAY } from './types';

// The fixture lives outside the app; read it with Node's fs (the app has no Node types).
declare const __dirname: string;
const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');
const { join } = jest.requireActual<{ join(...parts: string[]): string }>('path');
const fixture = JSON.parse(
  readFileSync(join(__dirname, '../../../../../../fixtures/demo-user.json'), 'utf8'),
) as { transactions: Transaction[] };

const pesos = (n: number) => n * 100;

// What the merchant catalog will say about the fixture's merchants.
const catalogEntries: Record<string, CatalogMerchant> = {
  'streaming video': { displayName: 'Streaming de video', isSubscription: true },
  'streaming series': { displayName: 'Streaming de series', isSubscription: true },
  'streaming musica': { displayName: 'Música', isSubscription: true },
  'nube nube': { displayName: 'Almacenamiento', isSubscription: true },
  inmobiliaria: { displayName: 'Arriendo', isSubscription: false },
  'empresa de servicios': { displayName: 'Servicios públicos', isSubscription: false },
};

const base = (over: Partial<DetectInput> = {}): DetectInput => ({
  transactions: fixture.transactions,
  catalog: (key) => catalogEntries[key] ?? null,
  knownMerchantKeys: new Set(),
  dismissed: new Map(),
  today: '2026-10-28',
  ...over,
});

let n = 0;
function tx(
  merchantKey: string,
  bookedAt: string,
  amount: number,
  categoryId: CategoryId = 'subscriptions',
): Transaction {
  n += 1;
  return {
    id: `t${n}`,
    accountId: 'acc-card',
    providerTxId: `t${n}`,
    source: 'bank',
    bookedAt,
    amountMinor: -pesos(amount),
    description: merchantKey.toUpperCase(),
    merchantRaw: merchantKey.toUpperCase(),
    merchantKey,
    categoryId,
    categorySource: 'bank',
    status: 'booked',
    goalId: null,
  };
}

/** Monthly charges at 15:00 UTC on `day` of each month, from `from` (YYYY-MM) for `count` months. */
function monthly(
  key: string,
  from: string,
  count: number,
  amount: number,
  day = 10,
  cat?: CategoryId,
) {
  const [y, m] = from.split('-').map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 + i, day, 15));
    return tx(key, d.toISOString(), amount, cat);
  });
}

describe('detectRecurring on the 12 month demo fixture', () => {
  const proposals = detectRecurring(base());
  const byKey = new Map(proposals.map((p) => [p.merchantKey, p]));

  it('finds every seeded recurring charge and no one off purchase', () => {
    expect([...byKey.keys()].sort()).toEqual([
      'empresa de servicios',
      'gimnasio',
      'inmobiliaria',
      'nube nube',
      'streaming musica',
      'streaming series',
      'streaming video',
      'transporte urbano',
    ]);
  });

  it('leaves out irregular spending, a few big purchases and moves between own accounts', () => {
    for (const key of [
      'cafe y antojos',
      'restaurante',
      'supermercado',
      'tienda',
      'billetera',
      'banco',
    ]) {
      expect(byKey.has(key)).toBe(false);
    }
  });

  it('finds the utilities bill although its amount changes every month', () => {
    const bill = byKey.get('empresa de servicios')!;
    expect(bill.kind).toBe('fixed');
    expect(bill.categoryId).toBe('utilities');
    expect(bill.schedule).toEqual({ periodicity: 'monthly', anchorDay: 26 });
  });

  it('reads the rhythm of Billetera: rent on day 1, the gym every Monday, transport Monday to Friday', () => {
    expect(byKey.get('inmobiliaria')).toMatchObject({
      name: 'Arriendo',
      kind: 'fixed',
      amountMinor: pesos(1_400_000),
      schedule: { periodicity: 'monthly', anchorDay: 1 },
      nextChargeOn: '2026-11-01',
    });
    expect(byKey.get('gimnasio')).toMatchObject({
      amountMinor: pesos(22_250),
      schedule: { periodicity: 'weekly', weekdaysMask: WEEKDAY.mon },
      nextChargeOn: '2026-11-02',
    });
    expect(byKey.get('transporte urbano')).toMatchObject({
      amountMinor: pesos(6_500),
      schedule: { periodicity: 'daily', weekdaysMask: MON_TO_FRI },
      nextChargeOn: '2026-10-28',
    });
  });

  it('marks the four streaming and storage services as subscriptions with their card or account', () => {
    const video = byKey.get('streaming video')!;
    expect(video).toMatchObject({
      name: 'Streaming de video',
      kind: 'subscription',
      amountMinor: pesos(38_900),
      nextChargeOn: '2026-10-28',
    });
    expect(video.accountId).toMatch(/^acc-card/);
    const subs = proposals.filter((p) => p.kind === 'subscription').map((p) => p.amountMinor);
    expect(subs.reduce((a, b) => a + b, 0)).toBe(pesos(112_600)); // 4 activas · $112.600/mes
  });

  it('scores every proposal at or above the minimum and lists the movements behind it', () => {
    for (const p of proposals) {
      expect(p.score).toBeGreaterThanOrEqual(MIN_SCORE);
      expect(p.transactionIds.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('does not propose merchants that already have an item', () => {
    const again = detectRecurring(
      base({ knownMerchantKeys: new Set(['inmobiliaria', 'gimnasio']) }),
    );
    expect(again.map((p) => p.merchantKey)).not.toContain('inmobiliaria');
    expect(again).toHaveLength(6);
  });
});

describe('detectRecurring rules', () => {
  const only = (transactions: Transaction[], over: Partial<DetectInput> = {}) =>
    detectRecurring(base({ transactions, catalog: () => null, ...over }));

  it('needs 3 charges, or 2 when the catalog knows the merchant is a subscription', () => {
    const two = monthly('cine plus', '2026-08', 2, 19_900);
    expect(only(two)).toEqual([]);
    const known = only(two, {
      catalog: () => ({ displayName: 'Cine Plus', isSubscription: true }),
    });
    expect(known).toEqual([expect.objectContaining({ name: 'Cine Plus', kind: 'subscription' })]);
  });

  it('rejects a subscription whose amount jumps around, but accepts ± 35 % on utilities', () => {
    const amounts = [30_000, 40_000, 26_000, 38_000, 31_000];
    const jumpy = amounts.map((a, i) => tx('club', `2026-0${i + 5}-10T15:00:00Z`, a));
    expect(only(jumpy)).toEqual([]);
    const water = amounts.map((a, i) => tx('agua', `2026-0${i + 5}-10T15:00:00Z`, a, 'utilities'));
    expect(only(water)).toEqual([expect.objectContaining({ merchantKey: 'agua', kind: 'fixed' })]);
  });

  it('keeps the 31st on the last day of shorter months for the next charge', () => {
    const on31 = [
      tx('seguro', '2026-07-31T15:00:00Z', 50_000, 'health'),
      tx('seguro', '2026-08-31T15:00:00Z', 50_000, 'health'),
      tx('seguro', '2026-09-30T15:00:00Z', 50_000, 'health'),
      tx('seguro', '2026-10-31T15:00:00Z', 50_000, 'health'),
    ];
    const [p] = only(on31, { today: '2026-11-01' });
    expect(p?.schedule).toEqual({ periodicity: 'monthly', anchorDay: 31 });
    expect(p?.nextChargeOn).toBe('2026-11-30');
  });

  it('uses the most recent charge as the amount', () => {
    const rising = [
      ...monthly('nube', '2026-06', 4, 23_900),
      tx('nube', '2026-10-10T15:00:00Z', 26_900),
    ];
    expect(only(rising)[0]?.amountMinor).toBe(pesos(26_900));
  });

  it('does not propose a payment that stopped two periods ago', () => {
    const stopped = monthly('revista', '2026-01', 6, 15_000); // last charge in June
    expect(only(stopped)).toEqual([]);
  });

  it('does not bring back a dismissed proposal unless the amount changes by more than 30 %', () => {
    const charges = monthly('periodico', '2026-06', 5, 20_000);
    expect(only(charges, { dismissed: new Map([['periodico', pesos(20_000)]]) })).toEqual([]);
    expect(only(charges, { dismissed: new Map([['periodico', pesos(15_000)]]) })).toHaveLength(1);
  });

  it('ignores money in, pending movements and transfers between own accounts', () => {
    const income = monthly('empresa', '2026-06', 5, 5_200_000).map((t) => ({
      ...t,
      amountMinor: -t.amountMinor,
    }));
    const pending = monthly('app', '2026-06', 5, 9_900).map((t) => ({
      ...t,
      status: 'pending' as const,
    }));
    const transfers = monthly('bolsillo', '2026-06', 5, 200_000, 10, 'transfers');
    expect(only([...income, ...pending, ...transfers])).toEqual([]);
  });

  it('finds a biweekly charge', () => {
    const days = [
      '2026-08-07',
      '2026-08-21',
      '2026-09-04',
      '2026-09-18',
      '2026-10-02',
      '2026-10-16',
    ];
    const lessons = days.map((d) => tx('clases', `${d}T15:00:00Z`, 80_000, 'education'));
    expect(only(lessons)).toEqual([
      expect.objectContaining({
        schedule: { periodicity: 'biweekly', anchorDate: '2026-10-16' },
        nextChargeOn: '2026-10-30',
      }),
    ]);
  });

  it('uses the calendar day in Bogotá: a charge at 02:00 UTC belongs to the day before', () => {
    const late = ['2026-07-02', '2026-08-02', '2026-09-02', '2026-10-02'].map((d) =>
      tx('tarde', `${d}T02:00:00Z`, 10_000),
    );
    expect(only(late)[0]?.schedule).toEqual({ periodicity: 'monthly', anchorDay: 1 });
  });
});
