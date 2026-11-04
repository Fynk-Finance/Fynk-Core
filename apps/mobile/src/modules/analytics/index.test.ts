// The module installs itself from index.ts with M2, M7, M8, M9 and M12 (SCRUM-35, SCRUM-60):
// the screens get real numbers instead of "no disponible".
import { createInMemoryVault } from '@shared/testing';
import type { VaultDb } from '@shared/ports';

import { tx } from './testing/txFactory';

let mockDb: VaultDb | null = null;
const mockMigrations: Record<string, unknown> = {};
const mockCollections: string[] = [];

jest.mock('@modules/vault', () => ({
  getVaultDb: () => {
    if (!mockDb) throw new Error('locked');
    return mockDb;
  },
  registerVaultMigrations: (module: string, migrations: unknown) => {
    mockMigrations[module] = migrations;
  },
  registerBackupCollection: (c: { collection: string }) => {
    mockCollections.push(c.collection);
  },
  markDirty: jest.fn(),
}));
jest.mock('@modules/transactions', () => ({ getTransactionsBetween: jest.fn() }));
jest.mock('@modules/recurring', () => ({
  getSubscriptionsSummary: jest.fn(),
  getFixedExpensesThisMonth: jest.fn(),
}));
jest.mock('@modules/savings', () => ({
  getGoalsForSnapshot: jest.fn(),
  getPaydayContribution: jest.fn(),
}));
jest.mock('@modules/notifications', () => ({
  notificationsPort: {
    notify: jest.fn(),
    schedule: jest.fn(),
    cancel: jest.fn(),
    isEnabled: jest.fn(async () => true),
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports -- the mocks above must load first */
const transactions = jest.requireMock<{ getTransactionsBetween: jest.Mock }>(
  '@modules/transactions',
);
const recurring = jest.requireMock<{
  getSubscriptionsSummary: jest.Mock;
  getFixedExpensesThisMonth: jest.Mock;
}>('@modules/recurring');
const savings = jest.requireMock<{
  getGoalsForSnapshot: jest.Mock;
  getPaydayContribution: jest.Mock;
}>('@modules/savings');
const analytics = require('./index') as typeof import('./index');
/* eslint-enable @typescript-eslint/no-require-imports */

/** Today in Bogotá (UTC-5), as the module computes it. */
function bogotaToday(): string {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

beforeAll(async () => {
  const vault = await createInMemoryVault();
  vault.registerMigrations('analytics', mockMigrations.analytics as never);
  await vault.migrate();
  mockDb = vault.db;
});

beforeEach(() => {
  const today = bogotaToday();
  transactions.getTransactionsBetween.mockResolvedValue([
    tx(today, 2_000_000, 'salary'),
    tx(today, -150_000, 'restaurants'),
  ]);
  recurring.getSubscriptionsSummary.mockResolvedValue({
    count: 4,
    monthlyMinor: 11_260_000,
    lowUseCount: 2,
    lowUseMonthlyMinor: 5_680_000,
  });
  recurring.getFixedExpensesThisMonth.mockResolvedValue(80_000_000);
  savings.getGoalsForSnapshot.mockResolvedValue([]);
  savings.getPaydayContribution.mockResolvedValue(null);
});

describe('analytics module wiring', () => {
  it('registers its vault tables and the analytics.caps backup collection with M2', () => {
    expect(mockMigrations.analytics).toBeDefined();
    expect(mockCollections).toEqual(['analytics.caps']);
  });

  it('reads the month from M7 movements (HU-021)', async () => {
    const summary = await analytics.getMonthSummary();
    expect(summary).toMatchObject({ incomeMinor: 200_000_000, spendingMinor: 15_000_000 });
    expect(transactions.getTransactionsBetween).toHaveBeenCalled();
  });

  it('builds the snapshot with M9 subscriptions and fixed expenses and M8 goals', async () => {
    const snapshot = await analytics.buildSnapshot();
    expect(snapshot.subscriptions).toEqual({
      count: 4,
      monthlyMinor: 11_260_000,
      lowUseCount: 2,
      lowUseMonthlyMinor: 5_680_000,
    });
    expect(snapshot.fixedExpensesMonthlyMinor).toBe(80_000_000);
    expect(savings.getGoalsForSnapshot).toHaveBeenCalled();
    expect(savings.getPaydayContribution).toHaveBeenCalled();
  });

  it('keeps caps in the vault and gives M7 the Antojos threshold', async () => {
    expect(await analytics.getTreatsThreshold()).toBe(2_000_000);
  });
});
