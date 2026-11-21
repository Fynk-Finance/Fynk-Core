// The payday reminder on a real vault (sql.js) with M12's in-memory port: saving schedules the
// next one at 9:00 Bogotá time, editing replaces it, removing cancels it, and a reached or
// deleted goal loses it when the vault opens.
import {
  createFixedClock,
  createInMemoryNotifications,
  createInMemoryVault,
  type InMemoryVault,
} from '@shared/testing';

import { savingsMigrations } from '../adapters/vault/migrations';
import { createVaultGoalStore } from '../adapters/vault/vaultGoalStore';
import { createVaultPaydayStore } from '../adapters/vault/vaultPaydayStore';
import { createGoalService, type GoalService } from './goalService';
import {
  InvalidPaydayError,
  createPaydayService,
  paydayReminderId,
  type PaydayService,
} from './paydayService';

const pesos = (n: number) => n * 100;
const clock = createFixedClock('2026-10-28T15:00:00Z');

let vault: InMemoryVault;
let goals: GoalService;
let payday: PaydayService;
let notifications: ReturnType<typeof createInMemoryNotifications>;
let goalId: string;

beforeEach(async () => {
  clock.set('2026-10-28T15:00:00Z');
  vault = await createInMemoryVault();
  vault.registerMigrations('savings', savingsMigrations);
  await vault.migrate();
  let n = 0;
  goals = createGoalService({
    store: () => createVaultGoalStore(vault.db),
    clock,
    newId: () => `g${++n}`,
  });
  notifications = createInMemoryNotifications();
  payday = createPaydayService({
    store: () => createVaultPaydayStore(vault.db),
    goals: () => goals.list(),
    notifications,
    clock,
  });
  goalId = await goals.create({
    name: 'Viaje a Cartagena',
    category: 'travel',
    targetMinor: pesos(5_000_000),
    deadline: '2027-06',
  });
});

afterEach(() => vault.close());

describe('payday reminder', () => {
  it('schedules "Hoy es día de pago: aparta $300.000 para Viaje a Cartagena" at 9:00', async () => {
    await payday.save(goalId, { amountMinor: pesos(300_000), day: 30 });
    expect(notifications.scheduled()).toMatchObject([
      {
        id: paydayReminderId(goalId),
        fireAt: '2026-10-30T14:00:00.000Z',
        kind: 'recommendation',
        title: 'Día de pago',
        body: 'Hoy es día de pago: aparta $300.000 para Viaje a Cartagena.',
        deepLink: 'fynk://metas',
      },
    ]);
    expect(await payday.get(goalId)).toMatchObject({ amountMinor: pesos(300_000), day: 30 });
  });

  it('editing replaces the reminder instead of adding one', async () => {
    await payday.save(goalId, { amountMinor: pesos(300_000), day: 30 });
    await payday.save(goalId, { amountMinor: pesos(250_000), day: 15 });
    expect(notifications.scheduled()).toHaveLength(1);
    expect(notifications.scheduled()[0]?.fireAt).toBe('2026-11-15T14:00:00.000Z');
  });

  it('removing cancels it', async () => {
    await payday.save(goalId, { amountMinor: pesos(300_000), day: 30 });
    await payday.remove(goalId);
    expect(notifications.scheduled()).toEqual([]);
    expect(await payday.get(goalId)).toBeNull();
  });

  it('refuses a bad amount or day, and a goal that does not exist', async () => {
    await expect(payday.save(goalId, { amountMinor: 0, day: 30 })).rejects.toBeInstanceOf(
      InvalidPaydayError,
    );
    await expect(payday.save(goalId, { amountMinor: 100, day: 40 })).rejects.toBeInstanceOf(
      InvalidPaydayError,
    );
    await expect(payday.save('nope', { amountMinor: 100, day: 1 })).rejects.toBeInstanceOf(
      InvalidPaydayError,
    );
  });

  it('when the vault opens, schedules next month and drops the reminder of a deleted goal', async () => {
    await payday.save(goalId, { amountMinor: pesos(300_000), day: 30 });
    clock.set('2026-10-31T15:00:00Z');
    await payday.refresh();
    expect(notifications.scheduled()[0]?.fireAt).toBe('2026-11-30T14:00:00.000Z');

    await goals.remove(goalId);
    await payday.refresh();
    expect(notifications.scheduled()).toEqual([]);
    expect(await payday.get(goalId)).toBeNull();
  });
});
