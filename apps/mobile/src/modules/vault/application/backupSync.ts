// The backup engine on the phone: uploads the records that changed, and restores them all on a
// new phone. It runs only while the app is open and the vault unlocked: no background work.
// Nothing here logs. Errors carry only a kind, never a record, a key or an id.
import type { AppEvents } from '@shared/events/appEvents';
import type { BackupRecord } from '@shared/ports/backup';

import {
  BackupEnvelopeError,
  openRecord,
  sealRecord,
  type SealedBackupRecord,
} from '../domain/backupEnvelope';
import { NONCE_LENGTH } from '../domain/crypto';
import type { BackupRegistry, DirtyRow } from './backupRegistry';
import { BackupError, isBackupError, type BackupRecordsApiPort } from './ports';

/** The API accepts at most 200 records per PUT. */
export const UPLOAD_BATCH_SIZE = 200;
/** Wait this long after the last change before uploading, so a burst of edits is one upload. */
export const UPLOAD_DEBOUNCE_MS = 5000;

export interface BackupSyncDeps {
  registry: BackupRegistry;
  api: BackupRecordsApiPort;
  /** The key that encrypts records (deriveBackupKey of the DEK). Null while it cannot be read. */
  getBackupKey(): Promise<Uint8Array | null>;
  /** The account id, bound into every record. Null when signed out. */
  userId(): string | null;
  randomBytes(length: number): Uint8Array;
  events: AppEvents;
  /** Calls `onBackground` when the app leaves the foreground. Returns the unsubscribe. */
  watchBackground(onBackground: () => void): () => void;
  /** Only tests change it. */
  debounceMs?: number;
}

export type UploadOutcome = 'done' | 'stopped';

export interface BackupSync {
  /**
   * Uploads every dirty record now. Never throws: on any error the rows stay dirty and this
   * round stops. One upload runs at a time; a call during an upload makes it run once more.
   */
  uploadNow(): Promise<UploadOutcome>;
  /**
   * Downloads the whole backup, decrypts it and hands it to each collection's importAll, once
   * per collection with records. The highest version of each record wins. `skipped` counts
   * records of a collection nobody registered and records that failed to decrypt. Throws
   * BackupError (offline, notActive, noKey...) when the download cannot finish.
   */
  restoreAll(): Promise<{ imported: number; skipped: number }>;
  /**
   * Every registered collection's records, for the user's data export (HU-029).
   * Bank data is not here: M5 and M13 add it through their own port, because the vault never
   * reads another module's tables.
   */
  exportAll(): Promise<Record<string, BackupRecord<unknown>[]>>;
  /** Stops timers, forgets the cached key and the marks kept in memory. For wipe. */
  reset(): void;
  /** Removes every listener. Tests only. */
  dispose(): void;
}

interface Credentials {
  key: Uint8Array;
  userId: string;
}

