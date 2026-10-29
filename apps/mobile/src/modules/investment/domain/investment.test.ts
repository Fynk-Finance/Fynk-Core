import { formatCop, type Account } from '@shared/domain';

import { investmentStrings } from '../ui/strings.es-CO';
import {
  chartPoints,
  estimatedInterestMinor,
  exploreCatalog,
  formatChangeBps,
  formatRate,
  formatUsdCents,
  holdingsFrom,
  parseDaysInput,
  parseRateInput,
  portfolioSummary,
  termLabel,
  type CdtProduct,
} from './investment';

const cdt = (over: Partial<Account> & { cdt: Account['cdt'] }): Account => ({
  id: 'acc-cdt',
  provider: 'banco-demo',
  providerAccountId: 'p',
  linkId: 'l',
  kind: 'cdt',
  displayName: 'CDT Banco Demo',
  last4: '7701',
  currency: 'COP',
  balanceMinor: 200_000_000,
  availableMinor: null,
  creditLimitMinor: null,
  paymentDueOn: null,
  status: 'active',
  isSimulated: true,
  lastSyncedAt: null,
  ...over,
});

describe('calculator (HU-049)', () => {
  it('gives $50.471 for $1.000.000 at 10,50 % E.A. for 180 days', () => {
    expect(formatCop(estimatedInterestMinor(100_000_000, 1050, 180))).toBe('$50.471');
  });

  it('gives zero for an empty amount, rate or term', () => {
    expect(estimatedInterestMinor(0, 1050, 180)).toBe(0);
    expect(estimatedInterestMinor(100_000_000, 0, 180)).toBe(0);
  });

  it('parses what the person types', () => {
    expect(parseRateInput('10,5')).toBe(1050);
    expect(parseRateInput('10.50 %')).toBe(1050);
    expect(parseRateInput('abc')).toBeNull();
    expect(parseDaysInput('180')).toBe(180);
    expect(parseDaysInput('0')).toBeNull();
  });
});

describe('own CDTs', () => {
  const accounts = [
    cdt({
      cdt: { rateEaBps: 1050, termDays: 180, openedOn: '2026-08-27', maturesOn: '2027-02-27' },
    }),
    cdt({
      id: 'acc-cdt-2',
      balanceMinor: 100_000_000,
      cdt: { rateEaBps: 1200, termDays: 90, openedOn: '2026-10-01', maturesOn: '2026-12-30' },
    }),
    cdt({
      id: 'closed',
      status: 'closed',
      cdt: { rateEaBps: 900, termDays: 90, openedOn: '2026-01-01', maturesOn: '2026-04-01' },
    }),
    { ...cdt({ cdt: null }), id: 'savings', kind: 'savings' as const },
  ];

  it('keeps active CDTs only, next maturity first', () => {
    expect(holdingsFrom(accounts).map((h) => h.id)).toEqual(['acc-cdt-2', 'acc-cdt']);
  });

  it('totals the CDTs, weights the rate by amount and finds the next maturity', () => {
    const s = portfolioSummary(holdingsFrom(accounts), '2026-10-28');
    expect(s.totalMinor).toBe(300_000_000);
    expect(s.averageRateBps).toBe(1100); // (2M·10,50 + 1M·12,00) / 3M
    expect(s.nextMaturity).toBe('2026-12-30');
    // 2026 interest: 2M for 127 days at 10,50 % + 1M for 90 days at 12 %.
    expect(s.yearInterestMinor).toBe(
      estimatedInterestMinor(200_000_000, 1050, 127) +
        estimatedInterestMinor(100_000_000, 1200, 90),
    );
  });

  it('has no rate and no maturity without CDTs', () => {
    expect(portfolioSummary([], '2026-10-28')).toMatchObject({
      totalMinor: 0,
      averageRateBps: null,
      nextMaturity: null,
    });
  });
});

describe('Explorar: the same list for everyone, ordered as the person chooses', () => {
  const catalog: CdtProduct[] = [
    {
      id: '360',
      name: 'CDT Digital Banco Demo 360 Días',
      issuer: 'Banco Demo',
      termDays: 360,
      rateEaBps: 1085,
      minAmountMinor: 100_000_000,
      risk: 'low',
      simulated: true,
    },
    {
      id: '90',
      name: 'CDT Digital Banco Demo 90 Días',
      issuer: 'Banco Demo',
      termDays: 90,
      rateEaBps: 1015,
      minAmountMinor: 50_000_000,
      risk: 'low',
      simulated: true,
    },
    {
      id: '180',
      name: 'CDT Digital Banco Demo 180 Días',
      issuer: 'Banco Demo',
      termDays: 180,
      rateEaBps: 1050,
      minAmountMinor: 50_000_000,
      risk: 'low',
      simulated: true,
    },
  ];
  const none = { termDays: null, risk: null };

  it('sorts by name by default, and by rate or term when the person asks', () => {
    expect(exploreCatalog(catalog, none, 'name').map((p) => p.id)).toEqual(['180', '360', '90']);
    expect(exploreCatalog(catalog, none, 'rate').map((p) => p.id)).toEqual(['360', '180', '90']);
    expect(exploreCatalog(catalog, none, 'term').map((p) => p.id)).toEqual(['90', '180', '360']);
  });

  it('filters by the term and risk the person picks', () => {
    expect(exploreCatalog(catalog, { termDays: 180, risk: null }, 'name').map((p) => p.id)).toEqual(
      ['180'],
    );
    expect(exploreCatalog(catalog, { termDays: null, risk: 'high' }, 'name')).toEqual([]);
  });

  it('cannot receive a balance: the signature takes only the catalog and the choices', () => {
    expect(exploreCatalog.length).toBe(3);
  });
});

describe('formatting', () => {
  it('formats rates, terms, dollars and changes', () => {
    expect(formatRate(1050)).toBe('10,50 % E.A.');
    expect(termLabel(180)).toBe('6 meses');
    expect(termLabel(45)).toBe('45 días');
    expect(formatUsdCents(122_750)).toBe('US$1.227,50');
    expect(formatChangeBps(125)).toBe('+1,25 %');
    expect(formatChangeBps(-244)).toBe('-2,44 %');
  });

  it('cuts the chart to the period', () => {
    const history = [
      { date: '2025-09-01', balanceMinor: 1 },
      { date: '2026-08-01', balanceMinor: 2 },
      { date: '2026-10-20', balanceMinor: 3 },
    ];
    expect(chartPoints(history, '1M', '2026-10-28').map((p) => p.balanceMinor)).toEqual([3]);
    expect(chartPoints(history, '3M', '2026-10-28')).toHaveLength(2);
    expect(chartPoints(history, 'Todo', '2026-10-28')).toHaveLength(3);
  });
});

describe('wording (Decreto 2555)', () => {
  it('never suggests that a product suits the person', () => {
    // Every string of strings.es-CO.ts, including the text inside its template functions.
    const texts: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === 'string') texts.push(v);
      else if (typeof v === 'function') texts.push(v.toString());
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(investmentStrings);
    const source = texts.join('\n').toLowerCase();
    expect(source).toContain('no es una recomendación ni asesoría de inversión');
    for (const phrase of [
      'recomendado',
      'ideal para ti',
      'te conviene',
      'según tu perfil',
      'puedes invertir',
      'deberías',
      'mejor opción',
    ]) {
      expect(source).not.toContain(phrase);
    }
  });
});
