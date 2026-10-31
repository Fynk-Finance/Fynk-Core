import type { BackupRecord } from '@shared/ports/backup';

import { openRecord, sealRecord, type SealedBackupRecord } from '../domain/backupEnvelope';
import { deriveBackupKey } from '../domain/crypto';
import { createBackupSync, UPLOAD_DEBOUNCE_MS } from './backupSync';
import { createFakeCollection, createLockableVault, goal, type Goal } from './backupTestkit';
import { BackupError, type BackupErrorKind, type BackupRecordsApiPort } from './ports';

const KEY = deriveBackupKey(Uint8Array.from({ length: 32 }, (_, i) => i + 1));
const USER = 'user-a';

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

// A server that behaves like the real one: atomic batches, stale versions refused, pages.
function createFakeApi(pageSize = 500) {
  const stored = new Map<string, SealedBackupRecord>();
  const puts: SealedBackupRecord[][] = [];
  const lists: (string | null)[] = [];
  let failWith: BackupErrorKind | null = null;
  let gate: Promise<void> | null = null;
  const api: BackupRecordsApiPort = {
    async put(records) {
      puts.push(records);
      if (gate) await gate;
      if (failWith) throw new BackupError(failWith);
      for (const r of records) {
        const known = stored.get(`${r.collection}/${r.recordId}`);
        if (known && known.version > r.version) throw new BackupError('stale');
      }
      for (const r of records) stored.set(`${r.collection}/${r.recordId}`, r);
    },
    async list(cursor) {
      lists.push(cursor);
      const all = [...stored.values()];
      const from = cursor ? Number(cursor) : 0;
      const records = all.slice(from, from + pageSize);
      const next = from + pageSize;
      // Like the real API: a full last page is followed by an empty one.
      return { records, nextCursor: records.length === pageSize ? String(next) : null };
    },
  };
  return {
    api,
    stored,
    puts,
    lists,
    failWith: (kind: BackupErrorKind | null) => (failWith = kind),
    hold: () => {
      const d = deferred();
      gate = d.promise;
      return () => {
        gate = null;
        d.resolve();
      };
    },
  };
}

async function setup(options: { pageSize?: number; userId?: string | null; key?: boolean } = {}) {
  const kit = await createLockableVault();
  const server = createFakeApi(options.pageSize);
  const goals = createFakeCollection('savings.goals', 'savings');
  const caps = createFakeCollection('analytics.caps', 'analytics');
  kit.registry.registerBackupCollection(goals.collection);
  kit.registry.registerBackupCollection(caps.collection);
  let background = (): void => undefined;
  const state = { userId: options.userId === undefined ? USER : options.userId };
  const getBackupKey = jest.fn(async () => (options.key === false ? null : KEY));
  let counter = 0;
  const randomBytes = jest.fn((n: number) => {
    counter += 1;
    return new Uint8Array(n).fill(counter % 256).map((v, i) => (v + i + (counter >> 8)) % 256);
  });
  const sync = createBackupSync({
    registry: kit.registry,
    api: server.api,
    getBackupKey,
    userId: () => state.userId,
    randomBytes,
    events: kit.events,
    watchBackground: (cb) => {
      background = cb;
      return () => undefined;
    },
  });
  return {
    ...kit,
    server,
    goals,
    caps,
    sync,
    state,
    getBackupKey,
    randomBytes,
    goBackground: () => background(),
  };
}

const flush = () => jest.advanceTimersByTimeAsync(0);
const ids = (rows: { record_id: string }[]) => rows.map((r) => r.record_id);

/** What another phone would have uploaded. */
const remote = (collection: string, record: BackupRecord<Goal>, nonceByte = 9) =>
  sealRecord({
    backupKey: KEY,
    userId: USER,
    collection,
    record,
    nonce: new Uint8Array(12).fill(nonceByte),
  });

