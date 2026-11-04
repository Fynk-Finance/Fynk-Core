// The module installs itself from index.ts with M2's vault and M10's report (SCRUM-38, SCRUM-39).
import { createInMemoryVault } from '@shared/testing';
import type { VaultDb } from '@shared/ports';

import { designReport } from './testing/designReport';

let mockDb: VaultDb | null = null;
const mockMigrations: Record<string, unknown> = {};

jest.mock('@modules/vault', () => ({
  getVaultDb: () => {
    if (!mockDb) throw new Error('locked');
    return mockDb;
  },
  registerVaultMigrations: (module: string, migrations: unknown) => {
    mockMigrations[module] = migrations;
  },
}));
jest.mock('@modules/analytics', () => ({
  ...jest.requireActual<object>('@modules/analytics/domain/snapshot'),
  getAnalyticsReport: jest.fn(),
  useOpenCapForm: () => jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-require-imports -- the mocks above must load first */
const analytics = jest.requireMock<{ getAnalyticsReport: jest.Mock }>('@modules/analytics');
const { getRecommendationsService } =
  require('./application/hooks') as typeof import('./application/hooks');
const recommendations = require('./index') as typeof import('./index');
/* eslint-enable @typescript-eslint/no-require-imports */

beforeAll(async () => {
  const vault = await createInMemoryVault();
  vault.registerMigrations('recommendations', mockMigrations.recommendations as never);
  await vault.migrate();
  mockDb = vault.db;
});

describe('recommendations module wiring', () => {
  it('exports the Recomendaciones tab', () => {
    expect(recommendations.routes.module).toBe('recommendations');
    expect(typeof recommendations.routes.tab).toBe('function');
  });

  it('registers its vault tables with M2 and installs the service', () => {
    expect(mockMigrations.recommendations).toBeDefined();
    expect(getRecommendationsService()).not.toBeNull();
  });

  it('shows M10 opportunities from the vault cache, without calling the model', async () => {
    analytics.getAnalyticsReport.mockResolvedValue(designReport());
    const view = await getRecommendationsService()!.load();
    expect(view.opportunities).toHaveLength(3);
    expect(view.texts).toBeNull();
  });
});
