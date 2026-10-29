// Contract test of the onboarding progress table on a real SQLite vault (sql.js).
import { createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { initialProgress, type OnboardingProgress } from '../../domain/progress';
import { onboardingMigrations } from './migrations';
import { createVaultProgressStore } from './vaultProgressStore';

const NOW = '2026-10-29T15:00:00.000Z';

let vault: InMemoryVault;

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('onboarding', onboardingMigrations);
  await vault.migrate();
});

afterEach(() => vault.close());

describe('vaultProgressStore', () => {
  it('has nothing before the setup was opened', async () => {
    expect(await createVaultProgressStore(vault.db).load()).toBeNull();
  });

  it('saves and reads back the progress', async () => {
    const store = createVaultProgressStore(vault.db);
    const progress: OnboardingProgress = {
      step: 'goals',
      completed: ['name'],
      skipped: ['accounts'],
      finishedAt: null,
    };
    await store.save(progress, NOW);
    expect(await store.load()).toEqual(progress);
  });

  it('keeps one row and overwrites it', async () => {
    const store = createVaultProgressStore(vault.db);
    await store.save(initialProgress, NOW);
    await store.save({ ...initialProgress, step: 'recurring', finishedAt: NOW }, NOW);
    const rows = await vault.db.query<{ n: number }>(
      'SELECT count(*) AS n FROM onboarding_progress',
    );
    expect(rows[0]?.n).toBe(1);
    expect(await store.load()).toEqual({ ...initialProgress, step: 'recurring', finishedAt: NOW });
  });

  it('drops step ids this build does not know', async () => {
    await vault.db.execute(
      `INSERT INTO onboarding_progress
         (id, step, completed_steps, skipped_steps, finished_at, updated_at)
       VALUES (1, 'email', '["email","name"]', 'not json', NULL, ?)`,
      [NOW],
    );
    expect(await createVaultProgressStore(vault.db).load()).toEqual({
      step: 'intro',
      completed: ['name'],
      skipped: [],
      finishedAt: null,
    });
  });
});
