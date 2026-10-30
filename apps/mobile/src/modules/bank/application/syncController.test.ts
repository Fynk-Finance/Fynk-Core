// When the phone syncs and what it tells the person (HU-011: on open, pull to refresh, back to the
// foreground after 15 minutes, no background, result informed; M12 notice once a day).
import type { NotifyInput } from '@shared/ports';
import { createFixedClock } from '@shared/testing';

import type { BankLink } from '../domain/link';
import { createSyncController, type SyncTriggers } from './syncController';
import type { SyncReport } from './syncEngine';

const clock = createFixedClock('2026-10-29T15:00:00Z');

const link = (over: Partial<BankLink> = {}): BankLink => ({
  id: 'link-1',
  provider: 'banco-demo',
  consentId: 'c-1',
  createdAt: '2026-10-29T14:00:00Z',
  status: 'active',
  lastSyncedAt: null,
  lastAttemptAt: null,
  revokedAt: null,
  ...over,
});

function triggers() {
  const listeners: { unlocked?: () => void; appState?: (s: string) => void } = {};
  const t: SyncTriggers = {
    onVaultUnlocked: (fn) => {
      listeners.unlocked = fn;
      return () => (listeners.unlocked = undefined);
    },
    onAppState: (fn) => {
      listeners.appState = fn;
      return () => (listeners.appState = undefined);
    },
  };
  return { t, listeners };
}

function setup(
  report: SyncReport = {
    status: 'done',
    links: [{ linkId: 'link-1', provider: 'banco-demo', kind: 'synced' }],
  },
) {
  clock.set('2026-10-29T15:00:00Z');
  let links = [link()];
  const engine = {
    syncAll: jest.fn(async () => {
      links = [link({ lastSyncedAt: clock.now().toISOString() })];
      return report;
    }),
  };
  const notified: NotifyInput[] = [];
  const controller = createSyncController({
    engine,
    links: async () => links,
    entityName: async (provider) => (provider === 'banco-demo' ? 'Banco Demo' : provider),
    notify: async (n) => {
      notified.push(n);
    },
    clock,
  });
  return { controller, engine, notified };
}

it('syncs when the vault is unlocked (on open)', async () => {
  const { controller, engine } = setup();
  const { t, listeners } = triggers();
  controller.start(t);
  listeners.unlocked?.();
  await controller.idle();
  expect(engine.syncAll).toHaveBeenCalledTimes(1);
});

it('syncs on return to the foreground after 15 minutes in the background, not before', async () => {
  const { controller, engine } = setup();
  const { t, listeners } = triggers();
  controller.start(t);

  listeners.appState?.('background');
  clock.advance(14 * 60_000);
  listeners.appState?.('active');
  await controller.idle();
  expect(engine.syncAll).not.toHaveBeenCalled();

  listeners.appState?.('background');
  clock.advance(15 * 60_000);
  listeners.appState?.('inactive');
  listeners.appState?.('active');
  await controller.idle();
  expect(engine.syncAll).toHaveBeenCalledTimes(1);
});

it('stops listening when stopped', async () => {
  const { controller, engine } = setup();
  const { t, listeners } = triggers();
  const stop = controller.start(t);
  stop();
  expect(listeners.unlocked).toBeUndefined();
  expect(listeners.appState).toBeUndefined();
  expect(engine.syncAll).not.toHaveBeenCalled();
});

it('shows syncing, then the last update date, to the screens (HU-010)', async () => {
  const { controller } = setup();
  const seen: string[] = [];
  controller.subscribe(() => seen.push(controller.getState().status));
  const run = controller.syncNow();
  expect(controller.getState().status).toBe('syncing');
  await run;
  expect(controller.getState()).toMatchObject({
    status: 'idle',
    lastSyncedAt: '2026-10-29T15:00:00.000Z',
  });
  expect(seen).toEqual(['syncing', 'idle']);
});

it('tells the person once a day that the entity is synced (M12 notice)', async () => {
  const { controller, notified } = setup();
  await controller.syncNow();
  clock.advance(2 * 60_000);
  await controller.syncNow();
  expect(notified).toHaveLength(2);
  expect(notified[0]).toEqual({
    kind: 'sync_result',
    title: 'Banco Demo sincronizada',
    body: 'Tus movimientos están al día.',
    deepLink: 'fynk://billetera',
    dedupeKey: 'sync_result:link-1:2026-10-29',
  });
  // Same key the same day in Bogotá, so M12 shows it once.
  expect(notified[1]!.dedupeKey).toBe('sync_result:link-1:2026-10-29');
});

it('uses the Bogotá day for the notice: 23:30 in Bogotá is still that day', async () => {
  const { controller, notified } = setup();
  clock.set('2026-10-30T04:30:00Z');
  await controller.syncNow();
  expect(notified[0]!.dedupeKey).toBe('sync_result:link-1:2026-10-29');
});

it('sends no notice for a link that failed or was in cooldown', async () => {
  const { controller, notified } = setup({
    status: 'done',
    links: [
      { linkId: 'link-1', provider: 'banco-demo', kind: 'failed', code: 'network_error' },
      { linkId: 'link-2', provider: 'banco-demo', kind: 'cooldown' },
    ],
  });
  await controller.syncNow();
  expect(notified).toEqual([]);
  expect(controller.getState().lastReport?.links[0]).toMatchObject({ kind: 'failed' });
});

it('keeps the sync result even when the notice cannot be written', async () => {
  const { controller } = setup();
  const failing = createSyncController({
    engine: {
      syncAll: async () => ({
        status: 'done',
        links: [{ linkId: 'link-1', provider: 'banco-demo', kind: 'synced' }],
      }),
    },
    links: async () => [],
    entityName: async () => 'Banco Demo',
    notify: async () => Promise.reject(new Error('locked')),
    clock,
  });
  await expect(failing.syncNow()).resolves.toMatchObject({ status: 'done' });
  expect(controller.getState().status).toBe('idle');
});

it('does nothing and calls no one without an engine (M6 and M7 not wired yet)', async () => {
  const controller = createSyncController({
    engine: null,
    links: async () => [],
    entityName: async () => '',
    notify: jest.fn(),
    clock,
  });
  const { t, listeners } = triggers();
  controller.start(t);
  expect(listeners.unlocked).toBeUndefined();
  expect(await controller.syncNow()).toEqual({ status: 'unavailable', links: [] });
});
