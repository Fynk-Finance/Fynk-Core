import { ApiError } from '@shared/api';
import { createFixedClock, createInMemoryVault } from '@shared/testing';
import { snapshotDataRange } from '@modules/analytics';

import { recommendationsMigrations } from '../adapters/vault/migrations';
import { createVaultRecommendationsStore } from '../adapters/vault/store';
import type { ModelTexts } from '../domain/steps';
import { designReport } from '../testing/designReport';
import type { RecommendationsApiPort } from './ports';
import { createRecommendationsService } from './recommendationsService';

const texts: ModelTexts = {
  summary: 'Vas bien este mes.',
  steps: [{ factKey: 'subscriptions.low_use', title: 'Suscripciones', text: 'Revisa.' }],
  fallback: false,
  modelId: 'amazon.nova-lite-v1:0',
  promptVersion: '2026-10-28.1',
  snapshotHash: 'h',
  generatedAt: '2026-10-28T17:00:00Z',
};

async function setup(create: RecommendationsApiPort['create'] = async () => texts) {
  const vault = await createInMemoryVault();
  vault.registerMigrations('recommendations', recommendationsMigrations);
  await vault.migrate();
  const clock = createFixedClock('2026-10-28T17:00:00Z');
  let report = designReport();
  const api = { create: jest.fn(create) };
  const store = createVaultRecommendationsStore(() => vault.db);
  const service = createRecommendationsService({
    analytics: { getReport: async () => report },
    api,
    store,
    clock,
    dataRange: snapshotDataRange,
  });
  return {
    service,
    api,
    clock,
    store,
    setReport: (next: ReturnType<typeof designReport>) => {
      report = next;
    },
  };
}

describe('recommendations service', () => {
  it('makes one call with the snapshot and the factKeys, then caches it in the vault', async () => {
    const { service, api } = await setup();
    const view = await service.refresh();
    expect(api.create).toHaveBeenCalledTimes(1);
    const [snapshot, factKeys] = api.create.mock.calls[0]!;
    expect(snapshot.schemaVersion).toBe(1);
    expect(factKeys).toEqual([
      'subscriptions.low_use',
      'category_increase.restaurants',
      'payday_contribution',
    ]);
    expect(view.texts).toEqual(texts);
    expect(view.dataRange).toEqual({ from: '2025-11-01', to: '2026-10-28' });

    // The cached text shows at once on the next open, with no call.
    expect((await service.load()).texts).toEqual(texts);
    await service.refresh();
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it('never shows a text written for other numbers, and asks again at most once per hour', async () => {
    const { service, api, clock, setReport } = await setup();
    await service.refresh();
    const changed = designReport();
    changed.snapshot.fixedExpensesMonthlyMinor += 100;
    setReport(changed);

    expect((await service.load()).texts).toBeNull();
    clock.advance(30 * 60 * 1000);
    expect((await service.refresh()).texts).toBeNull();
    expect(api.create).toHaveBeenCalledTimes(1);

    clock.advance(30 * 60 * 1000);
    expect((await service.refresh()).texts).toEqual(texts);
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it('keeps numbers and templates when offline or rate limited', async () => {
    const offline = await setup(async () => {
      throw ApiError.network();
    });
    expect(await offline.service.refresh()).toMatchObject({ texts: null, notice: 'offline' });

    const limited = await setup(async () => {
      throw new ApiError({ status: 429, code: 'rate_limited', title: 'Too many requests' });
    });
    const view = await limited.service.refresh();
    expect(view).toMatchObject({ texts: null, notice: 'rate_limited' });
    expect(view.opportunities).toHaveLength(3);
  });

  it('stops sending the snapshot when "Recomendaciones con IA" is off', async () => {
    const { service, api } = await setup();
    await service.refresh();
    await service.setAiEnabled(false);
    const view = await service.refresh();
    expect(view).toMatchObject({ texts: null, notice: 'ai_off', aiEnabled: false });
    expect(api.create).toHaveBeenCalledTimes(1);
    expect((await service.load()).texts).toBeNull();
  });
});
