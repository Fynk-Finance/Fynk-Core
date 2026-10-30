// When the phone syncs, and what it tells the person (CLAUDE.md, Architecture rule 4; HU-011).
// Triggers: the vault unlocked (the app opened), back to the foreground after 15 minutes, and
// syncNow() from pull to refresh (M6, M7). No timers, no background fetch, no server push.
// The screens read the state (useSync); M12 gets one notice per link and Bogotá day.
import type { Clock, IsoDateTime } from '@shared/domain/types';
import type { NotifyInput } from '@shared/ports';

import type { BankLink } from '../domain/link';
import { bogotaDay, shouldSyncOnForeground } from '../domain/syncRules';
import { bankStrings } from '../ui/strings.es-CO';
import type { SyncEngine, SyncReport } from './syncEngine';

const t = bankStrings.sync;

export interface SyncState {
  status: 'idle' | 'syncing';
  /** The latest end of a sync among the active links (HU-010, "Fecha de última actualización"). */
  lastSyncedAt: IsoDateTime | null;
  lastReport: SyncReport | null;
}

export interface SyncTriggers {
  onVaultUnlocked(fn: () => void): () => void;
  onAppState(fn: (state: string) => void): () => void;
}

export interface SyncControllerDeps {
  /** Null until M6 and M7 can take what a sync brings: then nothing is asked to any bank. */
  engine: Pick<SyncEngine, 'syncAll'> | null;
  links: () => Promise<BankLink[]>;
  entityName: (provider: string) => Promise<string>;
  notify: (n: NotifyInput) => Promise<void>;
  clock: Clock;
}

const UNAVAILABLE: SyncReport = { status: 'unavailable', links: [] };

function latest(links: BankLink[]): IsoDateTime | null {
  const dates = links
    .filter((l) => l.status === 'active' && l.lastSyncedAt)
    .map((l) => l.lastSyncedAt!);
  return dates.length ? dates.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b)) : null;
}

export function createSyncController(deps: SyncControllerDeps) {
  let state: SyncState = { status: 'idle', lastSyncedAt: null, lastReport: null };
  let running: Promise<SyncReport> | null = null;
  const listeners = new Set<() => void>();
  const set = (next: Partial<SyncState>) => {
    state = { ...state, ...next };
    for (const listener of [...listeners]) listener();
  };

  async function notifySynced(report: SyncReport) {
    const day = bogotaDay(deps.clock.now());
    for (const r of report.links.filter((l) => l.kind === 'synced')) {
      try {
        await deps.notify({
          kind: 'sync_result',
          title: t.notice.title(await deps.entityName(r.provider)),
          body: t.notice.body,
          deepLink: 'fynk://billetera',
          dedupeKey: `sync_result:${r.linkId}:${day}`,
        });
      } catch {
        // A notice that can't be written never undoes the sync.
      }
    }
  }

  async function run(engine: Pick<SyncEngine, 'syncAll'>): Promise<SyncReport> {
    set({ status: 'syncing' });
    try {
      const report = await engine.syncAll();
      await notifySynced(report);
      set({ status: 'idle', lastReport: report, lastSyncedAt: latest(await deps.links()) });
      return report;
    } catch (error) {
      set({ status: 'idle' });
      throw error;
    }
  }

  function syncNow(): Promise<SyncReport> {
    if (!deps.engine) return Promise.resolve(UNAVAILABLE);
    running ??= run(deps.engine).finally(() => {
      running = null;
    });
    return running;
  }

  return {
    syncNow,
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Resolves when no sync is running (tests and the first render). */
    idle: async () => {
      await running?.catch(() => undefined);
    },
    /** Starts the triggers. Returns the function that stops them. */
    start(triggers: SyncTriggers): () => void {
      if (!deps.engine) return () => undefined;
      let backgroundSince: IsoDateTime | null = null;
      const quiet = () => void syncNow().catch(() => undefined);
      const stops = [
        triggers.onVaultUnlocked(quiet),
        triggers.onAppState((next) => {
          const now = deps.clock.now();
          if (next === 'background') backgroundSince ??= now.toISOString();
          if (next !== 'active') return;
          const due = shouldSyncOnForeground(backgroundSince, now);
          backgroundSince = null;
          if (due) quiet();
        }),
      ];
      void deps
        .links()
        .then((links) => set({ lastSyncedAt: latest(links) }))
        .catch(() => undefined);
      return () => stops.forEach((stop) => stop());
    },
  };
}

export type SyncController = ReturnType<typeof createSyncController>;
