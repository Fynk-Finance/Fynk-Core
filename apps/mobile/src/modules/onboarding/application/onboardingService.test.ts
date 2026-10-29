// SCRUM-69 on a real SQLite vault (sql.js): the setup resumes on the step where the app was
// closed, follows the vault lock, and skipping every step asks before ending.
import { createAppEvents, type AppEvents } from '@shared/events/appEvents';
import { VaultLockedError } from '@shared/ports';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { onboardingMigrations } from '../adapters/vault/migrations';
import { createVaultProgressStore } from '../adapters/vault/vaultProgressStore';
import { createOnboardingService, type OnboardingService } from './onboardingService';

const NOW = '2026-10-29T15:00:00.000Z';

let vault: InMemoryVault;
let events: AppEvents;
let locked: boolean;
const services: OnboardingService[] = [];

/** A fresh service on the same vault: what the app builds after it is killed and reopened. */
function openApp(): OnboardingService {
  const service = createOnboardingService({
    store: () => {
      if (locked) throw new VaultLockedError();
      return createVaultProgressStore(vault.db);
    },
    clock: createFixedClock(NOW),
    events,
  });
  services.push(service);
  return service;
}

const progressOf = (service: OnboardingService) => {
  const state = service.getState();
  if (state.status !== 'ready') throw new Error(`not ready: ${state.status}`);
  return state.progress;
};

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('onboarding', onboardingMigrations);
  await vault.migrate();
  events = createAppEvents();
  locked = false;
});

afterEach(() => {
  for (const s of services.splice(0)) s.dispose();
  vault.close();
});

describe('onboardingService', () => {
  it('starts on Aviso the first time', async () => {
    const app = openApp();
    await app.load();
    expect(progressOf(app)).toEqual({
      step: 'intro',
      completed: [],
      skipped: [],
      finishedAt: null,
    });
    expect(await app.isFinished()).toBe(false);
  });

  it('reopens on step 4 after the app is killed on step 4', async () => {
    const first = openApp();
    await first.load();
    await first.begin();
    await first.completeStep('name');
    await first.skipStep('accounts');
    await first.completeStep('goals');
    expect(progressOf(first).step).toBe('recurring');

    const reopened = openApp();
    await reopened.load();
    expect(progressOf(reopened)).toEqual({
      step: 'recurring',
      completed: ['name', 'goals'],
      skipped: ['accounts'],
      finishedAt: null,
    });
  });

  it('shows the warning before ending when every step was skipped', async () => {
    const app = openApp();
    await app.load();
    await app.begin();
    const outcomes = [];
    for (const step of ['name', 'accounts', 'goals', 'recurring'] as const) {
      outcomes.push(await app.skipStep(step));
    }
    expect(outcomes.map((o) => o.showWarning)).toEqual([false, false, false, true]);
    expect(await app.isFinished()).toBe(false);

    await app.skipAll();
    expect(progressOf(app).finishedAt).toBe(NOW);
    expect(await app.isFinished()).toBe(true);
  });

  it('ends after "Terminar configuración" and stays ended after a restart', async () => {
    const app = openApp();
    await app.load();
    await app.begin();
    for (const step of ['name', 'accounts', 'goals', 'recurring'] as const) {
      await app.completeStep(step);
    }
    expect(progressOf(app).finishedAt).toBe(NOW);

    const reopened = openApp();
    expect(await reopened.isFinished()).toBe(true);
  });

  it('saves the step the person went back to', async () => {
    const app = openApp();
    await app.load();
    await app.begin();
    await app.completeStep('name');
    await app.visit('name');

    const reopened = openApp();
    await reopened.load();
    expect(progressOf(reopened).step).toBe('name');
  });

  it('forgets the progress while the vault is locked and reads it again on unlock', async () => {
    const app = openApp();
    await app.load();
    await app.begin();

    locked = true;
    events.emit({ type: 'vault.locked' });
    expect(app.getState()).toEqual({ status: 'unknown' });
    await expect(app.isFinished()).rejects.toBeInstanceOf(VaultLockedError);

    locked = false;
    events.emit({ type: 'vault.unlocked' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(progressOf(app).step).toBe('name');
  });

  it('stays unknown when it loads while the vault is locked', async () => {
    locked = true;
    const app = openApp();
    await app.load();
    expect(app.getState()).toEqual({ status: 'unknown' });
  });

  it('reports a read that failed for another reason, and retries', async () => {
    const app = openApp();
    vault.close();
    await app.load();
    expect(app.getState()).toEqual({ status: 'failed' });

    vault = await createInMemoryVault();
    vault.registerMigrations('onboarding', onboardingMigrations);
    await vault.migrate();
    await app.load();
    expect(progressOf(app).step).toBe('intro');
  });

  it('does nothing before the progress is read', async () => {
    const app = openApp();
    await app.begin();
    expect(await app.skipStep('name')).toEqual({ showWarning: false });
    expect(app.getState()).toEqual({ status: 'unknown' });
  });

  it('tells its subscribers about every change', async () => {
    const app = openApp();
    const listener = jest.fn();
    const stop = app.subscribe(listener);
    await app.load();
    await app.begin();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    await app.completeStep('name');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('handles a double tap on "Continuar" as one move per tap, in order', async () => {
    const app = openApp();
    await app.load();
    await app.begin();
    await Promise.all([app.completeStep('name'), app.completeStep('name')]);
    expect(progressOf(app)).toMatchObject({ step: 'accounts', completed: ['name'] });
  });
});
