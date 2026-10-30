// SCRUM-52 on a real SQLite vault (sql.js): a manual contribution with amount and day, a synced
// movement linked as a contribution (M7 marks it), linking the same movement twice is rejected,
// "Deshacer", and deleting a goal frees its movements. Fynk never moves money.
import { formatCop } from '@shared/domain/money';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { createVaultContributionStore } from '../adapters/vault/vaultContributionStore';
import { createVaultGoalStore } from '../adapters/vault/vaultGoalStore';
import { savingsMigrations } from '../adapters/vault/migrations';
import {
  GoalNotFoundForContributionError,
  InvalidContributionError,
  MovementAlreadyLinkedError,
  MovementNotEligibleError,
  MovementsUnavailableError,
  createContributionService,
  type ContributionService,
} from './contributionService';
import { createGoalService, type GoalService } from './goalService';
import type { MovementGoalLinker } from './contributionPorts';

const pesos = (n: number) => n * 100;
// 28 Oct 2026 in Bogotá.
const clock = createFixedClock('2026-10-28T15:00:00Z');

let vault: InMemoryVault;
let goals: GoalService;
let contributions: ContributionService;
/** M7's marks: movement id → goal id. */
let marks: Map<string, string | null>;
let linker: jest.Mocked<MovementGoalLinker>;
let goalId: string;

const movement = (id: string, amount: number, over: object = {}) => ({
  id,
  amountMinor: pesos(amount),
  bookedAt: '2026-10-20T17:00:00Z',
  status: 'booked' as const,
  goalId: null,
  ...over,
});

/** `null`: M7 does not export setTransactionGoal yet. */
function build(movements: MovementGoalLinker | null = linker) {
  let n = 0;
  contributions = createContributionService({
    store: () => createVaultContributionStore(vault.db),
    goals: () => createVaultGoalStore(vault.db),
    clock,
    newId: () => `c${++n}`,
    movements: movements ?? undefined,
    onChange: () => goals.notifyChanged(),
  });
}

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('savings', savingsMigrations);
  await vault.migrate();
  marks = new Map();
  linker = {
    setTransactionGoal: jest.fn(async (tx: string, goal: string | null) => {
      marks.set(tx, goal);
    }),
  };
  let g = 0;
  goals = createGoalService({
    store: () => createVaultGoalStore(vault.db),
    clock,
    newId: () => `g${++g}`,
    beforeRemove: (id) => contributions.unlinkGoal(id),
  });
  build();
  goalId = await goals.create({
    name: 'Viaje a Cartagena',
    category: 'travel',
    targetMinor: pesos(5_000_000),
    deadline: '2027-06',
  });
});

afterEach(() => vault.close());

