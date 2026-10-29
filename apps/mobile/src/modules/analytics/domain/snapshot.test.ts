import type { Transaction } from '@shared/domain';

import demoUser from '../../../../../../fixtures/demo-user.json';

import { DESIGN_TODAY, designInputs } from '../testing/designFixture';
import { cop } from '../testing/txFactory';
import { buildSnapshot, snapshotDataRange } from './snapshot';

const ALLOWED_KEYS = [
  'schemaVersion',
  'periodEnd',
  'months',
  'monthlyIncomeMinor',
  'monthlySpendMinor',
  'spendByCategory',
  'recurringIncome',
  'fixedExpensesMonthlyMinor',
  'subscriptions',
  'goals',
  'caps',
  'opportunities',
];

describe('buildSnapshot (shared contracts 3.5)', () => {
  const snapshot = buildSnapshot(designInputs(), DESIGN_TODAY);

  it('has exactly the fields of the contract and 12 months, oldest first', () => {
    expect(Object.keys(snapshot).sort()).toEqual([...ALLOWED_KEYS].sort());
    expect(snapshot.monthlyIncomeMinor).toHaveLength(12);
    expect(snapshot.monthlySpendMinor).toHaveLength(12);
    expect(snapshot.monthlyIncomeMinor.slice(-4)).toEqual([
      cop(5_580_000),
      cop(5_580_000),
      cop(5_580_000),
      0,
    ]);
    expect(snapshot.monthlySpendMinor.at(-1)).toBe(cop(195_000 + 400_000));
  });

  it('carries the numbers of Recomendaciones', () => {
    expect(snapshot.spendByCategory).toContainEqual({
      categoryId: 'restaurants',
      last30dMinor: cop(195_000),
      prev30dMinor: cop(150_000),
    });
    expect(snapshot.subscriptions).toEqual({
      count: 4,
      monthlyMinor: cop(112_600),
      lowUseCount: 2,
      lowUseMonthlyMinor: cop(56_800),
    });
    expect(snapshot.opportunities).toEqual([
      {
        factKey: 'subscriptions.low_use',
        kind: 'subscriptions',
        categoryId: 'subscriptions',
        monthlyMinor: cop(56_800),
      },
      {
        factKey: 'category_increase.restaurants',
        kind: 'category_increase',
        categoryId: 'restaurants',
        monthlyMinor: cop(45_000),
      },
      {
        factKey: 'payday_contribution',
        kind: 'payday_contribution',
        categoryId: 'savings',
        monthlyMinor: cop(300_000),
      },
    ]);
    expect(snapshot.recurringIncome).toEqual([{ kind: 'salary', monthlyMinor: cop(5_580_000) }]);
    expect(snapshot.goals).toEqual([
      {
        ref: 'goal_1',
        categoryId: 'savings',
        targetMinor: cop(800_000),
        savedMinor: cop(520_000),
        monthsLeft: 2,
        onTrack: true,
      },
    ]);
    expect(snapshot.caps).toEqual([
      { categoryId: 'restaurants', period: 'week', capMinor: cop(200_000), spentMinor: 0 },
    ]);
  });

  it('never contains merchant names, goal names, ids or descriptions', () => {
    const json = JSON.stringify(snapshot).toLowerCase();
    const inputs = designInputs();
    const forbidden = [
      ...inputs.transactions.flatMap((t) => [
        t.id,
        t.description,
        t.merchantRaw,
        t.merchantKey,
        t.accountId,
      ]),
      ...inputs.goals.flatMap((g) => [g.id, g.name]),
      ...inputs.caps.map((c) => c.id),
      inputs.payday?.goalName,
    ].filter((s): s is string => typeof s === 'string' && s.length > 0);
    for (const value of forbidden) expect(json).not.toContain(value.toLowerCase());
  });

  it('is the same for the same input (deterministic)', () => {
    expect(JSON.stringify(buildSnapshot(designInputs(), DESIGN_TODAY))).toBe(
      JSON.stringify(snapshot),
    );
  });

  it('states the range of the data it used', () => {
    expect(snapshotDataRange(snapshot)).toEqual({ from: '2025-11-01', to: '2026-10-28' });
  });
});

describe('buildSnapshot with the shared demo user (fixtures/demo-user.json)', () => {
  const fixture = demoUser as unknown as {
    accounts: { id: string; name: string; mask: string }[];
    transactions: Transaction[];
  };

  const snapshot = buildSnapshot(
    {
      transactions: fixture.transactions,
      subscriptions: null,
      fixedExpensesMonthlyMinor: 0,
      goals: [],
      caps: [],
      payday: null,
    },
    '2026-10-28',
  );

  it('keeps integer centavos everywhere', () => {
    const numbers = JSON.stringify(snapshot).match(/-?\d+(\.\d+)?/g) ?? [];
    expect(numbers.every((n) => !n.includes('.'))).toBe(true);
  });

  it('leaks no merchant, description, account name, mask or id of the demo user', () => {
    const json = JSON.stringify(snapshot).toLowerCase();
    const forbidden = new Set<string>();
    for (const t of fixture.transactions) {
      [t.id, t.description, t.merchantRaw, t.merchantKey, t.accountId].forEach(
        (v) => v && forbidden.add(v.toLowerCase()),
      );
    }
    for (const a of fixture.accounts)
      [a.id, a.name, a.mask].forEach((v) => forbidden.add(v.toLowerCase()));
    for (const value of forbidden) expect(json).not.toContain(value);
  });

  it('fits in the 16 KB the backend accepts', () => {
    expect(new TextEncoder().encode(JSON.stringify(snapshot)).length).toBeLessThan(16 * 1024);
  });
});
