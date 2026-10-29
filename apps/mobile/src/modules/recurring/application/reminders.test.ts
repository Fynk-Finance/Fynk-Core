// SCRUM-57 (HU-041 Recordatorios): every change schedules the next reminder with M12's
// NotificationsPort (local notifications, no background work), turning it off or deleting the
// item cancels it, the lead days come from Ajustes de notificaciones, and a failing notifier
// never blocks saving.
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import type { NotificationsPort, ScheduleInput } from '@shared/ports';

import { recurringMigrations } from '../adapters/vault/migrations';
import { createVaultRecurringStore } from '../adapters/vault/vaultRecurringStore';
import type { RecurringInput } from '../domain/item';
import type { LeadDays } from '../domain/reminder';
import { createRecurringService, type RecurringService } from './recurringService';
import { createReminderScheduler, reminderBody } from './reminders';

// Saturday 24 Oct 2026, 08:00 in Bogotá.
const clock = createFixedClock('2026-10-24T13:00:00Z');

const utilities: RecurringInput = {
  kind: 'fixed',
  name: 'Servicios públicos',
  amountMinor: 18_600_000,
  schedule: { periodicity: 'monthly', anchorDay: 26 },
  categoryId: 'utilities',
};

const video: RecurringInput = {
  kind: 'subscription',
  name: 'Streaming de video',
  amountMinor: 3_890_000,
  schedule: { periodicity: 'monthly', anchorDay: 28 },
  categoryId: 'subscriptions',
};

function fakePort(fail = false) {
  const scheduled = new Map<string, ScheduleInput>();
  const port: Pick<NotificationsPort, 'schedule' | 'cancel'> = {
    schedule: jest.fn(async (n: ScheduleInput) => {
      if (fail) throw new Error('notifier down');
      scheduled.set(n.id, n);
    }),
    cancel: jest.fn(async (id: string) => {
      scheduled.delete(id);
    }),
  };
  return { port, scheduled };
}

let vault: InMemoryVault;
let lead: LeadDays;

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('recurring', recurringMigrations);
  await vault.migrate();
  lead = 2;
});

afterEach(() => vault.close());

function serviceWith(port: Pick<NotificationsPort, 'schedule' | 'cancel'>): RecurringService {
  let n = 0;
  return createRecurringService({
    store: () => createVaultRecurringStore(vault.db),
    clock,
    newId: () => `r${++n}`,
    reminders: createReminderScheduler({
      notifications: port,
      leadDays: async () => lead,
      clock,
    }),
  });
}

describe('payment reminders', () => {
  it('adding a fixed expense schedules "Vence en 2 días" 2 days before at 9:00', async () => {
    const { port, scheduled } = fakePort();
    await serviceWith(port).create(utilities);
    expect(scheduled.get('recurring.reminder.r1')).toEqual({
      id: 'recurring.reminder.r1',
      kind: 'payment_due',
      title: 'Servicios públicos',
      body: 'Vence en 2 días: $186.000.',
      deepLink: 'fynk://billetera/recurrentes/r1',
      dedupeKey: 'recurring.reminder.r1.2026-10-26',
      fireAt: '2026-10-24T14:00:00.000Z',
    });
  });

  it('a subscription gets its renewal notice', async () => {
    const { port, scheduled } = fakePort();
    await serviceWith(port).create(video);
    expect(scheduled.get('recurring.reminder.r1')).toMatchObject({
      kind: 'subscription_renewal',
      title: 'Streaming de video',
      body: 'Se renueva el 28 oct por $38.900.',
      fireAt: '2026-10-26T14:00:00.000Z',
    });
  });

  it('uses the lead days chosen in Ajustes de notificaciones', async () => {
    lead = 1;
    const { port, scheduled } = fakePort();
    await serviceWith(port).create(utilities);
    expect(scheduled.get('recurring.reminder.r1')).toMatchObject({
      body: 'Vence mañana: $186.000.',
      fireAt: '2026-10-25T14:00:00.000Z',
    });
  });

  it('editing the day moves the reminder; turning it off cancels it', async () => {
    const { port, scheduled } = fakePort();
    const service = serviceWith(port);
    const id = await service.create(utilities);
    await service.update(id, { ...utilities, schedule: { periodicity: 'monthly', anchorDay: 5 } });
    expect(scheduled.get('recurring.reminder.r1')?.fireAt).toBe('2026-11-03T14:00:00.000Z');
    await service.update(id, { ...utilities, reminderEnabled: false });
    expect(scheduled.has('recurring.reminder.r1')).toBe(false);
  });

  it('deleting the item cancels its reminder', async () => {
    const { port, scheduled } = fakePort();
    const service = serviceWith(port);
    const id = await service.create(utilities);
    await service.remove(id);
    expect(scheduled.size).toBe(0);
    expect(port.cancel).toHaveBeenLastCalledWith('recurring.reminder.r1');
  });

  it('refreshReminders schedules every item again (vault opened, sync done)', async () => {
    const { port, scheduled } = fakePort();
    const service = serviceWith(port);
    await service.create(utilities);
    await service.create(video);
    scheduled.clear();
    lead = 0;
    await service.refreshReminders();
    expect([...scheduled.values()].map((n) => n.body)).toEqual([
      'Vence hoy: $186.000.',
      'Se renueva hoy por $38.900.',
    ]);
  });

  it('a failing notifier never blocks saving', async () => {
    const { port } = fakePort(true);
    const service = serviceWith(port);
    const id = await service.create(utilities);
    expect(await service.get(id)).toMatchObject({ name: 'Servicios públicos' });
    await expect(service.refreshReminders()).resolves.toBeUndefined();
  });
});

describe('reminderBody', () => {
  it('says when a payment is due, as in the M9 prompt', () => {
    const base = { kind: 'payment_due', chargeDate: '2026-10-26' } as const;
    expect(reminderBody({ ...base, leadDays: 2 }, 18_600_000)).toBe('Vence en 2 días: $186.000.');
    expect(reminderBody({ ...base, leadDays: 1 }, 18_600_000)).toBe('Vence mañana: $186.000.');
    expect(reminderBody({ ...base, leadDays: 0 }, 18_600_000)).toBe('Vence hoy: $186.000.');
  });

  it('says when a subscription renews, as in the M9 prompt', () => {
    const base = { kind: 'subscription_renewal', chargeDate: '2026-09-28' } as const;
    expect(reminderBody({ ...base, leadDays: 2 }, 3_890_000)).toBe(
      'Se renueva el 28 sep por $38.900.',
    );
    expect(reminderBody({ ...base, leadDays: 0 }, 3_890_000)).toBe('Se renueva hoy por $38.900.');
  });
});