describe('manual contribution ("Abonar")', () => {
  it('records $100.000 today and the goal counts it', async () => {
    const id = await contributions.add(goalId, {
      amountMinor: pesos(100_000),
      contributedOn: '2026-10-28',
      note: '  Prima ',
    });
    expect(await contributions.list(goalId)).toEqual([
      {
        id,
        goalId,
        amountMinor: pesos(100_000),
        contributedOn: '2026-10-28',
        source: 'manual',
        transactionId: null,
        note: 'Prima',
      },
    ]);
    expect(formatCop((await goals.get(goalId))!.savedMinor)).toBe('$100.000');
  });

  it('adds up to 64 % with several contributions, newest day first', async () => {
    await contributions.add(goalId, { amountMinor: pesos(2_000_000), contributedOn: '2026-09-01' });
    await contributions.add(goalId, { amountMinor: pesos(1_200_000), contributedOn: '2026-10-05' });
    expect((await contributions.list(goalId)).map((c) => c.contributedOn)).toEqual([
      '2026-10-05',
      '2026-09-01',
    ]);
    expect((await goals.get(goalId))?.percent).toBe(64);
  });

  it('refuses no amount, a future day and a goal that does not exist', async () => {
    await expect(
      contributions.add(goalId, { amountMinor: 0, contributedOn: '2026-10-28' }),
    ).rejects.toThrow(InvalidContributionError);
    await expect(
      contributions.add(goalId, { amountMinor: 1, contributedOn: '2026-10-29' }),
    ).rejects.toThrow(InvalidContributionError);
    await expect(
      contributions.add('nope', { amountMinor: 1, contributedOn: '2026-10-28' }),
    ).rejects.toThrow(GoalNotFoundForContributionError);
    expect(await contributions.list(goalId)).toEqual([]);
  });

  it('tells Metas to reload', async () => {
    const listener = jest.fn();
    goals.subscribe(listener);
    await contributions.add(goalId, { amountMinor: 1, contributedOn: '2026-10-28' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('linked movement ("Vincular un movimiento")', () => {
  it('counts an outflow for the goal and marks it in M7', async () => {
    await contributions.linkMovement(goalId, movement('t1', -300_000));
    expect(await contributions.list(goalId)).toMatchObject([
      {
        amountMinor: pesos(300_000),
        contributedOn: '2026-10-20',
        source: 'movement',
        transactionId: 't1',
      },
    ]);
    expect(marks.get('t1')).toBe(goalId);
  });

  it('rejects linking the same movement twice (M8 prompt)', async () => {
    await contributions.linkMovement(goalId, movement('t1', -300_000));
    await expect(contributions.linkMovement(goalId, movement('t1', -300_000))).rejects.toThrow(
      MovementAlreadyLinkedError,
    );
    expect((await goals.get(goalId))?.savedMinor).toBe(pesos(300_000));
  });

  it('refuses money that came in and a pending movement', async () => {
    await expect(contributions.linkMovement(goalId, movement('t2', 50_000))).rejects.toThrow(
      MovementNotEligibleError,
    );
    await expect(
      contributions.linkMovement(goalId, movement('t3', -50_000, { status: 'pending' })),
    ).rejects.toThrow(MovementNotEligibleError);
    expect(linker.setTransactionGoal).not.toHaveBeenCalled();
  });

  it('does not count the movement when M7 fails to mark it', async () => {
    linker.setTransactionGoal.mockRejectedValueOnce(new Error('vault busy'));
    await expect(contributions.linkMovement(goalId, movement('t1', -300_000))).rejects.toThrow(
      'vault busy',
    );
    expect(await contributions.list(goalId)).toEqual([]);
    // Once it was undone, the same movement can be linked again.
    await contributions.linkMovement(goalId, movement('t1', -300_000));
    expect(marks.get('t1')).toBe(goalId);
  });

  it('cannot link movements until M7 exports setTransactionGoal', async () => {
    build(null);
    await expect(contributions.linkMovement(goalId, movement('t1', -300_000))).rejects.toThrow(
      MovementsUnavailableError,
    );
  });
});

describe('"Deshacer"', () => {
  it('a manual contribution stops counting and stays in the vault as a record', async () => {
    const id = await contributions.add(goalId, {
      amountMinor: pesos(100_000),
      contributedOn: '2026-10-28',
    });
    await contributions.undo(id);
    expect(await contributions.list(goalId)).toEqual([]);
    expect((await goals.get(goalId))?.savedMinor).toBe(0);
    expect(
      await vault.db.query('SELECT deleted_at FROM savings_contributions WHERE id = ?', [id]),
    ).toEqual([{ deleted_at: '2026-10-28T15:00:00.000Z' }]);
  });

  it('a linked movement is freed in M7 and can be linked again', async () => {
    const id = await contributions.linkMovement(goalId, movement('t1', -300_000));
    await contributions.undo(id);
    expect(marks.get('t1')).toBeNull();
    await contributions.linkMovement(goalId, movement('t1', -300_000));
    expect((await goals.get(goalId))?.savedMinor).toBe(pesos(300_000));
  });

  it('does nothing for a contribution already undone', async () => {
    const id = await contributions.add(goalId, { amountMinor: 1, contributedOn: '2026-10-28' });
    await contributions.undo(id);
    await contributions.undo(id);
    expect(linker.setTransactionGoal).not.toHaveBeenCalled();
  });
});

describe('deleting a goal', () => {
  it('frees every movement linked to it', async () => {
    await contributions.linkMovement(goalId, movement('t1', -300_000));
    await contributions.linkMovement(goalId, movement('t2', -200_000));
    await goals.remove(goalId);
    expect([marks.get('t1'), marks.get('t2')]).toEqual([null, null]);
    expect(await goals.list()).toEqual([]);
  });

  it('is not deleted when M7 cannot free a movement', async () => {
    await contributions.linkMovement(goalId, movement('t1', -300_000));
    linker.setTransactionGoal.mockRejectedValueOnce(new Error('vault busy'));
    await expect(goals.remove(goalId)).rejects.toThrow('vault busy');
    expect(await goals.get(goalId)).not.toBeNull();
  });
});
