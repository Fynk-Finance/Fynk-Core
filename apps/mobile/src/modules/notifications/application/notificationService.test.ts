// Runs the service on a real SQLite vault (sql.js) with the module's own migrations.
import type { NotifyInput } from '@shared/ports';
import { VaultLockedError } from '@shared/ports';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { notificationsMigrations } from '../adapters/vault/migrations';
import { createVaultInboxStore } from '../adapters/vault/vaultInboxStore';
import { createNotificationService, type NotificationService } from './notificationService';

const payment: NotifyInput = {
  kind: 'payment_due',
  title: 'Servicios públicos',
  body: 'Vence en 2 días: $186.000.',
  deepLink: 'fynk://billetera/recurrentes/r1',
  dedupeKey: 'recurring:r1:2026-10-30',
};

const milestone: NotifyInput = {
  kind: 'goal_milestone',
  title: 'Viaje a Cartagena',
  body: 'Llegaste al 64 % de tu meta.',
  deepLink: 'fynk://metas/g1',
  dedupeKey: 'goal:g1:50',
};

let vault: InMemoryVault;
let service: NotificationService;
const clock = createFixedClock('2026-10-28T15:00:00Z');

async function setup(inboxLimit?: number) {
  vault = await createInMemoryVault();
  vault.registerMigrations('notifications', notificationsMigrations);
  await vault.migrate();
  let n = 0;
  service = createNotificationService({
    store: () => createVaultInboxStore(vault.db),
    clock,
    newId: () => `n${++n}`,
    inboxLimit,
  });
}

beforeEach(async () => {
  clock.set('2026-10-28T15:00:00Z');
  await setup();
});

afterEach(() => vault.close());

describe('notify', () => {
  it('adds an unread row to the inbox at the current time', async () => {
    await service.notify(payment);
    expect(await service.list()).toEqual([
      {
        id: 'n1',
        kind: 'payment_due',
        title: 'Servicios públicos',
        body: 'Vence en 2 días: $186.000.',
        deepLink: 'fynk://billetera/recurrentes/r1',
        createdAt: '2026-10-28T15:00:00.000Z',
        readAt: null,
      },
    ]);
    expect(await service.unreadCount()).toBe(1);
  });

  it('stores one row when the same dedupe key arrives twice', async () => {
    await service.notify(payment);
    await service.notify({ ...payment, body: 'Otro texto' });
    expect(await service.list()).toHaveLength(1);
  });

  it('stores nothing for a kind the person turned off', async () => {
    await service.setEnabled('goal_milestone', false);
    await service.notify(milestone);
    expect(await service.list()).toEqual([]);
    expect(await service.isEnabled('goal_milestone')).toBe(false);
  });

  it('never turns off new device approvals', async () => {
    await service.setEnabled('device_approval', false);
    expect(await service.isEnabled('device_approval')).toBe(true);
  });

  it('keeps at most the limit of rows, deleting the oldest read ones first', async () => {
    await setup(2);
    await service.notify(payment);
    await service.markAllRead();
    clock.advance(60_000);
    await service.notify(milestone);
    clock.advance(60_000);
    await service.notify({ ...milestone, dedupeKey: 'goal:g1:75' });
    const ids = (await service.list()).map((i) => i.id);
    expect(ids).toEqual(['n3', 'n2']);
  });

  it('tells subscribers when a row is added, not when it was a duplicate', async () => {
    const listener = jest.fn();
    const unsubscribe = service.subscribe(listener);
    await service.notify(payment);
    await service.notify(payment);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    await service.notify(milestone);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('Marcar como leídas', () => {
  it('marks one row read', async () => {
    await service.notify(payment);
    await service.notify(milestone);
    await service.markRead('n1');
    expect(await service.unreadCount()).toBe(1);
    const read = (await service.list()).find((i) => i.id === 'n1');
    expect(read?.readAt).toBe('2026-10-28T15:00:00.000Z');
  });

  it('marks every row read and leaves the counter at 0', async () => {
    await service.notify(payment);
    await service.notify(milestone);
    await service.markAllRead();
    expect(await service.unreadCount()).toBe(0);
  });

  it('keeps the first read time when a row is marked read again', async () => {
    await service.notify(payment);
    await service.markRead('n1');
    clock.advance(60_000);
    await service.markAllRead();
    expect((await service.list())[0]?.readAt).toBe('2026-10-28T15:00:00.000Z');
  });
});

describe('scheduled reminders', () => {
  const reminder = { ...payment, id: 'reminder:r1', fireAt: '2026-10-29T14:00:00Z' };

  it('moves a reminder into the inbox once its time has passed, at its own time', async () => {
    await service.schedule(reminder);
    expect(await service.deliverDue()).toBe(0);
    expect(await service.list()).toEqual([]);

    clock.set('2026-10-30T12:00:00Z'); // the app opens after the reminder fired
    expect(await service.deliverDue()).toBe(1);
    expect(await service.list()).toEqual([
      expect.objectContaining({
        title: 'Servicios públicos',
        createdAt: '2026-10-29T14:00:00.000Z',
        readAt: null,
      }),
    ]);
    expect(await service.deliverDue()).toBe(0);
  });

  it('replaces a reminder scheduled again with the same id', async () => {
    await service.schedule(reminder);
    await service.schedule({ ...reminder, fireAt: '2026-10-31T14:00:00Z' });
    clock.set('2026-10-30T12:00:00Z');
    expect(await service.deliverDue()).toBe(0);
  });

  it('delivers nothing after cancel', async () => {
    await service.schedule(reminder);
    await service.cancel('reminder:r1');
    clock.set('2026-10-30T12:00:00Z');
    expect(await service.deliverDue()).toBe(0);
  });

  it('does not schedule a kind the person turned off', async () => {
    await service.setEnabled('payment_due', false);
    await service.schedule(reminder);
    await service.setEnabled('payment_due', true);
    clock.set('2026-10-30T12:00:00Z');
    expect(await service.deliverDue()).toBe(0);
  });

  it('compares times as instants, whatever ISO format the caller used', async () => {
    await service.schedule({ ...reminder, fireAt: '2026-10-29T09:00:00-05:00' });
    clock.set('2026-10-29T14:00:00.000Z');
    expect(await service.deliverDue()).toBe(1);
  });

  it('rejects a fire time that is not a date', async () => {
    await expect(service.schedule({ ...reminder, fireAt: 'mañana' })).rejects.toThrow(RangeError);
  });
});

describe('locked vault', () => {
  it('fails with VaultLockedError, so callers know nothing was stored', async () => {
    const locked = createNotificationService({
      store: () => {
        throw new VaultLockedError();
      },
      clock,
      newId: () => 'x',
    });
    await expect(locked.notify(payment)).rejects.toBeInstanceOf(VaultLockedError);
  });
});