describe('uploads', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('seals and sends the dirty records, then clears them', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1', 2));
    t.registry.markDirty('savings.goals', 'g1');
    expect(await t.sync.uploadNow()).toBe('done');
    expect(t.server.puts).toHaveLength(1);
    const sent = t.server.puts[0]![0]!;
    expect(sent.collection).toBe('savings.goals');
    expect(sent.version).toBe(2);
    expect(openRecord({ backupKey: KEY, userId: USER, ...sent })).toEqual({
      id: 'g1',
      version: 2,
      deleted: false,
      data: { name: 'Meta g1' },
    });
    expect(await t.dirty()).toEqual([]);
  });

  it('uses a fresh nonce for every record', async () => {
    const t = await setup();
    for (const id of ['g1', 'g2', 'g3']) {
      t.goals.store.set(id, goal(id));
      t.registry.markDirty('savings.goals', id);
    }
    await t.sync.uploadNow();
    const nonces = t.server.puts[0]!.map((r) => Array.from(r.nonce).join());
    expect(new Set(nonces).size).toBe(3);
    expect(t.randomBytes).toHaveBeenCalledTimes(3);
    expect(t.randomBytes).toHaveBeenCalledWith(12);
  });

  it('uploads 5 s after the last change, and each change restarts the wait', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1'));
    t.registry.markDirty('savings.goals', 'g1');
    await jest.advanceTimersByTimeAsync(UPLOAD_DEBOUNCE_MS - 1);
    expect(t.server.puts).toHaveLength(0);
    t.registry.markDirty('savings.goals', 'g1');
    await jest.advanceTimersByTimeAsync(UPLOAD_DEBOUNCE_MS - 1);
    expect(t.server.puts).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(1);
    await flush();
    expect(t.server.puts).toHaveLength(1);
    expect(await t.dirty()).toEqual([]);
  });

  it('uploads at once when the app goes to the background and cancels the timer', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1'));
    t.registry.markDirty('savings.goals', 'g1');
    t.goBackground();
    await flush();
    expect(t.server.puts).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(UPLOAD_DEBOUNCE_MS * 2);
    expect(t.server.puts).toHaveLength(1);
  });

  it('does nothing in the background while the vault is locked', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1'));
    t.registry.markDirty('savings.goals', 'g1');
    t.lock();
    t.goBackground();
    await flush();
    expect(t.server.puts).toHaveLength(0);
  });

  it('splits 201 records into batches of 200 and 1', async () => {
    const t = await setup();
    for (let i = 0; i < 201; i++) {
      t.goals.store.set(`g${i}`, goal(`g${i}`));
      t.registry.markDirty('savings.goals', `g${i}`);
    }
    expect(await t.sync.uploadNow()).toBe('done');
    expect(t.server.puts.map((p) => p.length)).toEqual([200, 1]);
    expect(await t.dirty()).toEqual([]);
  });

  it('groups by collection and sends only the dirty ids', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1'));
    t.goals.store.set('g2', goal('g2'));
    t.caps.store.set('settings', goal('settings'));
    t.registry.markDirty('savings.goals', 'g1');
    t.registry.markDirty('analytics.caps', 'settings');
    await t.sync.uploadNow();
    const sent = t.server.puts[0]!.map((r) => r.collection).sort();
    expect(sent).toEqual(['analytics.caps', 'savings.goals']);
    expect(t.server.puts[0]).toHaveLength(2);
  });

  it('sends a tombstone for a deleted record', async () => {
    const t = await setup();
    t.goals.store.set('g1', { id: 'g1', version: 3, deleted: true, data: { name: 'x' } });
    t.registry.markDirty('savings.goals', 'g1');
    await t.sync.uploadNow();
    const sent = t.server.puts[0]![0]!;
    expect(sent.deleted).toBe(true);
    expect(openRecord({ backupKey: KEY, userId: USER, ...sent }).data).toBeNull();
  });

  it('skips and clears a dirty id that the export no longer has', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1'));
    t.registry.markDirty('savings.goals', 'g1');
    t.registry.markDirty('savings.goals', 'ghost');
    await t.sync.uploadNow();
    expect(t.server.puts[0]).toHaveLength(1);
    expect(await t.dirty()).toEqual([]);
  });

  it('keeps a change made during the upload dirty', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1'));
    t.goals.store.set('g2', goal('g2'));
    t.registry.markDirty('savings.goals', 'g1');
    t.registry.markDirty('savings.goals', 'g2');
    const release = t.server.hold();
    const upload = t.sync.uploadNow();
    await flush();
    expect(t.server.puts).toHaveLength(1);
    // g1 is edited again while its upload is in flight.
    t.goals.store.set('g1', goal('g1', 2));
    t.registry.markDirty('savings.goals', 'g1');
    await t.registry.settled();
    release();
    await upload;
    expect(ids(await t.dirty())).toEqual(['g1']);
    // The next upload sends the new version.
    expect(await t.sync.uploadNow()).toBe('done');
    expect(t.server.puts.at(-1)![0]!.version).toBe(2);
    expect(await t.dirty()).toEqual([]);
  });

  it('runs one upload at a time and uploads again what was marked meanwhile', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1'));
    t.registry.markDirty('savings.goals', 'g1');
    const release = t.server.hold();
    const first = t.sync.uploadNow();
    const second = t.sync.uploadNow();
    await flush();
    expect(t.server.puts).toHaveLength(1);
    release();
    await Promise.all([first, second]);
    // The second call was folded into a rerun that found nothing left.
    expect(t.server.puts).toHaveLength(1);
  });

  it('uploads what stayed dirty when the vault unlocks', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1'));
    t.registry.markDirty('savings.goals', 'g1');
    await t.registry.settled();
    t.lock();
    t.unlock();
    await flush();
    await flush();
    expect(t.server.puts).toHaveLength(1);
  });

  it('writes marks made while locked on unlock, and uploads them', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1'));
    t.lock();
    t.registry.markDirty('savings.goals', 'g1');
    // Locked: no upload is scheduled.
    await jest.advanceTimersByTimeAsync(UPLOAD_DEBOUNCE_MS * 2);
    expect(t.server.puts).toHaveLength(0);
    t.unlock();
    await flush();
    await flush();
    expect(t.server.puts).toHaveLength(1);
    expect(await t.dirty()).toEqual([]);
  });

  it('cancels the timer and drops the cached key when the vault locks', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1'));
    t.registry.markDirty('savings.goals', 'g1');
    await t.registry.settled();
    await t.sync.uploadNow();
    expect(t.getBackupKey).toHaveBeenCalledTimes(1);
    t.registry.markDirty('savings.goals', 'g1');
    t.lock();
    await jest.advanceTimersByTimeAsync(UPLOAD_DEBOUNCE_MS * 2);
    expect(t.server.puts).toHaveLength(1);
    t.unlock();
    await flush();
    await flush();
    // The key was read again, not kept across the lock.
    expect(t.getBackupKey).toHaveBeenCalledTimes(2);
  });

  it('reset (wipe) cancels the timer', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1'));
    t.registry.markDirty('savings.goals', 'g1');
    t.sync.reset();
    await jest.advanceTimersByTimeAsync(UPLOAD_DEBOUNCE_MS * 2);
    expect(t.server.puts).toHaveLength(0);
  });

  it('reset (wipe) forgets the marks kept in memory while locked', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1'));
    t.lock();
    t.registry.markDirty('savings.goals', 'g1');
    t.sync.reset();
    t.unlock();
    await flush();
    await flush();
    expect(t.server.puts).toHaveLength(0);
    expect(await t.dirty()).toEqual([]);
  });

  it('keeps the rows and sends nothing when signed out or without a key', async () => {
    const out = await setup({ userId: null });
    out.goals.store.set('g1', goal('g1'));
    out.registry.markDirty('savings.goals', 'g1');
    expect(await out.sync.uploadNow()).toBe('stopped');
    expect(out.server.puts).toHaveLength(0);
    expect(ids(await out.dirty())).toEqual(['g1']);

    const noKey = await setup({ key: false });
    noKey.goals.store.set('g1', goal('g1'));
    noKey.registry.markDirty('savings.goals', 'g1');
    expect(await noKey.sync.uploadNow()).toBe('stopped');
    expect(ids(await noKey.dirty())).toEqual(['g1']);
  });

  it('leaves a record that is too big dirty without blocking the others', async () => {
    const t = await setup();
    t.goals.store.set('big', goal('big', 1, 'x'.repeat(70000)));
    t.goals.store.set('g1', goal('g1'));
    t.registry.markDirty('savings.goals', 'big');
    t.registry.markDirty('savings.goals', 'g1');
    expect(await t.sync.uploadNow()).toBe('done');
    expect(t.server.puts[0]).toHaveLength(1);
    expect(ids(await t.dirty())).toEqual(['big']);
  });
});

