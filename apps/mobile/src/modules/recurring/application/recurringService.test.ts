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
  for (const item of items) {
    await service.create(item);
    clock.advance(1000);
  }
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

describe('bogotaMonth', () => {
  it('uses the calendar month in Bogotá: 1 Nov 03:00 UTC is still October', () => {
    expect(bogotaMonth(new Date('2026-11-01T03:00:00Z'))).toEqual({ year: 2026, month: 10 });
    expect(bogotaMonth(new Date('2026-11-01T05:00:00Z'))).toEqual({ year: 2026, month: 11 });
  });
});
