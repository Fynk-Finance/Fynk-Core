// SCRUM-51 on a real SQLite vault (sql.js) with the module's migrations: several goals, edit and
// delete, the suggested monthly amount, and the saved amount as the sum of contributions.
import { formatCop } from '@shared/domain/money';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { savingsMigrations } from '../adapters/vault/migrations';
import { createVaultGoalStore } from '../adapters/vault/vaultGoalStore';
import type { GoalInput } from '../domain/goal';
import {
  GoalNotFoundError,
  InvalidGoalError,
  bogotaToday,
  createGoalService,
  paceWindowStart,
  type GoalService,
} from './goalService';

const pesos = (n: number) => n * 100;
const clock = createFixedClock('2026-10-28T15:00:00Z');

const trip: GoalInput = {
  name: 'Viaje a Cartagena',
  category: 'travel',
  targetMinor: pesos(5_000_000),
  deadline: '2027-06',
};
const emergency: GoalInput = {
  name: 'Fondo de emergencia',
  category: 'emergency',
  targetMinor: pesos(3_000_000),
  deadline: '2027-12',
};
const gifts: GoalInput = {
  name: 'Regalos de Navidad',
  category: 'other',
  targetMinor: pesos(800_000),
  deadline: '2026-12',
};

let vault: InMemoryVault;
let service: GoalService;

beforeEach(async () => {
  clock.set('2026-10-28T15:00:00Z');
  vault = await createInMemoryVault();
  vault.registerMigrations('savings', savingsMigrations);
  await vault.migrate();
  let n = 0;
  service = createGoalService({
    store: () => createVaultGoalStore(vault.db),
    clock,
    newId: () => `g${++n}`,
  });
});

afterEach(() => vault.close());

/** A contribution as SCRUM-52 will record it (manual, a record: Fynk never moves money). */
async function contribute(
  goalId: string,
  amount: number,
  id = `c-${goalId}-${amount}`,
  on = '2026-10-20',
) {
  await vault.db.execute(
    `INSERT INTO savings_contributions (id, goal_id, amount_minor, contributed_on, source)
     VALUES (?, ?, ?, ?, 'manual')`,
    [id, goalId, pesos(amount), on],
  );
}