describe('upload errors', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each<BackupErrorKind>(['offline', 'notActive', 'quota', 'unknown'])(
    'keeps the rows dirty on %s and uploads them when it clears',
    async (kind) => {
      const t = await setup();
      t.goals.store.set('g1', goal('g1'));
      t.registry.markDirty('savings.goals', 'g1');
      t.server.failWith(kind);
      expect(await t.sync.uploadNow()).toBe('stopped');
      expect(t.server.puts).toHaveLength(1);
      expect(ids(await t.dirty())).toEqual(['g1']);
      t.server.failWith(null);
      expect(await t.sync.uploadNow()).toBe('done');
      expect(await t.dirty()).toEqual([]);
    },
  );

  it('stops at a failed batch and keeps only that batch dirty', async () => {
    const t = await setup();
    for (let i = 0; i < 201; i++) {
      t.goals.store.set(`g${String(i).padStart(3, '0')}`, goal(`g${String(i).padStart(3, '0')}`));
      t.registry.markDirty('savings.goals', `g${String(i).padStart(3, '0')}`);
    }
    // The first batch goes through, the second one fails.
    const put = t.server.api.put;
    let calls = 0;
    t.server.api.put = async (records) => {
      calls += 1;
      if (calls === 2) throw new BackupError('offline');
      return put(records);
    };
    expect(await t.sync.uploadNow()).toBe('stopped');
    expect(ids(await t.dirty())).toEqual(['g200']);
  });

  it('on a stale batch downloads the remote records, imports them and retries once', async () => {
    const t = await setup();
    // Another phone already uploaded version 5 of g1, and a caps record.
    t.server.stored.set(
      `savings.goals/${remote('savings.goals', goal('g1', 5, 'Remota')).recordId}`,
      remote('savings.goals', goal('g1', 5, 'Remota')),
    );
    t.server.stored.set('analytics.caps/x', remote('analytics.caps', goal('settings', 4)));
    // This phone still has version 2 of g1, marked dirty.
    t.goals.store.set('g1', goal('g1', 2, 'Local'));
    t.registry.markDirty('savings.goals', 'g1');

    expect(await t.sync.uploadNow()).toBe('done');
    // First put refused, then the retry with the imported version 5.
    expect(t.server.puts.map((p) => p[0]!.version)).toEqual([2, 5]);
    expect(t.goals.imports).toHaveLength(1);
    expect(t.goals.imports[0]).toEqual([
      { id: 'g1', version: 5, deleted: false, data: { name: 'Remota' } },
    ]);
    // Only the collections of the refused batch are imported.
    expect(t.caps.imports).toHaveLength(0);
    expect(await t.dirty()).toEqual([]);
  });

  it('leaves the rows dirty when the retry is stale too', async () => {
    const t = await setup();
    const newer = remote('savings.goals', goal('g1', 9));
    t.server.stored.set(`savings.goals/${newer.recordId}`, newer);
    // A module that ignores the remote version on import keeps conflicting.
    t.goals.collection.importAll = async (records) => {
      t.goals.imports.push(records);
    };
    t.goals.store.set('g1', goal('g1', 2));
    t.registry.markDirty('savings.goals', 'g1');
    expect(await t.sync.uploadNow()).toBe('stopped');
    expect(t.server.puts).toHaveLength(2);
    expect(t.goals.imports).toHaveLength(1);
    expect(ids(await t.dirty())).toEqual(['g1']);
  });

  it('keeps the rows dirty when the download after a stale batch fails', async () => {
    const t = await setup();
    const newer = remote('savings.goals', goal('g1', 9));
    t.server.stored.set(`savings.goals/${newer.recordId}`, newer);
    t.server.api.list = async () => {
      throw new BackupError('offline');
    };
    t.goals.store.set('g1', goal('g1', 2));
    t.registry.markDirty('savings.goals', 'g1');
    expect(await t.sync.uploadNow()).toBe('stopped');
    expect(ids(await t.dirty())).toEqual(['g1']);
  });
});

