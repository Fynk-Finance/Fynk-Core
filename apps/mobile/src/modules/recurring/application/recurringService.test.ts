// SCRUM-54 on a real SQLite vault (sql.js) with the module's migrations: add, edit and delete
// recurring items, and the Billetera totals of the design.
import { formatCop } from '@shared/domain/money';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { createVaultRecurringStore } from '../adapters/vault/vaultRecurringStore';
import { recurringMigrations } from '../adapters/vault/migrations';
import type { RecurringInput } from '../domain/item';
import { MON_TO_FRI, WEEKDAY } from '../domain/types';
import {
  InvalidRecurringError,
  RecurringNotFoundError,
  bogotaMonth,
  createRecurringService,
  type RecurringService,
} from './recurringService';

const pesos = (n: number) => n * 100;
const monthly = (
  name: string,
  amount: number,
  day: number,
  over: Partial<RecurringInput> = {},
): RecurringInput => ({
  kind: 'fixed',
  name,
  amountMinor: pesos(amount),
  schedule: { periodicity: 'monthly', anchorDay: day },
  categoryId: 'rent',
  ...over,
});

// Billetera in the design.
const billetera: RecurringInput[] = [
  monthly('Arriendo', 1_400_000, 1),
  monthly('Servicios públicos', 186_000, 26, { categoryId: 'utilities' }),
  {
    ...monthly('Gimnasio', 22_250, 1, { categoryId: 'gym' }),
    schedule: { periodicity: 'weekly', weekdaysMask: WEEKDAY.mon },
  },
  {
    ...monthly('Transporte', 6_500, 1, { categoryId: 'transport' }),
    schedule: { periodicity: 'daily', weekdaysMask: MON_TO_FRI },
  },
  monthly('Streaming de video', 38_900, 28, { kind: 'subscription', categoryId: 'subscriptions' }),
  monthly('Streaming de series', 32_900, 2, { kind: 'subscription', categoryId: 'subscriptions' }),
  monthly('Música', 16_900, 7, { kind: 'subscription', categoryId: 'subscriptions' }),
  monthly('Almacenamiento', 23_900, 15, { kind: 'subscription', categoryId: 'subscriptions' }),
];

let vault: InMemoryVault;
let service: RecurringService;
const clock = createFixedClock('2026-10-28T15:00:00Z');

beforeEach(async () => {
  clock.set('2026-10-28T15:00:00Z');
  vault = await createInMemoryVault();
  vault.registerMigrations('recurring', recurringMigrations);
  await vault.migrate();
  let n = 0;
  service = createRecurringService({
    store: () => createVaultRecurringStore(vault.db),
    clock,
    newId: () => `r${++n}`,
  });
});

afterEach(() => vault.close());

async function addAll(items: RecurringInput[]) {
  const ids: string[] = [];
  for (const item of items) {
    ids.push(await service.create(item));
    clock.advance(1000);
  }
  return ids;
}

