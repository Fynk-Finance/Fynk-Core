// SCRUM-70: scheduled reminders work as local notifications even with the app closed.
// The service on a real SQLite vault (sql.js) with a fake of the phone's notifications.
import type { ScheduleInput } from '@shared/ports';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { notificationsMigrations } from '../adapters/vault/migrations';
import { createVaultInboxStore } from '../adapters/vault/vaultInboxStore';
import { createNotificationService, type NotificationService } from './notificationService';
import type { LocalNotificationRequest, LocalNotifier, OsPermission } from './ports';

const reminder: ScheduleInput = {
  id: 'reminder:r1',
  kind: 'payment_due',
  title: 'Servicios públicos',
  body: 'Vence en 2 días: $186.000.',
  deepLink: 'fynk://billetera/recurrentes/r1',
  dedupeKey: 'recurring:r1:2026-10-30',
  fireAt: '2026-10-28T14:00:00Z', // 9:00 in Bogotá
};

function fakeNotifier(initial: OsPermission = 'undetermined', allowOnAsk = true) {
  let permission = initial;
  let next = 0;
  const scheduled = new Map<string, LocalNotificationRequest>();
  const notifier = {
    permission: jest.fn(async () => permission),
    askPermission: jest.fn(async () => {
      permission = allowOnAsk ? 'granted' : 'denied';
      return allowOnAsk;
    }),
    schedule: jest.fn(async (r: LocalNotificationRequest) => {
      const id = `os-${++next}`;
      scheduled.set(id, r);
      return id;
    }),
    cancel: jest.fn(async (osId: string) => {
      scheduled.delete(osId);
    }),
  } satisfies LocalNotifier;
  return { notifier, scheduled };
}

let vault: InMemoryVault;
const clock = createFixedClock('2026-10-26T15:00:00Z');

async function setup(notifier: LocalNotifier): Promise<NotificationService> {
  vault = await createInMemoryVault();
  vault.registerMigrations('notifications', notificationsMigrations);
  await vault.migrate();
  let n = 0;
  return createNotificationService({
    store: () => createVaultInboxStore(vault.db),
    clock,
    newId: () => `n${++n}`,
    notifier,
  });
}

beforeEach(() => clock.set('2026-10-26T15:00:00Z'));
afterEach(() => vault.close());

describe('local notifications for scheduled reminders', () => {
  it('asks permission the first time, after the explanation, then schedules on the phone', async () => {
    const { notifier, scheduled } = fakeNotifier();
    const service = await setup(notifier);

    await service.schedule(reminder);

    expect(notifier.askPermission).toHaveBeenCalledTimes(1);
    expect([...scheduled.values()]).toEqual([
      {
        title: 'Servicios públicos',
        body: 'Vence en 2 días: $186.000.',
        fireAt: new Date('2026-10-28T14:00:00Z'),
        data: { scheduledId: 'reminder:r1', deepLink: 'fynk://billetera/recurrentes/r1' },
      },
    ]);

    await service.schedule({ ...reminder, id: 'reminder:r2', dedupeKey: 'other' });
    expect(notifier.askPermission).toHaveBeenCalledTimes(1); // already granted
    expect(scheduled.size).toBe(2);
  });

  it('replaces the OS notification when the same reminder is scheduled again', async () => {
    const { notifier, scheduled } = fakeNotifier('granted');
    const service = await setup(notifier);

    await service.schedule(reminder);
    await service.schedule({ ...reminder, fireAt: '2026-10-29T14:00:00Z' });

    expect(notifier.cancel).toHaveBeenCalledWith('os-1');
    expect([...scheduled.keys()]).toEqual(['os-2']);
    expect(scheduled.get('os-2')?.fireAt).toEqual(new Date('2026-10-29T14:00:00Z'));
  });

  it('cancels the OS notification with the reminder', async () => {
    const { notifier, scheduled } = fakeNotifier('granted');
    const service = await setup(notifier);

    await service.schedule(reminder);
    await service.cancel('reminder:r1');

    expect(scheduled.size).toBe(0);
    clock.set('2026-10-30T12:00:00Z');
    expect(await service.deliverDue()).toBe(0);
  });

  it('still puts the reminder in the inbox when the person said no to notifications', async () => {
    const { notifier, scheduled } = fakeNotifier('undetermined', false);
    const service = await setup(notifier);

    await service.schedule(reminder);
    expect(scheduled.size).toBe(0);

    await service.schedule({ ...reminder, id: 'reminder:r2', dedupeKey: 'other' });
    expect(notifier.askPermission).toHaveBeenCalledTimes(1); // never asked twice

    clock.set('2026-10-30T12:00:00Z');
    expect(await service.deliverDue()).toBe(2);
  });

  it('does not ask the phone for a time that already passed: the inbox takes it', async () => {
    const { notifier } = fakeNotifier('granted');
    const service = await setup(notifier);

    await service.schedule({ ...reminder, fireAt: '2026-10-26T14:00:00Z' });

    expect(notifier.schedule).not.toHaveBeenCalled();
    expect(await service.deliverDue()).toBe(1);
  });

  it('turning a kind off cancels its pending reminders on the phone', async () => {
    const { notifier, scheduled } = fakeNotifier('granted');
    const service = await setup(notifier);

    await service.schedule(reminder);
    await service.schedule({
      ...reminder,
      id: 'goal:g1',
      kind: 'goal_milestone',
      dedupeKey: 'goal',
    });
    await service.setEnabled('payment_due', false);

    expect([...scheduled.values()].map((r) => r.data.scheduledId)).toEqual(['goal:g1']);
    await service.setEnabled('payment_due', true);
    clock.set('2026-10-30T12:00:00Z');
    expect(await service.deliverDue()).toBe(1); // only the goal
  });

  it('keeps the reminder when the phone fails to schedule it', async () => {
    const { notifier } = fakeNotifier('granted');
    notifier.schedule.mockRejectedValueOnce(new Error('alarm limit'));
    const service = await setup(notifier);

    await expect(service.schedule(reminder)).resolves.toBeUndefined();
    clock.set('2026-10-30T12:00:00Z');
    expect(await service.deliverDue()).toBe(1);
  });
});