describe('restoreAll', () => {
  it('reads every page, including an empty page after a full last page', async () => {
    const t = await setup({ pageSize: 2 });
    for (const id of ['g1', 'g2', 'g3', 'g4']) {
      const sealed = remote('savings.goals', goal(id));
      t.server.stored.set(`savings.goals/${sealed.recordId}`, sealed);
    }
    const result = await t.sync.restoreAll();
    expect(t.server.lists).toEqual([null, '2', '4']);
    expect(result).toEqual({ imported: 4, skipped: 0 });
    // One importAll for the collection, with all four.
    expect(t.goals.imports).toHaveLength(1);
    expect(t.goals.imports[0]!.map((r) => r.id).sort()).toEqual(['g1', 'g2', 'g3', 'g4']);
    expect(t.caps.imports).toHaveLength(0);
  });

  it('reads an odd number of records over several pages', async () => {
    const t = await setup({ pageSize: 2 });
    for (const id of ['g1', 'g2', 'g3', 'g4', 'g5']) {
      const sealed = remote('savings.goals', goal(id));
      t.server.stored.set(`savings.goals/${sealed.recordId}`, sealed);
    }
    expect(await t.sync.restoreAll()).toEqual({ imported: 5, skipped: 0 });
    expect(t.server.lists).toEqual([null, '2', '4']);
  });

  it('imports into each collection once, with tombstones', async () => {
    const t = await setup();
    const a = remote('savings.goals', goal('g1'));
    const b = remote('analytics.caps', goal('settings', 3), 10);
    const c = remote(
      'savings.goals',
      { id: 'g2', version: 2, deleted: true, data: { name: 'x' } },
      11,
    );
    for (const s of [a, b, c]) t.server.stored.set(`${s.collection}/${s.recordId}`, s);
    expect(await t.sync.restoreAll()).toEqual({ imported: 3, skipped: 0 });
    expect(t.goals.imports).toHaveLength(1);
    expect(t.caps.imports).toHaveLength(1);
    expect(t.goals.imports[0]!.find((r) => r.id === 'g2')).toEqual({
      id: 'g2',
      version: 2,
      deleted: true,
      data: null,
    });
  });

  it('keeps the highest version of a record found twice', async () => {
    const t = await setup({ pageSize: 1 });
    const v1 = remote('savings.goals', goal('g1', 1, 'Vieja'));
    const v3 = remote('savings.goals', goal('g1', 3, 'Nueva'), 10);
    const v2 = remote('savings.goals', goal('g1', 2, 'Media'), 11);
    // The same record on several pages (the stored map holds one per key, so use distinct keys).
    t.server.stored.set('a', v1);
    t.server.stored.set('b', v3);
    t.server.stored.set('c', v2);
    expect(await t.sync.restoreAll()).toEqual({ imported: 1, skipped: 0 });
    expect(t.goals.imports[0]).toEqual([
      { id: 'g1', version: 3, deleted: false, data: { name: 'Nueva' } },
    ]);
  });

  it('counts unregistered collections and records that fail to decrypt as skipped', async () => {
    const t = await setup();
    const good = remote('savings.goals', goal('g1'));
    const unknown = remote('recurring.items', goal('r1'), 10);
    const tampered = remote('savings.goals', goal('g2'), 11);
    tampered.ciphertext = tampered.ciphertext.map((b, i) => (i === 0 ? b ^ 1 : b));
    const otherUser = sealRecord({
      backupKey: KEY,
      userId: 'user-b',
      collection: 'savings.goals',
      record: goal('g3'),
      nonce: new Uint8Array(12).fill(12),
    });
    for (const s of [good, unknown, tampered, otherUser]) {
      t.server.stored.set(`${s.collection}/${s.recordId}`, s);
    }
    expect(await t.sync.restoreAll()).toEqual({ imported: 1, skipped: 3 });
    expect(t.goals.imports[0]!.map((r) => r.id)).toEqual(['g1']);
  });

  it('throws noKey when the key or the account is missing, and offline when the API is', async () => {
    const noUser = await setup({ userId: null });
    await expect(noUser.sync.restoreAll()).rejects.toMatchObject({ kind: 'noKey' });
    const noKey = await setup({ key: false });
    await expect(noKey.sync.restoreAll()).rejects.toMatchObject({ kind: 'noKey' });
    const offline = await setup();
    offline.server.api.list = async () => {
      throw new BackupError('offline');
    };
    await expect(offline.sync.restoreAll()).rejects.toMatchObject({ kind: 'offline' });
    expect(offline.goals.imports).toHaveLength(0);
  });

  it('stops when the server repeats its cursor', async () => {
    const t = await setup();
    t.server.api.list = async () => ({ records: [], nextCursor: 'same' });
    await expect(t.sync.restoreAll()).rejects.toMatchObject({ kind: 'unknown' });
  });

  it('restores what an upload sent (round trip)', async () => {
    const source = await setup();
    source.goals.store.set('g1', goal('g1', 4, 'Viaje'));
    source.caps.store.set('settings', goal('settings', 2, 'Antojos'));
    source.registry.markDirty('savings.goals', 'g1');
    source.registry.markDirty('analytics.caps', 'settings');
    await source.sync.uploadNow();

    const phone = await setup();
    for (const [k, v] of source.server.stored) phone.server.stored.set(k, v);
    expect(await phone.sync.restoreAll()).toEqual({ imported: 2, skipped: 0 });
    expect(phone.goals.imports[0]).toEqual([goal('g1', 4, 'Viaje')]);
    expect(phone.caps.imports[0]).toEqual([goal('settings', 2, 'Antojos')]);
  });
});

describe('exportAll', () => {
  it('returns every registered collection', async () => {
    const t = await setup();
    t.goals.store.set('g1', goal('g1'));
    expect(await t.sync.exportAll()).toEqual({
      'savings.goals': [goal('g1')],
      'analytics.caps': [],
    });
  });
});
