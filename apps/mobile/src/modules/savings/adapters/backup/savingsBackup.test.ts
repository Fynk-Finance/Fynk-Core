// HU-045 for M8: savings.goals and savings.contributions in M2's encrypted backup, on a real
// SQLite vault (sql.js) with the module's migrations. Each write marks its row dirty, the
// highest version wins on a restore, and a deleted goal travels as tombstones.
import {
  createFixedClock,
  createInMemoryBackupRegistry,
  createInMemoryVault,
  type InMemoryBackupRegistry,
  type InMemoryVault,
} from '@shared/testing';
import type { BackupRecord } from '@shared/ports';

import { createContributionService } from '../../application/contributionService';
import { createGoalService, type GoalService } from '../../application/goalService';
import type { GoalInput } from '../../domain/goal';
import { savingsMigrations } from '../vault/migrations';
import { createVaultContributionStore } from '../vault/vaultContributionStore';
import { createVaultGoalStore } from '../vault/vaultGoalStore';
import {
  SAVINGS_BACKUP_COLLECTIONS as C,
  createSavingsBackup,
  type ContributionBackupData,
  type GoalBackupData,
  type SavingsBackup,
} from './savingsBackup';

const pesos = (n: number) => n * 100;
const clock = createFixedClock('2026-10-28T15:00:00Z');
const trip: GoalInput = {
  name: 'Viaje a Cartagena',
  category: 'travel',
  targetMinor: pesos(5_000_000),
  deadline: '2027-06',
};

interface Phone {
  vault: InMemoryVault;
  registry: InMemoryBackupRegistry;
  backup: SavingsBackup;
  goals: GoalService;
  contributions: ReturnType<typeof createContributionService>;
  changes: number;
}

const phones: Phone[] = [];

async function phone(): Promise<Phone> {
  const vault = await createInMemoryVault();
  vault.registerMigrations('savings', savingsMigrations);
  await vault.migrate();
  const registry = createInMemoryBackupRegistry();
  let n = 0;
  const goals = createGoalService({
    store: () => createVaultGoalStore(vault.db, registry.markDirty),
    clock,
    newId: () => `g${++n}`,
  });
  const contributions = createContributionService({
    store: () => createVaultContributionStore(vault.db, registry.markDirty),
    goals: () => createVaultGoalStore(vault.db, registry.markDirty),
    clock,
    newId: () => `c${++n}`,
    onChange: () => goals.notifyChanged(),
  });
  const p: Phone = { vault, registry, goals, contributions, changes: 0 } as Phone;
  p.backup = createSavingsBackup({
    db: () => vault.db,
    markDirty: registry.markDirty,
    onImported: () => p.changes++,
  });
  registry.registerBackupCollection(p.backup.goals);
  registry.registerBackupCollection(p.backup.contributions);
  phones.push(p);
  return p;
}

afterEach(() => {
  while (phones.length) phones.pop()?.vault.close();
});

const contribute = async (p: Phone, goalId: string, amount: number) => ({
  id: await p.contributions.add(goalId, {
    amountMinor: pesos(amount),
    contributedOn: '2026-10-20',
  }),
});

describe('markDirty after every write', () => {
  it('marks a goal when it is created and when it is edited', async () => {
    const p = await phone();
    const id = await p.goals.create(trip);
    expect(p.registry.dirty(C.goals)).toEqual([id]);
    p.registry.clearDirty();
    await p.goals.update(id, { ...trip, name: 'Viaje a San Andrés' });
    expect(p.registry.dirty(C.goals)).toEqual([id]);
    expect((await p.backup.goals.exportAll())[0]?.version).toBe(2);
  });

  it('marks a contribution when it is added and when it is undone', async () => {
    const p = await phone();
    const goalId = await p.goals.create(trip);
    const { id } = await contribute(p, goalId, 200_000);
    expect(p.registry.dirty(C.contributions)).toEqual([id]);
    p.registry.clearDirty();
    await p.contributions.undo(id);
    expect(p.registry.dirty(C.contributions)).toEqual([id]);
    expect(await p.backup.contributions.exportAll()).toMatchObject([
      { id, version: 2, deleted: true },
    ]);
  });

  it('deleting a goal leaves tombstones for it and its contributions', async () => {
    const p = await phone();
    const goalId = await p.goals.create(trip);
    const a = await contribute(p, goalId, 200_000);
    const b = await contribute(p, goalId, 100_000);
    p.registry.clearDirty();
    await p.goals.remove(goalId);
    expect(p.registry.dirty(C.goals)).toEqual([goalId]);
    expect(p.registry.dirty(C.contributions).sort()).toEqual([a.id, b.id].sort());
    expect(await p.backup.goals.exportAll()).toMatchObject([
      { id: goalId, version: 2, deleted: true, data: { deletedAt: '2026-10-28T15:00:00.000Z' } },
    ]);
    expect((await p.backup.contributions.exportAll()).every((r) => r.deleted)).toBe(true);
    expect(await p.goals.get(goalId)).toBeNull();
  });
});

