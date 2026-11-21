// HU-045 for M9: recurring.items in M2's encrypted backup, on a real SQLite vault (sql.js) with
// the module's migrations. Each write marks its item dirty, the usage mark travels with the
// item, the highest version wins on a restore, and a deleted item travels as a tombstone.
import {
  createFixedClock,
  createInMemoryBackupRegistry,
  createInMemoryVault,
  type InMemoryBackupRegistry,
  type InMemoryVault,
} from '@shared/testing';
import type { BackupRecord } from '@shared/ports';

import { createRecurringService, type RecurringService } from '../../application/recurringService';
import type { RecurringInput } from '../../domain/item';
import { WEEKDAY } from '../../domain/types';
import { recurringMigrations } from '../vault/migrations';
import { createVaultRecurringStore } from '../vault/vaultRecurringStore';
import {
  RECURRING_BACKUP_COLLECTIONS as C,
  createRecurringBackup,
  type RecurringBackup,
  type RecurringItemBackupData,
} from './recurringBackup';

const pesos = (n: number) => n * 100;
const clock = createFixedClock('2026-10-28T15:00:00Z');
const music: RecurringInput = {
  kind: 'subscription',
  name: 'Música',
  amountMinor: pesos(16_900),
  schedule: { periodicity: 'monthly', anchorDay: 7 },
  categoryId: 'subscriptions',
};
const gym: RecurringInput = {
  kind: 'fixed',
  name: 'Gimnasio',
  amountMinor: pesos(22_250),
  schedule: { periodicity: 'weekly', weekdaysMask: WEEKDAY.mon },
  categoryId: 'gym',
};

interface Phone {
  vault: InMemoryVault;
  registry: InMemoryBackupRegistry;
  backup: RecurringBackup;
  service: RecurringService;
  imports: number;
}

const phones: Phone[] = [];

async function phone(): Promise<Phone> {
  const vault = await createInMemoryVault();
  vault.registerMigrations('recurring', recurringMigrations);
  await vault.migrate();
  const registry = createInMemoryBackupRegistry();
  let n = 0;
  const service = createRecurringService({
    store: () => createVaultRecurringStore(vault.db, registry.markDirty),
    clock,
    newId: () => `r${++n}`,
  });
  const p = { vault, registry, service, imports: 0 } as Phone;
  p.backup = createRecurringBackup({
    db: () => vault.db,
    markDirty: registry.markDirty,
    onImported: () => p.imports++,
  });
  registry.registerBackupCollection(p.backup.items);
  phones.push(p);
  return p;
}

afterEach(() => {
  while (phones.length) phones.pop()?.vault.close();
});

const exported = async (p: Phone) =>
  (await p.registry.exportAll())[C.items] as BackupRecord<RecurringItemBackupData>[];

describe('markDirty after every write', () => {
  it('marks an item on create, edit, usage, reminder, "No es una suscripción" and cancel', async () => {
    const p = await phone();
    const id = await p.service.create(music);
    const steps: (() => Promise<void>)[] = [
      () => p.service.update(id, { ...music, amountMinor: pesos(18_900) }),
      () => p.service.setUsage(id, 'low'),
      () => p.service.setReminder(id, false),
      () => p.service.markNotSubscription(id),
      () => p.service.cancel(id),
    ];
    expect(p.registry.dirty(C.items)).toEqual([id]);
    for (const step of steps) {
      p.registry.clearDirty();
      await step();
      expect(p.registry.dirty(C.items)).toEqual([id]);
    }
    expect(await exported(p)).toMatchObject([
      { id, version: 6, deleted: false, data: { status: 'cancelled', kind: 'fixed' } },
    ]);
  });

  it('deleting an item leaves a tombstone', async () => {
    const p = await phone();
    const id = await p.service.create(gym);
    p.registry.clearDirty();
    await p.service.remove(id);
    expect(p.registry.dirty(C.items)).toEqual([id]);
    expect(await p.service.list()).toEqual([]);
    expect(await exported(p)).toMatchObject([
      { id, version: 2, deleted: true, data: { deletedAt: '2026-10-28T15:00:00.000Z' } },
    ]);
  });
});

describe('restore on another phone', () => {
  it('round trips items with their schedule and usage mark, and marks nothing', async () => {
    const old = await phone();
    const a = await old.service.create(music);
    await old.service.setUsage(a, 'low');
    await old.service.create(gym);
    const copy = await exported(old);

    const next = await phone();
    await next.backup.items.importAll(copy);
    expect(await next.service.list()).toEqual(await old.service.list());
    expect((await next.service.get(a))?.usage).toBe('low');
    expect(next.imports).toBe(1);
    expect(next.registry.dirty(C.items)).toEqual([]);
  });

  it('an older version never overwrites a newer one', async () => {
    const p = await phone();
    const id = await p.service.create(music);
    await p.service.setUsage(id, 'high');
    const [record] = await exported(p);
    await p.backup.items.importAll([
      { ...record!, version: 1, data: { ...record!.data, usage: 'low' } },
    ]);
    expect((await p.service.get(id))?.usage).toBe('high');
    await p.backup.items.importAll([
      { ...record!, version: 9, data: { ...record!.data, usage: 'low' } },
    ]);
    expect((await p.service.get(id))?.usage).toBe('low');
  });

  it('a tombstone deletes the item', async () => {
    const p = await phone();
    await p.service.create(music);
    const [record] = await exported(p);
    await p.backup.items.importAll([{ ...record!, version: 2, deleted: true }]);
    expect(await p.service.list()).toEqual([]);
  });

  it('skips a record with an unexpected shape', async () => {
    const p = await phone();
    const id = await p.service.create(music);
    const [record] = await exported(p);
    await p.vault.db.execute('DELETE FROM recurring_items');
    await p.backup.items.importAll([
      { ...record!, data: { ...record!.data, categoryId: 'casino' as never } },
      {
        ...record!,
        id: `${id}-2`,
        data: { ...record!.data, schedule: { periodicity: 'hourly' } as never },
      },
    ]);
    expect(await exported(p)).toEqual([]);
  });
});

describe('items from before the backup', () => {
  it('are marked dirty once when the vault opens', async () => {
    const vault = await createInMemoryVault();
    vault.registerMigrations('recurring', recurringMigrations.slice(0, 1));
    await vault.migrate();
    await vault.db.execute(
      `INSERT INTO recurring_items (id, kind, name, category_id, amount_minor, periodicity,
         anchor_day, source, created_at)
       VALUES ('r-old', 'fixed', 'Arriendo', 'rent', 100, 'monthly', 1, 'manual',
         '2026-10-01T00:00:00Z')`,
    );
    // Version 2 as an update of the app runs it on this vault.
    for (const statement of recurringMigrations[1]!.up.split(';')) {
      if (statement.trim()) await vault.db.execute(statement);
    }
    const registry = createInMemoryBackupRegistry();
    const backup = createRecurringBackup({
      db: () => vault.db,
      markDirty: registry.markDirty,
      onImported: () => undefined,
    });
    registry.registerBackupCollection(backup.items);
    await backup.flushPending();
    expect(registry.dirty(C.items)).toEqual(['r-old']);
    registry.clearDirty();
    await backup.flushPending();
    expect(registry.dirty(C.items)).toEqual([]);
    vault.close();
  });
});
