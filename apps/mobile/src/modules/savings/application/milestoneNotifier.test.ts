// SCRUM-53 on a real SQLite vault (sql.js): a notice at 50 %, 75 % and 100 % through M12's
// NotificationsPort, once each, one per goal when a contribution jumps two milestones, and the
// milestones of a deleted goal go with it.
import type { NotifyInput } from '@shared/ports';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { savingsMigrations } from '../adapters/vault/migrations';
import { createVaultGoalStore } from '../adapters/vault/vaultGoalStore';
import { createVaultMilestoneStore } from '../adapters/vault/vaultMilestoneStore';
import { createGoalService, type GoalService } from './goalService';
import { createMilestoneNotifier } from './milestoneNotifier';

const pesos = (n: number) => n * 100;
const clock = createFixedClock('2026-10-28T15:00:00Z');

let vault: InMemoryVault;
let goals: GoalService;
let notices: NotifyInput[];
let check: () => Promise<void>;
let goalId: string;
let n = 0;

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('savings', savingsMigrations);
  await vault.migrate();
  let g = 0;
  goals = createGoalService({
    store: () => createVaultGoalStore(vault.db),
    clock,
    newId: () => `g${++g}`,
  });
  notices = [];
  const notifier = createMilestoneNotifier({
    goals: () => goals.list(),
    store: () => createVaultMilestoneStore(vault.db),
    notifications: {
      notify: jest.fn(async (input: NotifyInput) => {
        notices.push(input);
      }),
    },
    clock,
  });
  check = notifier.check;
  goalId = await goals.create({
    name: 'Viaje a Cartagena',
    category: 'travel',
    targetMinor: pesos(5_000_000),
    deadline: '2027-06',
  });
});

afterEach(() => vault.close());

/** A contribution of SCRUM-52 (record only), or a negative one to undo part of the saving. */
async function save(amount: number) {
  if (amount < 0) {
    await vault.db.execute(
      `UPDATE savings_contributions SET deleted_at = '2026-10-28' WHERE id = ?`,
      [`c${n}`],
    );
    return;
  }
  await vault.db.execute(
    `INSERT INTO savings_contributions (id, goal_id, amount_minor, contributed_on, source)
     VALUES (?, ?, ?, '2026-10-28', 'manual')`,
    [`c${++n}`, goalId, pesos(amount)],
  );
}

describe('milestone notices', () => {
  it('"Viaje a Cartagena · Llegaste al 64 % de tu meta." as in Notificaciones', async () => {
    await save(3_200_000);
    await check();
    expect(notices).toEqual([
      {
        kind: 'goal_milestone',
        title: 'Viaje a Cartagena',
        body: 'Llegaste al 64 % de tu meta.',
        deepLink: 'fynk://metas',
        dedupeKey: `goal:${goalId}:50`,
      },
    ]);
  });

  it('nothing below 50 %, and no repeat on the next checks', async () => {
    await save(2_400_000);
    await check();
    expect(notices).toEqual([]);
    await save(200_000);
    await check();
    await check();
    expect(notices.map((x) => x.dedupeKey)).toEqual([`goal:${goalId}:50`]);
  });

  it('notices 50 % once when progress goes 49, 51, 49, 51 (M8 prompt test)', async () => {
    await save(2_450_000); // 49 %
    await check();
    await save(100_000); // 51 %
    await check();
    await save(-100_000); // back to 49 %
    await check();
    await save(100_000); // 51 % again
    await check();
    expect(notices.map((x) => x.body)).toEqual(['Llegaste al 51 % de tu meta.']);
  });

  it('gives one notice, for 75 %, when a contribution jumps from 40 % to 80 %', async () => {
    await save(2_000_000);
    await check();
    await save(2_000_000);
    await check();
    expect(notices.map((x) => [x.dedupeKey, x.body])).toEqual([
      [`goal:${goalId}:75`, 'Llegaste al 80 % de tu meta.'],
    ]);
    // 50 % was passed too: it never comes later.
    await check();
    expect(notices).toHaveLength(1);
  });

  it('celebrates 100 % with the target', async () => {
    await save(4_000_000);
    await check();
    await save(1_000_000);
    await check();
    expect(notices.map((x) => x.body)).toEqual([
      'Llegaste al 80 % de tu meta.',
      'Cumpliste tu meta de $5.000.000. ¡Bien hecho!',
    ]);
  });

  it('tries again when M12 fails, without losing the milestone', async () => {
    const failing = createMilestoneNotifier({
      goals: () => goals.list(),
      store: () => createVaultMilestoneStore(vault.db),
      notifications: { notify: jest.fn().mockRejectedValueOnce(new Error('vault busy')) },
      clock,
    });
    await save(3_000_000);
    await expect(failing.check()).rejects.toThrow('vault busy');
    await check();
    expect(notices.map((x) => x.dedupeKey)).toEqual([`goal:${goalId}:50`]);
  });

  it('deleting a goal deletes its milestones', async () => {
    await save(3_000_000);
    await check();
    await goals.remove(goalId);
    expect(await vault.db.query('SELECT * FROM savings_milestones')).toEqual([]);
  });
});