describe('restore on another phone', () => {
  it('round trips goals and contributions, whatever order M2 imports them', async () => {
    const old = await phone();
    const goalId = await old.goals.create(trip);
    await contribute(old, goalId, 3_200_000);
    const copy = await old.registry.exportAll();

    const next = await phone();
    // Contributions first: they wait for their goal.
    await next.backup.contributions.importAll(
      copy[C.contributions] as BackupRecord<ContributionBackupData>[],
    );
    await next.backup.goals.importAll(copy[C.goals] as BackupRecord<GoalBackupData>[]);
    const [goal] = await next.goals.list();
    expect(goal).toMatchObject({ id: goalId, name: 'Viaje a Cartagena' });
    expect(goal?.savedMinor).toBe(pesos(3_200_000));
    expect(next.changes).toBeGreaterThan(0);
    // An import is already in the backup: it marks nothing.
    expect(next.registry.dirty(C.goals)).toEqual([]);
    expect(next.registry.dirty(C.contributions)).toEqual([]);
  });

  it('an older version never overwrites a newer one', async () => {
    const p = await phone();
    const id = await p.goals.create(trip);
    await p.goals.update(id, { ...trip, name: 'Viaje a San Andrés' });
    const [record] = await p.backup.goals.exportAll();
    await p.backup.goals.importAll([
      { ...record!, version: 1, data: { ...record!.data, name: 'Viaje viejo' } },
    ]);
    expect((await p.goals.get(id))?.name).toBe('Viaje a San Andrés');
    await p.backup.goals.importAll([
      { ...record!, version: 3, data: { ...record!.data, name: 'Viaje nuevo' } },
    ]);
    expect((await p.goals.get(id))?.name).toBe('Viaje nuevo');
  });

  it('a tombstone deletes the goal, and its contributions stop counting', async () => {
    const p = await phone();
    const goalId = await p.goals.create(trip);
    await contribute(p, goalId, 200_000);
    const [record] = await p.backup.goals.exportAll();
    await p.backup.goals.importAll([
      { ...record!, version: 5, deleted: true, data: { ...record!.data, deletedAt: 'x' } },
    ]);
    expect(await p.goals.list()).toEqual([]);

    // A live contribution of a deleted goal is kept as deleted.
    const other = await phone();
    await other.backup.goals.importAll([{ ...record!, version: 5, deleted: true }]);
    const [c] = await p.backup.contributions.exportAll();
    await other.backup.contributions.importAll([c!]);
    expect(await other.backup.contributions.exportAll()).toMatchObject([{ deleted: true }]);
  });

  it('skips a record with an unexpected shape', async () => {
    const p = await phone();
    await p.backup.goals.importAll([
      {
        id: 'bad',
        version: 1,
        deleted: false,
        data: { name: 'X', category: 'casino', targetMinor: 1, deadline: '2027-01' } as never,
      },
    ]);
    expect(await p.backup.goals.exportAll()).toEqual([]);
  });
});

describe('rows from before the backup', () => {
  it('are marked dirty once when the vault opens', async () => {
    const vault = await createInMemoryVault();
    vault.registerMigrations('savings', savingsMigrations.slice(0, 2));
    await vault.migrate();
    await vault.db.execute(
      `INSERT INTO savings_goals (id, name, category, target_minor, deadline_month, created_at)
       VALUES ('g-old', 'Viaje', 'travel', 100, '2027-06', '2026-10-01T00:00:00Z')`,
    );
    await vault.db.execute(
      `INSERT INTO savings_contributions (id, goal_id, amount_minor, contributed_on, source)
       VALUES ('c-old', 'g-old', 50, '2026-10-02', 'manual')`,
    );
    // Version 3 as an update of the app runs it on this vault.
    for (const statement of savingsMigrations[2]!.up.split(';')) {
      if (statement.trim()) await vault.db.execute(statement);
    }

    const registry = createInMemoryBackupRegistry();
    const backup = createSavingsBackup({
      db: () => vault.db,
      markDirty: registry.markDirty,
      onImported: () => undefined,
    });
    registry.registerBackupCollection(backup.goals);
    registry.registerBackupCollection(backup.contributions);
    await backup.flushPending();
    expect(registry.dirty(C.goals)).toEqual(['g-old']);
    expect(registry.dirty(C.contributions)).toEqual(['c-old']);
    expect((await backup.goals.exportAll())[0]?.version).toBe(1);
    registry.clearDirty();
    await backup.flushPending();
    expect(registry.dirty(C.goals)).toEqual([]);
    vault.close();
  });
});
