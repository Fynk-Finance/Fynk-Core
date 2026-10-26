import type { BackupCollection, BackupRecord } from '../ports/backup';
import { createInMemoryBackupRegistry } from './inMemoryBackupRegistry';

interface Goal {
  name: string;
}

function goalsCollection(store: BackupRecord<Goal>[] = []): BackupCollection<Goal> {
  return {
    module: 'savings',
    collection: 'savings.goals',
    exportAll: async () => store,
    importAll: async (records) => {
      store.splice(0, store.length, ...records);
    },
  };
}

describe('createInMemoryBackupRegistry', () => {
  it('registers collections and tracks dirty ids once each', () => {
    const registry = createInMemoryBackupRegistry();
    registry.registerBackupCollection(goalsCollection());

    registry.markDirty('savings.goals', 'g1');
    registry.markDirty('savings.goals', 'g1');
    registry.markDirty('savings.goals', 'g2');

    expect(registry.collections()).toEqual(['savings.goals']);
    expect(registry.dirty('savings.goals')).toEqual(['g1', 'g2']);

    registry.clearDirty();
    expect(registry.dirty('savings.goals')).toEqual([]);
  });

  it('exports and imports every registered collection', async () => {
    const store: BackupRecord<Goal>[] = [];
    const registry = createInMemoryBackupRegistry();
    registry.registerBackupCollection(goalsCollection(store));
    const record = { id: 'g1', version: 3, deleted: false, data: { name: 'Viaje' } };

    await registry.importAll({ 'savings.goals': [record] });

    expect(await registry.exportAll()).toEqual({ 'savings.goals': [record] });
  });

  it('rejects unknown collections', async () => {
    const registry = createInMemoryBackupRegistry();
    expect(() => registry.markDirty('savings.goals', 'g1')).toThrow('is not registered');
    expect(() => registry.dirty('savings.goals')).toThrow('is not registered');
    await expect(registry.importAll({ 'savings.goals': [] })).rejects.toThrow('is not registered');
  });

  it('rejects a duplicate, a name outside the module and any bank collection', () => {
    const registry = createInMemoryBackupRegistry();
    registry.registerBackupCollection(goalsCollection());

    expect(() => registry.registerBackupCollection(goalsCollection())).toThrow(
      'already registered',
    );
    expect(() =>
      registry.registerBackupCollection({ ...goalsCollection(), collection: 'recurring.items' }),
    ).toThrow('must start with "savings."');
    expect(() =>
      registry.registerBackupCollection({
        ...goalsCollection(),
        module: 'bank',
        collection: 'bank.tokens',
      }),
    ).toThrow('never backed up');
  });
});