describe('recurring items in the vault', () => {
  it('stores every field and reads it back the same', async () => {
    const id = await service.create(billetera[2]!);
    expect(await service.get(id)).toEqual({
      id: 'r1',
      kind: 'fixed',
      name: 'Gimnasio',
      amountMinor: pesos(22_250),
      schedule: { periodicity: 'weekly', weekdaysMask: WEEKDAY.mon },
      status: 'active',
      usage: null,
      categoryId: 'gym',
      accountId: null,
      merchantKey: null,
      source: 'manual',
      reminderEnabled: true,
      createdAt: '2026-10-28T15:00:00.000Z',
    });
  });

  it('keeps biweekly and yearly items with their date', async () => {
    const id = await service.create({
      ...monthly('Clases', 80_000, 1, { categoryId: 'education' }),
      schedule: { periodicity: 'biweekly', anchorDate: '2026-10-16' },
    });
    expect((await service.get(id))?.schedule).toEqual({
      periodicity: 'biweekly',
      anchorDate: '2026-10-16',
    });
  });

  it('lists the items in the order they were added', async () => {
    await addAll(billetera.slice(0, 3));
    expect((await service.list()).map((i) => i.name)).toEqual([
      'Arriendo',
      'Servicios públicos',
      'Gimnasio',
    ]);
  });

  it('edits an item and keeps its id, creation time and source', async () => {
    const id = await service.create(billetera[0]!);
    clock.advance(60_000);
    await service.update(id, {
      ...billetera[0]!,
      name: ' Arriendo apto ',
      amountMinor: pesos(1_450_000),
    });
    expect(await service.get(id)).toMatchObject({
      id,
      name: 'Arriendo apto',
      amountMinor: pesos(1_450_000),
      createdAt: '2026-10-28T15:00:00.000Z',
      source: 'manual',
    });
  });

  it('deletes an item', async () => {
    const id = await service.create(billetera[0]!);
    await service.remove(id);
    expect(await service.list()).toEqual([]);
  });

  it('refuses an invalid item and an edit of a missing one', async () => {
    await expect(service.create({ ...billetera[0]!, name: '' })).rejects.toBeInstanceOf(
      InvalidRecurringError,
    );
    await expect(service.update('nope', billetera[0]!)).rejects.toBeInstanceOf(
      RecurringNotFoundError,
    );
    expect(await service.list()).toEqual([]);
  });

  it('tells subscribers about every change', async () => {
    const listener = jest.fn();
    service.subscribe(listener);
    const id = await service.create(billetera[0]!);
    await service.update(id, billetera[1]!);
    await service.remove(id);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

describe('Billetera totals', () => {
  it('gives "Gastos fijos de este mes $1.930.600" in October 2026, as in the design', async () => {
    await addAll(billetera);
    expect(formatCop(await service.fixedExpensesThisMonth())).toBe('$1.930.600');
  });

  it('gives "4 activas · $112.600/mes"', async () => {
    await addAll(billetera);
    const s = await service.subscriptionsSummary();
    expect([s.count, formatCop(s.monthlyMinor)]).toEqual([4, '$112.600']);
  });

  it('SCRUM-56: "Ahorra $56.800 al mes" from the 2 subscriptions marked "Casi nunca"', async () => {
    const ids = await addAll(billetera);
    for (const i of [5, 7]) {
      const item = billetera[i]!;
      await service.update(ids[i]!, { ...item, usage: 'low' });
    }
    await service.update(ids[4]!, { ...billetera[4]!, usage: 'high' });
    const s = await service.subscriptionsSummary();
    expect([s.lowUseCount, formatCop(s.lowUseMonthlyMinor)]).toEqual([2, '$56.800']);
  });

  it('SCRUM-56: an edit without a usage mark keeps it; a fixed expense never has one', async () => {
    const id = await service.create({ ...billetera[5]!, usage: 'low' });
    await service.update(id, { ...billetera[5]!, amountMinor: pesos(33_900) });
    expect((await service.get(id))?.usage).toBe('low');
    await service.update(id, { ...billetera[5]!, usage: null });
    expect((await service.get(id))?.usage).toBeNull();
    await service.update(id, { ...billetera[5]!, kind: 'fixed', usage: 'low' });
    expect((await service.get(id))?.usage).toBeNull();
  });

  it('gives the onboarding total $1.453.900', async () => {
    await addAll([
      monthly('Arriendo', 1_200_000, 5),
      monthly('Internet y celular', 95_000, 12, { categoryId: 'telecom' }),
      monthly('Streaming', 38_900, 18, { kind: 'subscription', categoryId: 'subscriptions' }),
      monthly('Gimnasio', 120_000, 1, { categoryId: 'gym' }),
    ]);
    expect(formatCop(await service.fixedExpensesThisMonth())).toBe('$1.453.900');
  });
});

describe('subscription detail (SCRUM-58, SCRUM-56, SCRUM-57)', () => {
  it('"Ya la cancelé": it stops counting in Billetera and stays as a record', async () => {
    const ids = await addAll(billetera);
    await service.cancel(ids[4]!); // Streaming de video, $38.900
    expect(await service.list()).toHaveLength(7);
    const s = await service.subscriptionsSummary();
    expect([s.count, formatCop(s.monthlyMinor)]).toEqual([3, '$73.700']);
    expect(formatCop(await service.fixedExpensesThisMonth())).toBe('$1.891.700');
    expect(
      await vault.db.query('SELECT status, cancelled_at FROM recurring_items WHERE id = ?', [
        ids[4],
      ]),
    ).toEqual([{ status: 'cancelled', cancelled_at: '2026-10-28T15:00:08.000Z' }]);
  });

  it('marks and clears the usage of a subscription, never of a fixed expense', async () => {
    const ids = await addAll(billetera);
    await service.setUsage(ids[5]!, 'low');
    expect((await service.get(ids[5]!))?.usage).toBe('low');
    await service.setUsage(ids[5]!, null);
    expect((await service.get(ids[5]!))?.usage).toBeNull();
    await service.setUsage(ids[0]!, 'low');
    expect((await service.get(ids[0]!))?.usage).toBeNull();
  });

  it('turns the reminder off and on', async () => {
    const [id] = await addAll([billetera[4]!]);
    await service.setReminder(id!, false);
    expect((await service.get(id!))?.reminderEnabled).toBe(false);
    await service.setReminder(id!, true);
    expect((await service.get(id!))?.reminderEnabled).toBe(true);
  });

  it('"No es una suscripción" turns it into a fixed expense without a usage mark', async () => {
    const [id] = await addAll([{ ...billetera[5]!, usage: 'low' }]);
    await service.markNotSubscription(id!);
    expect(await service.get(id!)).toMatchObject({ kind: 'fixed', usage: null });
    expect((await service.subscriptionsSummary()).count).toBe(0);
  });

  it('refuses a missing item', async () => {
    await expect(service.cancel('nope')).rejects.toThrow(RecurringNotFoundError);
    await expect(service.setUsage('nope', 'low')).rejects.toThrow(RecurringNotFoundError);
  });
});

describe('bogotaMonth', () => {
  it('uses the calendar month in Bogotá: 1 Nov 03:00 UTC is still October', () => {
    expect(bogotaMonth(new Date('2026-11-01T03:00:00Z'))).toEqual({ year: 2026, month: 10 });
    expect(bogotaMonth(new Date('2026-11-01T05:00:00Z'))).toEqual({ year: 2026, month: 11 });
  });
});