export function createBackupSync(deps: BackupSyncDeps): BackupSync {
  const { registry, api, events } = deps;
  const debounceMs = deps.debounceMs ?? UPLOAD_DEBOUNCE_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cachedKey: Uint8Array | null = null;
  let running: Promise<UploadOutcome> | null = null;
  let again = false;
  // Bumped when the vault locks or is wiped: work that started before stops at its next step.
  let generation = 0;

  const cancelTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  async function credentials(): Promise<Credentials | null> {
    const userId = deps.userId();
    if (!userId) return null;
    const mine = generation;
    let key = cachedKey;
    if (!key) {
      try {
        key = await deps.getBackupKey();
      } catch {
        key = null;
      }
      // The vault locked while the key was read: do not keep it.
      if (key && mine === generation) cachedKey = key;
    }
    return key && mine === generation ? { key, userId } : null;
  }

  interface Downloaded {
    /** collection -> original id -> the highest version */
    latest: Map<string, Map<string, BackupRecord<unknown>>>;
    skipped: number;
  }

  async function downloadAll({ key, userId }: Credentials): Promise<Downloaded> {
    const latest: Downloaded['latest'] = new Map();
    let skipped = 0;
    let cursor: string | null = null;
    do {
      const page = await api.list(cursor);
      for (const sealed of page.records) {
        if (!registry.collection(sealed.collection)) {
          skipped += 1;
          continue;
        }
        let record: BackupRecord<unknown>;
        try {
          record = openRecord({ backupKey: key, userId, ...sealed });
        } catch {
          skipped += 1;
          continue;
        }
        let byId = latest.get(sealed.collection);
        if (!byId) latest.set(sealed.collection, (byId = new Map()));
        const known = byId.get(record.id);
        if (!known || record.version > known.version) byId.set(record.id, record);
      }
      // A server that repeats its cursor would keep this loop alive forever.
      if (page.nextCursor !== null && page.nextCursor === cursor) throw new BackupError('unknown');
      cursor = page.nextCursor;
    } while (cursor !== null);
    return { latest, skipped };
  }

  async function importLatest(latest: Downloaded['latest'], only?: Set<string>): Promise<number> {
    let imported = 0;
    for (const [name, byId] of latest) {
      if (only && !only.has(name)) continue;
      const list = [...byId.values()];
      await registry.collection(name)?.importAll(list);
      imported += list.length;
    }
    return imported;
  }

  // A stale batch means another phone uploaded newer versions: take them, then try again.
  async function pullRemote(creds: Credentials, collections: Set<string>): Promise<void> {
    const { latest } = await downloadAll(creds);
    await importLatest(latest, collections);
  }

  async function round(retried: boolean): Promise<UploadOutcome> {
    const mine = generation;
    await registry.settled();
    const rows = await registry.readDirty();
    if (rows.length === 0) return 'done';
    const creds = await credentials();
    if (!creds || mine !== generation) return 'stopped';
    const maxSeq = Math.max(...rows.map((r) => r.seq));

    const byCollection = new Map<string, DirtyRow[]>();
    for (const row of rows)
      byCollection.set(row.collection, [...(byCollection.get(row.collection) ?? []), row]);

    const items: { row: DirtyRow; sealed: SealedBackupRecord }[] = [];
    const gone: DirtyRow[] = [];
    for (const [name, list] of byCollection) {
      // Not registered (yet): leave the rows for a later round.
      const collection = registry.collection(name);
      if (!collection) continue;
      const exported = new Map((await collection.exportAll()).map((r) => [r.id, r]));
      if (mine !== generation) return 'stopped';
      for (const row of list) {
        const record = exported.get(row.recordId);
        if (!record) {
          gone.push(row);
          continue;
        }
        try {
          const nonce = deps.randomBytes(NONCE_LENGTH);
          items.push({
            row,
            sealed: sealRecord({
              backupKey: creds.key,
              userId: creds.userId,
              collection: name,
              record,
              nonce,
            }),
          });
        } catch (e) {
          // A record the API would refuse (too big) stays dirty and must not block the others.
          if (!(e instanceof BackupEnvelopeError)) throw e;
        }
      }
    }
    await registry.clearDirty(gone, maxSeq);

    for (let i = 0; i < items.length; i += UPLOAD_BATCH_SIZE) {
      const chunk = items.slice(i, i + UPLOAD_BATCH_SIZE);
      try {
        await api.put(chunk.map((c) => c.sealed));
      } catch (e) {
        if (!isBackupError(e, 'stale') || retried) return 'stopped';
        await pullRemote(creds, new Set(chunk.map((c) => c.sealed.collection)));
        return mine === generation ? round(true) : 'stopped';
      }
      // Only the marks this upload saw: a change made meanwhile has a higher seq and stays.
      await registry.clearDirty(
        chunk.map((c) => c.row),
        maxSeq,
      );
      if (mine !== generation) return 'stopped';
    }
    return 'done';
  }

  function uploadNow(): Promise<UploadOutcome> {
    if (running) {
      again = true;
      return running;
    }
    const current = (async () => {
      let outcome: UploadOutcome = 'stopped';
      try {
        do {
          again = false;
          try {
            outcome = await round(false);
          } catch {
            // Offline, device not active, quota, locked...: the rows stay dirty.
            outcome = 'stopped';
          }
        } while (again && outcome === 'done');
      } finally {
        running = null;
      }
      return outcome;
    })();
    running = current;
    return current;
  }

  function schedule() {
    if (!registry.isOpen()) return;
    cancelTimer();
    timer = setTimeout(() => {
      timer = null;
      void uploadNow();
    }, debounceMs);
  }

  const lock = () => {
    cancelTimer();
    cachedKey = null;
    generation += 1;
  };

  const unsubscribes = [
    registry.onMarked(schedule),
    events.on('vault.unlocked', () => void uploadNow()),
    events.on('vault.locked', lock),
    deps.watchBackground(() => {
      if (!registry.isOpen()) return;
      cancelTimer();
      void uploadNow();
    }),
  ];

  return {
    uploadNow,
    async restoreAll() {
      await running?.catch(() => undefined);
      const creds = await credentials();
      if (!creds) throw new BackupError('noKey');
      const { latest, skipped } = await downloadAll(creds);
      return { imported: await importLatest(latest), skipped };
    },
    async exportAll() {
      const out: Record<string, BackupRecord<unknown>[]> = {};
      for (const name of registry.collections()) {
        out[name] = (await registry.collection(name)?.exportAll()) ?? [];
      }
      return out;
    },
    reset() {
      lock();
      registry.reset();
    },
    dispose() {
      lock();
      for (const unsubscribe of unsubscribes) unsubscribe();
    },
  };
}
