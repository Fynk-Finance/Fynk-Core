import { createFakeCollection, createLockableVault } from './backupTestkit';

const goals = () => createFakeCollection('savings.goals', 'savings').collection;

describe('registerBackupCollection', () => {
  it('registers a collection whose name starts with its module', async () => {
    const { registry } = await createLockableVault();
    registry.registerBackupCollection(goals());
    expect(registry.collections()).toEqual(['savings.goals']);
    expect(registry.collection('savings.goals')).toBeDefined();
  });

  it('refuses a collection that does not start with its module name', async () => {
    const { registry } = await createLockableVault();
    const wrong = createFakeCollection('recurring.items', 'savings').collection;
    expect(() => registry.registerBackupCollection(wrong)).toThrow(/must start with "savings\."/);
  });

  it('refuses the bank module', async () => {
    const { registry } = await createLockableVault();
    const bank = createFakeCollection('bank.movements', 'bank').collection;
    expect(() => registry.registerBackupCollection(bank)).toThrow(/never backed up/);
  });

  it('refuses a second registration of the same collection', async () => {
    const { registry } = await createLockableVault();
    registry.registerBackupCollection(goals());
    expect(() => registry.registerBackupCollection(goals())).toThrow(/already registered/);
  });
});

describe('markDirty', () => {
  it('throws for an unknown collection, synchronously', async () => {
    const { registry } = await createLockableVault();
    expect(() => registry.markDirty('savings.goals', 'g1')).toThrow(/not registered/);
  });

  it('writes one row per record with a growing seq while the vault is open', async () => {
    const { registry, dirty } = await createLockableVault();
    registry.registerBackupCollection(goals());
    registry.markDirty('savings.goals', 'g1');
    registry.markDirty('savings.goals', 'g2');
    registry.markDirty('savings.goals', 'g1');
    await registry.settled();
    const rows = await dirty();
    expect(rows.map((r) => r.record_id)).toEqual(['g1', 'g2']);
    // g1 was marked again after g2, so it has the highest seq.
    expect(rows[0]!.seq).toBeGreaterThan(rows[1]!.seq);
    expect((await registry.readDirty()).map((r) => r.recordId)).toEqual(['g2', 'g1']);
  });

  it('tells its listeners', async () => {
    const { registry } = await createLockableVault();
    registry.registerBackupCollection(goals());
    const listener = jest.fn();
    const off = registry.onMarked(listener);
    registry.markDirty('savings.goals', 'g1');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    registry.markDirty('savings.goals', 'g1');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the id in memory while the vault is locked and writes it on unlock', async () => {
    const { registry, dirty, lock, unlock } = await createLockableVault();
    registry.registerBackupCollection(goals());
    lock();
    registry.markDirty('savings.goals', 'g1');
    registry.markDirty('savings.goals', 'g1');
    await registry.settled();
    expect(await dirty()).toEqual([]);
    unlock();
    await registry.settled();
    expect((await dirty()).map((r) => r.record_id)).toEqual(['g1']);
  });

  it('forgets the ids kept in memory on reset (wipe)', async () => {
    const { registry, dirty, lock, unlock } = await createLockableVault();
    registry.registerBackupCollection(goals());
    lock();
    registry.markDirty('savings.goals', 'g1');
    registry.reset();
    unlock();
    await registry.settled();
    expect(await dirty()).toEqual([]);
  });
});

describe('clearDirty', () => {
  it('deletes only the given rows, and not a row marked again after maxSeq', async () => {
    const { registry, dirty } = await createLockableVault();
    registry.registerBackupCollection(goals());
    registry.markDirty('savings.goals', 'g1');
    registry.markDirty('savings.goals', 'g2');
    registry.markDirty('savings.goals', 'g3');
    await registry.settled();
    const seen = await registry.readDirty();
    const maxSeq = Math.max(...seen.map((r) => r.seq));
    // g1 changes again while an upload of g1 and g2 is in flight.
    registry.markDirty('savings.goals', 'g1');
    await registry.settled();
    await registry.clearDirty(seen.slice(0, 2), maxSeq);
    expect((await dirty()).map((r) => r.record_id)).toEqual(['g1', 'g3']);
  });
});
