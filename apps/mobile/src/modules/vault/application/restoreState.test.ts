import { createInMemoryVault } from '@shared/testing';

import { vaultMigrations } from '../adapters/vault/migrations';
import { createRestoreState } from './restoreState';

async function setup() {
  const vault = await createInMemoryVault();
  vault.registerMigrations('vault', vaultMigrations);
  await vault.migrate();
  return createRestoreState(() => vault.db);
}

it('is not pending on a fresh vault', async () => {
  expect(await (await setup()).isPending()).toBe(false);
});

it('marks, stays marked when marked again, and clears', async () => {
  const state = await setup();
  await state.mark();
  await state.mark();
  expect(await state.isPending()).toBe(true);
  await state.clear();
  expect(await state.isPending()).toBe(false);
  // Clearing what is not there is fine.
  await state.clear();
});