describe('savings goals in the vault', () => {
  it('creates a goal and reads it back with "8 meses · $625.000" (OnbMetas)', async () => {
    const id = await service.create({ ...trip, name: '  Viaje a Cartagena ' });
    expect(await service.get(id)).toMatchObject({
      id: 'g1',
      name: 'Viaje a Cartagena',
      category: 'travel',
      targetMinor: pesos(5_000_000),
      deadline: '2027-06',
      createdAt: '2026-10-28T15:00:00.000Z',
      savedMinor: 0,
      monthsLeft: 8,
      suggestedMonthlyMinor: pesos(625_000),
    });
  });

  it('keeps several goals, nearest deadline first ("Por fecha límite")', async () => {
    await service.create(trip);
    await service.create(emergency);
    await service.create(gifts);
    expect((await service.list()).map((g) => g.name)).toEqual([
      'Regalos de Navidad',
      'Viaje a Cartagena',
      'Fondo de emergencia',
    ]);
  });

  it('the saved amount is the sum of its contributions: 64 % of the trip', async () => {
    const id = await service.create(trip);
    await contribute(id, 2_000_000);
    await contribute(id, 1_200_000);
    const g = await service.get(id);
    expect([formatCop(g!.savedMinor), g!.percent, formatCop(g!.remainingMinor)]).toEqual([
      '$3.200.000',
      64,
      '$1.800.000',
    ]);
  });

  it('a deleted contribution does not count', async () => {
    const id = await service.create(gifts);
    await contribute(id, 520_000);
    await contribute(id, 100_000, 'gone');
    await vault.db.execute(`UPDATE savings_contributions SET deleted_at = ? WHERE id = 'gone'`, [
      '2026-10-27T10:00:00.000Z',
    ]);
    expect((await service.get(id))?.savedMinor).toBe(pesos(520_000));
  });

  it('edits a goal and keeps its id and creation time', async () => {
    const id = await service.create(trip);
    clock.advance(60_000);
    await service.update(id, { ...trip, targetMinor: pesos(6_000_000), deadline: '2027-08' });
    expect(await service.get(id)).toMatchObject({
      id,
      targetMinor: pesos(6_000_000),
      deadline: '2027-08',
      createdAt: '2026-10-28T15:00:00.000Z',
    });
  });

  it('an old goal keeps a deadline that already passed, but a new deadline cannot be past', async () => {
    const id = await service.create(gifts);
    clock.set('2027-02-10T15:00:00Z');
    await service.update(id, { ...gifts, name: 'Regalos 2026' });
    expect((await service.get(id))?.name).toBe('Regalos 2026');
    await expect(service.update(id, { ...gifts, deadline: '2027-01' })).rejects.toThrow(
      InvalidGoalError,
    );
  });

  it('deletes a goal with its contributions', async () => {
    const id = await service.create(trip);
    await contribute(id, 1_000_000);
    await service.remove(id);
    expect(await service.list()).toEqual([]);
    expect(await vault.db.query('SELECT id FROM savings_contributions')).toEqual([]);
  });

  it('refuses an invalid goal and an edit of a missing one', async () => {
    await expect(service.create({ ...trip, name: '' })).rejects.toThrow(InvalidGoalError);
    await expect(service.update('nope', trip)).rejects.toThrow(GoalNotFoundError);
    expect(await service.list()).toEqual([]);
  });

  it('tells subscribers about every change', async () => {
    const listener = jest.fn();
    const unsubscribe = service.subscribe(listener);
    const id = await service.create(trip);
    await service.update(id, emergency);
    await service.remove(id);
    unsubscribe();
    await service.create(trip);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

describe('monthly total', () => {
  it('gives "2 metas $840.000/mes" for $625.000 + $215.000', async () => {
    await service.create(trip);
    await service.create({ ...emergency, deadline: '2027-12' });
    // 3.000.000 over 14 months, from October 2026 to December 2027.
    expect(formatCop(await service.monthlyTotal())).toBe('$840.000');
  });

  it('leaves out a goal already reached', async () => {
    await service.create(trip);
    const done = await service.create(gifts);
    await contribute(done, 800_000);
    expect(formatCop(await service.monthlyTotal())).toBe('$625.000');
  });
});

describe('overview (Metas stats card)', () => {
  it('gives Ahorrado, Abonado este mes and Cumplidas', async () => {
    const tripId = await service.create(trip);
    const done = await service.create(gifts);
    await contribute(tripId, 2_000_000, 'old', '2026-09-15');
    await contribute(tripId, 940_000, 'oct', '2026-10-05');
    await contribute(done, 800_000, 'gifts', '2026-08-20');
    expect(await service.overview()).toEqual({
      savedMinor: pesos(3_740_000),
      contributedThisMonthMinor: pesos(940_000),
      doneCount: 1,
      monthlyMinor: (await service.get(tripId))!.suggestedMonthlyMinor,
    });
    expect((await service.get(done))?.completedOn).toBe('2026-08-20');
    expect((await service.get(tripId))?.completedOn).toBeNull();
  });
});

describe('pace (SCRUM-53: "Indica si el ritmo permite cumplir")', () => {
  // Regalos de Navidad: $800.000 for Dec 2026, created on 1 Aug. Today is 28 Oct.
  async function gifts3Months(amounts: [string, number][]) {
    const id = await service.create(gifts);
    await vault.db.execute(`UPDATE savings_goals SET created_at = '2026-08-01T15:00:00.000Z'`);
    for (const [on, amount] of amounts) await contribute(id, amount, `c-${on}`, on);
    return (await service.get(id))!;
  }

  it('is on track when the last 3 months average at least the suggested amount', async () => {
    // 520.000 saved → $140.000 a month for 2 months; average (180 + 170 + 170) / 3 = 173.333.
    const g = await gifts3Months([
      ['2026-08-10', 180_000],
      ['2026-09-10', 170_000],
      ['2026-10-10', 170_000],
    ]);
    expect(g.pace).toEqual({ status: 'on_track' });
  });

  it('says how much more a month is needed', async () => {
    // 300.000 saved → $250.000 a month; average 100.000 → "Te faltan $150.000 al mes".
    const g = await gifts3Months([
      ['2026-08-10', 100_000],
      ['2026-09-10', 100_000],
      ['2026-10-10', 100_000],
    ]);
    expect(g.pace).toEqual({ status: 'behind', missingMonthlyMinor: pesos(150_000) });
  });

  it('only counts the current month and the two before it', async () => {
    const g = await gifts3Months([
      ['2026-07-31', 600_000],
      ['2026-10-10', 100_000],
    ]);
    // 700.000 saved → $50.000 a month; average of Aug-Oct is 33.334 → behind by $17.000.
    expect(g.pace).toEqual({ status: 'behind', missingMonthlyMinor: pesos(17_000) });
  });

  it('a reached goal is done', async () => {
    const g = await gifts3Months([['2026-10-10', 800_000]]);
    expect(g.pace).toEqual({ status: 'done' });
  });
});

describe('paceWindowStart', () => {
  it('starts two months before the current one, across the year', () => {
    expect(paceWindowStart('2026-10-28')).toBe('2026-08-01');
    expect(paceWindowStart('2027-01-05')).toBe('2026-11-01');
  });
});

describe('bogotaToday', () => {
  it('is still the previous day at 02:00 UTC', () => {
    expect(bogotaToday(new Date('2026-11-01T02:00:00Z'))).toBe('2026-10-31');
  });
});
